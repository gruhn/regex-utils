import * as CharSet from './char-set'
import * as RE from './regex'
import { UnsupportedSyntaxError } from './regex-parser'
import { assert, checkedAllCases } from './utils'

/**
 * TODO: docs
 *
 * @public
 */
export type RepeatBounds =
  | number
  | { min: number, max?: number }
  | { min?: number, max: number }

/**
 * Abstract syntax tree for JavaScript regular expressions.
 * This is what the parser produces.
 */
export type RegExpAST =
  | { type: "epsilon" }
  | { type: "literal", charset: CharSet.CharSet }
  | { type: "concat", left: RegExpAST, right: RegExpAST }
  | { type: "union", left: RegExpAST, right: RegExpAST }
  | { type: "star", inner: RegExpAST }
  | { type: "plus", inner: RegExpAST }
  | { type: "optional", inner: RegExpAST }
  | { type: "repeat", inner: RegExpAST, bounds: RepeatBounds }
  | { type: "capture-group", name?: string, inner: RegExpAST }
  | { type: "lookahead", isPositive: boolean, inner: RegExpAST, left: RegExpAST, right: RegExpAST }
  | { type: "start-anchor", left: RegExpAST, right: RegExpAST }
  | { type: "end-anchor", left: RegExpAST, right: RegExpAST }

type ExtRegexNode = {
  type: "ext-regex",
  content: RE.ExtRegex
}

/**
 * Intermediate representation when transforming RegExpAST to ExtRegex.
 * It's a supertype of RegExpAST that also allows ExtRegex subtrees.
 */
type InterAST =
  | ExtRegexNode
  | { type: "epsilon" }
  | { type: "literal", charset: CharSet.CharSet }
  | { type: "concat", left: InterAST, right: InterAST }
  | { type: "union", left: InterAST, right: InterAST }
  | { type: "star", inner: InterAST }
  | { type: "plus", inner: InterAST }
  | { type: "optional", inner: InterAST }
  | { type: "repeat", inner: InterAST, bounds: RepeatBounds }
  | { type: "capture-group", name?: string, inner: InterAST }
  | { type: "lookahead", isPositive: boolean, inner: InterAST, left: InterAST, right: InterAST }
  | { type: "start-anchor", left: InterAST, right: InterAST }
  | { type: "end-anchor", left: InterAST, right: InterAST }

/**
 * Like InterAST but:
 * - "plus", "repeat", "optional", "capture-group" are eliminated
 * - "epsilon", "literal" are always converted to "ext-regex" nodes
 */
type InterAST_desugared =
  | ExtRegexNode
  | { type: "concat", left: InterAST_desugared, right: InterAST_desugared }
  | { type: "union", left: InterAST_desugared, right: InterAST_desugared }
  | { type: "star", inner: InterAST_desugared }
  | { type: "lookahead", isPositive: boolean, inner: InterAST_desugared, left: InterAST_desugared, right: InterAST_desugared }
  | { type: "start-anchor", left: InterAST_desugared, right: InterAST_desugared }
  | { type: "end-anchor", left: InterAST_desugared, right: InterAST_desugared }

/**
 * InterAST_no_start_anchors with start- and end-anchors eliminated.
 */
type InterAST_no_achnors =
  | ExtRegexNode
  | { type: "concat", left: InterAST_no_achnors, right: InterAST_no_achnors }
  | { type: "union", left: InterAST_no_achnors, right: InterAST_no_achnors }
  | { type: "star", inner: InterAST_no_achnors }
  | { type: "lookahead", isPositive: boolean, inner: InterAST_no_achnors, left: InterAST_no_achnors, right: InterAST_no_achnors }

/**
 * Lookahead node that has been normalized to:
 * - always be positive and
 * - have only ExtRegex sub-expressions.
 */
type NormalizedLookahead = {
  type: "lookahead"
  isPositive: true
  inner: {
    type: "ext-regex"
    content: RE.ExtRegex
  }
  left: {
    type: "ext-regex"
    content: RE.ExtRegex
  }
  right: {
    type: "ext-regex"
    content: RE.ExtRegex
  }
}

function isNormalizedLookahead(ast: InterAST_desugared): ast is NormalizedLookahead {
  return (
    ast.type === 'lookahead' &&
    ast.isPositive &&
    ast.inner.type === 'ext-regex' &&
    ast.left.type === 'ext-regex' &&
    ast.right.type === 'ext-regex'
  )
}

export type RenderOptions = {
  useNonCapturingGroups: boolean
}

//////////////////////////////////////////////
///// Mapping: AST -> ExtRegex           /////
//////////////////////////////////////////////

function isNullable(ast: InterAST_desugared): boolean {
  switch (ast.type) {
    case "ext-regex": return RE.isNullable(ast.content)
    case "concat": return isNullable(ast.left) && isNullable(ast.right)
    case "union": return isNullable(ast.left) || isNullable(ast.right)
    case "star": return true
    case "lookahead": return (
      isNullable(ast.left) &&
      isNullable(ast.right) &&
      // TODO: explain
      isNullable(ast.inner) === ast.isPositive
    )
    case "start-anchor": return isNullable(ast.left) && isNullable(ast.right)
    case "end-anchor": return isNullable(ast.left) && isNullable(ast.right)
  }
  checkedAllCases(ast)
}

function desugar(ast: RegExpAST): InterAST_desugared {
  switch (ast.type) {
    case 'epsilon': return extRegex(RE.epsilon)
    case 'literal': return extRegex(RE.literal(ast.charset))
    case 'concat': return concat(desugar(ast.left), desugar(ast.right))
    case 'union': return union(desugar(ast.left), desugar(ast.right))
    case 'star': return star(desugar(ast.inner))
    case 'start-anchor': return startAnchor(desugar(ast.left), desugar(ast.right))
    case 'end-anchor': return endAnchor(desugar(ast.left), desugar(ast.right))
    case 'lookahead': return lookahead(ast.isPositive, desugar(ast.inner), desugar(ast.left), desugar(ast.right))
    case 'capture-group': return desugar(ast.inner)
    case 'optional':
      // `a?` ==> `ε|a`
      return union(extRegex(RE.epsilon), desugar(ast.inner))
    case 'plus': {
      const inner = desugar(ast.inner)
      // `a+` ==> `aa*`
      return concat(inner, star(inner))
    }
    case 'repeat': {
      const inner = desugar(ast.inner)
      if (typeof ast.bounds === 'number') {
        // `a{3}` ==> `aaa`
        return desugarRepeatNode(inner, ast.bounds, ast.bounds)
      } else {
        // `a{1,2}` ==> `a(a|ε)`
        // `a{,2}` ==> `(a|ε)(a|ε)`
        // `a{1,}` ==> `aa*`
        const { min = 0, max = Infinity } = ast.bounds
        assert(0 <= min && min <= max)
        return desugarRepeatNode(inner, min, max)
      }
    }
  }
  checkedAllCases(ast)
}
function desugarRepeatNode(ast: InterAST_desugared, min: number, max: number): InterAST_desugared {
  const requiredPrefix = seq(Array(min).fill(ast))

  if (max === Infinity)
    return concat(requiredPrefix, star(ast))
  else
    return concat(
      requiredPrefix,
      seq(Array(max - min).fill(union(extRegex(RE.epsilon), ast)))
    )
}

function pullUpStartAnchor(ast: InterAST_desugared, isLeftClosed: boolean): InterAST_desugared {
  switch (ast.type) {
    case "ext-regex": return ast
    case "concat": {
      // Pull up start anchors on subexpressions first, so if they contain start
      // anchors then `left` and `right` will have the start anchor at the top.
      const left = pullUpStartAnchor(ast.left, isLeftClosed)
      const right = pullUpStartAnchor(ast.right, true) // TODO: maybe more like `hasPrefix || left != epsilon`
      if (right.type === 'start-anchor') {
        // Expression has the form `l^r` where `r` contains no start anchor.
        // `l` may contain one but it does not matter. `l` can at most match epsilon,
        // otherwise the whole expression is contradictory and collapses to the empty set.
        if (isNullable(left)) {
          return right // i.e. `^r`
        } else {
          return empty()
        }
      } else if (left.type === 'start-anchor') {
        // Expression has the form `(^l)r` where `r` does not contain a start anchor.
        // We can just pull up the start-anchor:
        return startAnchor(extRegex(RE.epsilon), concat(left.right, right)) // i.e. `^(lr)`
      } else {
        // Neither the left- nor right subexpression contain start anchors.
        // Note, that `left` and `right` may still have been modified (e.g. turned into
        // empty set) so we can't just return `ast` unchanged:
        return concat(left, right)
      }
    }
    case "union": {
      const left = pullUpStartAnchor(ast.left, isLeftClosed)
      const right = pullUpStartAnchor(ast.right, isLeftClosed)
      if (left.type === 'start-anchor' && right.type === 'start-anchor') {
        // Expression has the form `(^l|^r)`:
        return startAnchor(extRegex(RE.epsilon), union(left.right, right.right)) // i.e. `^(l|r)`
      } else if (left.type === 'start-anchor') {
        if (isLeftClosed) {
          // Expression has the form `p(^l|r)`:
          throw new UnsupportedSyntaxError('union with non-empty prefix where only some members have anchors like a(^b|c)')
        } else {
          // Expression has the form `(^l|r)`:
          return startAnchor(extRegex(RE.epsilon), union(left.right, concat(dotStar(), right))) // i.e. `^(l|.*r)`
        }
      } else if (right.type === 'start-anchor') {
        if (isLeftClosed)
          // Expression has the form `p(l|^r)`:
          throw new UnsupportedSyntaxError('union with non-empty prefix where only some members have anchors like a(b|^c)')
        else
          // Expression has the form `(l|^r)`:
          return startAnchor(extRegex(RE.epsilon), union(concat(dotStar(), left), right.right)) // i.e. `^(.*l|r)`
      } else {
        // Expression has the form `(l|r)`:
        return union(left, right)
      }
    }
    case "star": {
      const inner = pullUpStartAnchor(ast.inner, true) // TODO: correct?
      if (inner.type === 'start-anchor') {
        // Expression has the form `(^r)*`. We can expand the star to:
        //
        //     (^r)* == ε | (^r) | (^r)(^r)(^r)*
        //
        // It turns out that the case `(^r)(^r)(^r)*` can be eliminated.
        // If `r` is nullable then the leftmost `(^r)` can only match epsilon, so:
        //
        //        (^r)(^r)(^r)* == (^r)(^r)*
        //
        //    ==> (^r)* == ε | (^r) | (^r)(^r)*
        //              == ε | (^r)
        //
        // If `r` is not nullable the expression collapses to the empty set:
        //
        //        (^r)(^r)(^r)* == ∅
        //
        //    ==> (^r)* == ε | (^r) | ∅
        //              == ε | (^r)
        //
        if (isLeftClosed)
          throw new UnsupportedSyntaxError('start anchor inside quantifier with non-empty prefix like (^a)*')
        else
          return startAnchor(extRegex(RE.epsilon), union(dotStar(), inner.right)) // i.e. `^(.*|r)`
      } else {
        // Expression has the form `r*` so no start anchor to deal with:
        return star(inner)
      }
    }
    case "start-anchor": {
      const left = pullUpEndAnchor(ast.left, isLeftClosed)
      const right = pullUpStartAnchor(ast.right, true)

      if (!isNullable(left)) {
        // Expression has the form `l^r` where `l` is not nullable. Thus, the whole
        // expression collapses to the empty set:
        return empty()
      } else if (left.type === 'end-anchor') {
        // Expression has the form `(l$)^r`. This can (at most) match epsilon,
        // if `r` is also nullable. Otherwise, this can't match anything:
        if (isNullable(right))
          return startAnchor(extRegex(RE.epsilon), endAnchor(extRegex(RE.epsilon), extRegex(RE.epsilon))) // i.e. `^$`
        else
          return empty()
      } else if (right.type === 'start-anchor') {
        // Expression has the form `^(^r)`. Multiple start anchor don't introduce
        // a contradiction as long as there is nothing between them:
        return right // i.e. `^r`
      } else {
        // Expression has the form `^r` where `r` contain no start anchor:
        return startAnchor(extRegex(RE.epsilon), right) // i.e. `^r`
      }
    }
    case "end-anchor": {
      const left = pullUpStartAnchor(ast.left, isLeftClosed)
      const right = pullUpStartAnchor(ast.right, true)

      if (!isNullable(ast.right)) {
        // Expression has the form `l$r` where `r` is not nullable. Thus, the whole
        // expression collapses to the empty set:
        return empty()
      } else if (right.type === 'start-anchor') {
        // Expression has the form `l$(^r)`. This can (at most) match epsilon,
        // if both `l` is also nullable:
        if (isNullable(left))
          return startAnchor(extRegex(RE.epsilon), endAnchor(extRegex(RE.epsilon), extRegex(RE.epsilon))) // i.e `^$`
        else
          return empty()
      } else if (left.type === 'start-anchor') {
        // Expression has the form `(^r)$`. We can just pull the start anchor to the top:
        return startAnchor(extRegex(RE.epsilon), endAnchor(left.right, extRegex(RE.epsilon))) // i.e. `^(r$)`
      } else {
        // Expression has the form `r$` where `r` contain no start anchor:
        return endAnchor(left, extRegex(RE.epsilon))
      }
    }
    case "lookahead": {
      const inner = pullUpStartAnchor(ast.inner, true)
      const right = pullUpStartAnchor(ast.right, isLeftClosed)
      if (inner.type === 'start-anchor') {
        throw new UnsupportedSyntaxError('start anchors inside lookaheads like (?=^a)')
      } else if (right.type === 'start-anchor') {
        return startAnchor(extRegex(RE.epsilon), lookahead(ast.isPositive, ast.inner, right.right))
      } else {
        return lookahead(ast.isPositive, inner, right)
      }
    }
  }
  checkedAllCases(ast)
}

function pullUpEndAnchor(ast: InterAST_desugared, isRightClosed: boolean): InterAST_desugared {
  switch (ast.type) {
    case "ext-regex": return ast
    case "concat": {
      // Pull up end anchors on subexpressions first, so if they contain end
      // anchors then `left` and `right` will have the end anchor at the top.
      const left = pullUpEndAnchor(ast.left, true) // TODO: rather `isRightClosed || right != epsilon`
      const right = pullUpEndAnchor(ast.right, isRightClosed)
      if (left.type === 'end-anchor') {
        // Expression has the form `l$r` where `l` contains no end anchor.
        // `r` may contain one but it does not matter. `r` can at most match epsilon,
        // otherwise the whole expression is contradictory and collapses to the empty set.
        if (isNullable(right)) {
          return left // i.e. `l$`
        } else {
          return empty()
        }
      } else if (right.type === 'end-anchor') {
        // Expression has the form `l(r$)` where `l` does not contain an end anchor.
        // We can just pull up the end anchor:
        return endAnchor(concat(left, right.left), extRegex(RE.epsilon)) // i.e. `(lr)$`
      } else {
        // Neither the left- nor right subexpression contain end anchors.
        // Note, that `left` and `right` may still have been modified (e.g. turned into
        // empty set) so we can't just return `ast` unchanged:
        return concat(left, right)
      }
    }
    case "union": {
      const left = pullUpEndAnchor(ast.left, isRightClosed)
      const right = pullUpEndAnchor(ast.right, isRightClosed)
      if (left.type === 'end-anchor' && right.type === 'end-anchor') {
        // Expression has the form `(l$|r$)`:
        return endAnchor(union(left.left, right.left), extRegex(RE.epsilon)) // i.e. `(l$|r$)`
      } else if (left.type === 'end-anchor') {
        if (isRightClosed)
          // Expression has the form `(l$|r)s`:
          throw new UnsupportedSyntaxError('union with non-empty suffix where only some members have anchors like (a$|b)c')
        else
          // Expression has the form `(l$|r)`:
          return endAnchor(union(left.left, concat(right, dotStar())), extRegex(RE.epsilon)) // i.e. `(l|r.*)$`
      } else if (right.type === 'end-anchor') {
        // Expression has the form `(l|r$)s`:
        if (isRightClosed)
          throw new UnsupportedSyntaxError('union with non-empty suffix where only some members have anchors like (a|b$)c')
        else
          // Expression has the form `(l|r$)`:
          return endAnchor(union(concat(left, dotStar()), right.left), extRegex(RE.epsilon)) // i.e. `(l.*|r)$`
      } else {
        // Expression has the form `(l|r)`:
        return union(left, right)
      }
    }
    case "star": {
      const inner = pullUpEndAnchor(ast.inner, true) // TODO: correct?
      if (inner.type === 'end-anchor')
        if (isRightClosed)
          // Expression has the form `(l$)*s`:
          // (see explanation for the "star" case in `pullUpStartAnchor`)
          throw new UnsupportedSyntaxError('end anchors inside quantifiers with non-empty suffix like (a$)*b')
        else
          // Expression has the form `(l$)*`
          return endAnchor(union(dotStar(), inner.left), extRegex(RE.epsilon)) // i.e. `(.*|l)$`
      else
        // Expression has the form `l*` so no end anchor to deal with:
        return star(inner)
    }
    case "start-anchor": {
      const left = pullUpEndAnchor(ast.left, true)
      const right = pullUpEndAnchor(ast.right, isRightClosed)

      if (!isNullable(left)) {
        // Expression has the form `l^r` where `r` is not nullable. Thus, the whole
        // expression collapses to the empty set:
        return empty()
      } else if (left.type === 'end-anchor') {
        // Expression has the form `(l$)^r`. This can (at most) match epsilon,
        // if `r` is also nullable:
        if (isNullable(right))
          return endAnchor(startAnchor(extRegex(RE.epsilon), extRegex(RE.epsilon)), extRegex(RE.epsilon)) // i.e `^$`
        else
          return empty()
      } else if (right.type === 'end-anchor') {
        // Expression has the form `^(r$)`. We can just pull the end anchor to the top:
        return endAnchor(startAnchor(extRegex(RE.epsilon), right.left), extRegex(RE.epsilon)) // i.e. `(^r)$`
      } else {
        // Expression has the form `^r` where `r` contain no end anchor:
        return startAnchor(extRegex(RE.epsilon), right)
      }
    }
    case "end-anchor": {
      const left = pullUpEndAnchor(ast.left, true)
      const right = pullUpStartAnchor(ast.right, isRightClosed)

      if (!isNullable(right)) {
        // Expression has the form `l$r` where `r` is not nullable. Thus, the whole
        // expression collapses to the empty set:
        return empty()
      } else if (right.type === 'start-anchor') {
        // Expression has the form `l$(^r)`. This can (at most) match epsilon,
        // if `l` is also nullable. Otherwise, this can't match anything:
        if (isNullable(left))
          return endAnchor(startAnchor(extRegex(RE.epsilon), extRegex(RE.epsilon)), extRegex(RE.epsilon)) // i.e. `^$`
        else
          return empty()
      } else if (left.type === 'end-anchor') {
        // Expression has the form `(l$)$`. Multiple end anchor don't introduce
        // a contradiction as long as there is nothing between them:
        return left // i.e. `l$`
      } else {
        // Expression has the form `l$` where `l` contain no end anchor:
        return endAnchor(left, extRegex(RE.epsilon)) // i.e. `l$`
      }
    }
    case "lookahead": {
      const inner = pullUpEndAnchor(ast.inner, false)
      const right = pullUpEndAnchor(ast.right, isRightClosed)
      if (inner.type === 'end-anchor') {
        throw new UnsupportedSyntaxError('end anchors inside lookaheads like (?=a$)')
      } else if (right.type === 'end-anchor') {
        // Expression has the form `a(?=b)(c$)`:
        return endAnchor(lookahead(ast.isPositive, ast.inner, ast.left, right.left), extRegex(RE.epsilon)) // i.e. `(a(?=b)c)$`
      } else {
        return lookahead(ast.isPositive, inner, left, right)
      }
    }
  }
  checkedAllCases(ast)
}

function intersection(left: ExtRegexNode, right: ExtRegexNode): ExtRegexNode {
  return extRegex(RE.intersection(left.content, right.content))
}

function complement(ast: ExtRegexNode): ExtRegexNode {
  return extRegex(RE.complement(ast.content))
}

// FIXME:
function pullUpLookahead(ast: InterAST_no_achnors): ExtRegexNode | NormalizedLookahead {
  switch (ast.type) {
    case "ext-regex": return ast
    case "lookahead": {
      let isPositive = ast.isPositive
      let inner = pullUpLookahead(ast.inner)
      let right = pullUpLookahead(ast.right)

      // For nested lookaheads like
      //
      //    (?=(?=a)b)c
      //
      // Assuming `a` and `b` are just ExtRegex,
      // we can take their intersection to get a single lookahead:
      //
      //    (?=a&b)c
      //
      if (inner.type === 'lookahead') {
        // Lookahead nodes returned by `pullUpLookahead` should always be normalized:
        assert(isNormalizedLookahead(inner), '[pullUpLookahead] returned non-normalized lookahead')
        inner = intersection(inner.inner, inner.right)
      }

      // If we have a negative lookahead like `(?!a)b`, we convert it to an equivalent
      // positive lookahead:
      if (!isPositive) {
        if (isNullable(inner)) {
          // If the inner expression is nullable like `(?!)b`, then the expression can
          // always match an empty string. Thus, the assertion always fails.
          inner = extRegex(RE.empty)
        } else {
          // Otherwise, the inner expression must consume at least one character
          // and we can take its complement to get an equivalent positive lookahead:
          inner = complement(inner)
        }
        isPositive = true
      }

      // For two lookaheads in a row like
      //
      //    (?=a)(?=b)c
      //
      // Assuming `a` and `b` are simple ExtRegex,
      // we can take their intersection to get a single lookahead:
      //
      //    (?=a&b)c
      //
      if (right.type === 'lookahead') {
        // Lookahead nodes returned by `pullUpLookahead` should always be normalized:
        assert(isNormalizedLookahead(right), '[pullUpLookahead] returned non-normalized lookahead')
        inner = intersection(inner, right.inner)
        right = right.right
      }

      return lookahead(isPositive, inner, right)
    }
    case "concat": {
      const left = pullUpLookahead(ast.left)
      const right = pullUpLookahead(ast.right)

      if (left.type === 'lookahead') {
        if (right.type === "lookahead") {
          // Expression has the form `((?=a)b)((?=c)d)`.
          // We pull the right lookahead to the left:
          //
          //    (?=a)(?=bc)bd
          //
          // then combine the lookaheads using intersection:
          //
          //    (?=a&b)bd
          //
          return lookahead(
            true,
            intersection(left.inner, right.inner),
            concat(left.right, right.right),
          )
        } else {
          // Expression has the form `((?=a)b)c`.
          // We can just concat `b` and `c`:
          //
          //    (?=a)bc
          //
          return lookahead(
            true,
            left.inner,
            concat(left.right, right),
          )
        }
      } else if (right.type === 'lookahead') {
        // Expression has the form `a(?=b)c`.
        // We prepend `a` to the lookahead to pull the lookahead to the left:
        //
        //    (?=ab)ac
        //
        return lookahead(
          true,
          concat(left, right.inner),
          concat(left, right.right),
        )
      } else {
        // Expression has the form `ab` with no lookaheads.
        return concat(left, right)
      }
    }
    case "union": {
      const left = pullUpLookahead(ast.left)
      const right = pullUpLookahead(ast.right)
      if (left.type === 'lookahead' || right.type === 'lookahead') {
        // TODO: some simpler cases can still be handled
        throw new UnsupportedSyntaxError('lookahead inside union like (?=a)|b')
      } else {
        return union(left, right)
      }
    }
    case "star": {
      const inner = pullUpLookahead(ast.inner)
      if (inner.type === 'lookahead') {
        throw new UnsupportedSyntaxError('lookahead inside quantifier like (?=a)*')
      } else {
        return star(inner)
      }
    }
  }
  checkedAllCases(ast)
}

export function toExtRegex(baseAST: RegExpAST): RE.ExtRegex {
  // First eliminate nodes like `plus`, `optional`, etc.
  const astDesugared = desugar(baseAST)

  // Then eliminate start anchors by first pulling them to the top:
  let astNoAnchors = pullUpStartAnchor(astDesugared, false)
  if (astNoAnchors.type === 'start-anchor') {
    // If the root node is indeed a start anchor now, then start anchors have been
    // eliminated from all sub-expressions and we can just drop the root-level one:
    astNoAnchors = astNoAnchors.right
  } else {
    // If the root node is not a start anchor, then the expression contained
    // no start anchors anywhere and we have to prepend the implicit `.*`:
    astNoAnchors = concat(dotStar(), astNoAnchors)
  }

  // Then eliminate end anchors by first pulling them to the top:
  astNoAnchors = pullUpEndAnchor(astNoAnchors, false)
  if (astNoAnchors.type === 'end-anchor') {
    // If the root node is indeed an end anchor now, then end anchors have been
    // eliminated from all sub-expressions and we can just drop the root-level one:
    astNoAnchors = astNoAnchors.left
  } else {
    // If the root node is not a end anchor, then the expression contained
    // no end anchors anywhere and we have to append the implicit `.*`:
    astNoAnchors = concat(astNoAnchors, dotStar())
  }

  // Then eliminate lookaheads by first pulling them to the top:
  let astNoLookaheads = pullUpLookahead(astNoAnchors as InterAST_no_achnors) // TODO: avoid `as`
  if (astNoLookaheads.type === 'lookahead') {
    // If the root node is indeed an end anchor now, then end anchors have been
    // eliminated from all sub-expressions and we can just drop the root-level one:
    return intersection(astNoLookaheads.inner, astNoLookaheads.right).content
  } else {
    return astNoLookaheads.content
  }
}

//////////////////////////////////////////////
///// smart constructors                 /////
//////////////////////////////////////////////

function extRegex(re: RE.ExtRegex): ExtRegexNode {
  return { type: 'ext-regex', content: re }
}

export const epsilon: RegExpAST = { type: 'epsilon' }

export function startAnchor(left: InterAST_desugared, right: InterAST_desugared): InterAST_desugared
export function startAnchor(left: RegExpAST, right: RegExpAST): RegExpAST
export function startAnchor(left: InterAST, right: InterAST): InterAST {
  return { type: 'start-anchor', left, right }
}

export function endAnchor(left: InterAST_desugared, right: InterAST_desugared): InterAST_desugared
export function endAnchor(left: RegExpAST, right: RegExpAST): RegExpAST
export function endAnchor(left: InterAST, right: InterAST): InterAST {
  return { type: 'end-anchor', left, right }
}

export function literal(charset: CharSet.CharSet): RegExpAST {
  return { type: 'literal', charset }
}

function empty(): InterAST_desugared {
  return extRegex(RE.empty)
}

function dotStar(): InterAST_desugared {
  return extRegex(RE.dotStar)
}

export function concat(left: ExtRegexNode, right: ExtRegexNode): ExtRegexNode
export function concat(left: InterAST_desugared, right: InterAST_desugared): InterAST_desugared
export function concat(left: RegExpAST, right: RegExpAST): RegExpAST
export function concat(left: InterAST, right: InterAST): InterAST {
  if (left.type === 'ext-regex' && right.type === 'ext-regex')
    return extRegex(RE.concat(left.content, right.content))
  else
    return { type: 'concat', left, right }
}

function seq(array: InterAST_desugared[]): InterAST_desugared {
  if (array.length === 0)
    return extRegex(RE.epsilon)
  else
    return array.reduceRight(concat)
}

export function string(chars: string): RegExpAST {
  if (chars.length === 0)
    return epsilon
  else
    return [...chars]
      .map(char => literal(CharSet.singleton(char)))
      .reduceRight(concat)
}

export function union(left: ExtRegexNode | undefined, right: ExtRegexNode | undefined): ExtRegexNode
export function union(left: InterAST_desugared | undefined, right: InterAST_desugared | undefined): InterAST_desugared
export function union(left: RegExpAST | undefined, right: RegExpAST | undefined): RegExpAST
export function union(left: InterAST = epsilon, right: InterAST = epsilon): InterAST {
  if (left.type === 'ext-regex' && right.type === 'ext-regex')
    return extRegex(RE.union(left.content, right.content))
  else
    return { type: 'union', left, right }
}

export function star(inner: ExtRegexNode): ExtRegexNode
export function star(inner: InterAST_desugared): InterAST_desugared
export function star(inner: RegExpAST): RegExpAST
export function star(inner: InterAST): InterAST {
  if (inner.type === 'ext-regex')
    return extRegex(RE.star(inner.content))
  else
    return { type: 'star', inner }
}

export function plus(inner: RegExpAST): RegExpAST {
  return { type: 'plus', inner }
}

export function optional(inner: RegExpAST): RegExpAST {
  return { type: 'optional', inner }
}

export function repeat(inner: RegExpAST, bounds: RepeatBounds): RegExpAST {
  return { type: 'repeat', inner, bounds }
}

export function captureGroup(inner: RegExpAST, name?: string): RegExpAST {
  return { type: 'capture-group', inner, name }
}

export function lookahead(isPositive: true, inner: ExtRegexNode, left: ExtRegexNode, right: ExtRegexNode): NormalizedLookahead
export function lookahead(isPositive: boolean, inner: InterAST_desugared, left: InterAST_desugared, right: InterAST_desugared): InterAST_desugared
export function lookahead(isPositive: boolean, inner: RegExpAST, left: RegExpAST, right: RegExpAST): RegExpAST
export function lookahead(isPositive: boolean, inner: InterAST, left: InterAST, right: InterAST): InterAST {
  return { type: 'lookahead', isPositive, inner, left, right }
}

//////////////////////////////////////////////
///// rendering                          /////
//////////////////////////////////////////////

function repeatBoundsToString(bounds: RepeatBounds): string {
  if (typeof bounds === 'number')
    return `{${bounds}}`
  else
    return `{${bounds.min ?? 0},${bounds.max ?? ''}}`
}

function captureGroupToString(name: string | undefined, inner: RegExpAST, options: RenderOptions) {
  if (name === undefined)
    return `(${toString(inner, options)})`
  else
    return `(?<${name}>${toString(inner, options)})`
}

export function debugPrint(ast: InterAST): unknown {
  return console.debug(debugShow(ast))
}
export function debugShow(ast: InterAST): unknown {
  return JSON.stringify(debugShowAux(ast), null, 2)
}
function debugShowAux(ast: InterAST): unknown {
  switch (ast.type) {
    case 'ext-regex':
      return RE.debugShowAux(ast.content)
    case 'epsilon':
      return '';
    case 'start-anchor':
      return { type: 'start-anchor', left: debugShowAux(ast.left), right: debugShowAux(ast.right) }
    case 'end-anchor':
      return { type: 'end-anchor', left: debugShowAux(ast.left), right: debugShowAux(ast.right) }
    case 'literal':
      return CharSet.toString(ast.charset)
    case 'concat':
      return { type: 'concat', left: debugShowAux(ast.left), right: debugShowAux(ast.right) }
    case 'union':
      return { type: 'union', left: debugShowAux(ast.left), right: debugShowAux(ast.right) }
    case 'star':
      return { type: 'star', inner: debugShowAux(ast.inner) }
    case 'plus':
      return { type: 'plus', inner: debugShowAux(ast.inner) }
    case 'optional':
      return { type: 'optional', inner: debugShowAux(ast.inner) }
    case 'repeat':
      return { type: 'repeat', inner: debugShowAux(ast.inner), bounds: ast.bounds }
    case 'capture-group':
      return { type: 'capture-group', name: ast.name, inner: debugShowAux(ast.inner) }
    case 'lookahead':
      return { type: 'lookahead', isPositive: ast.isPositive, inner: debugShowAux(ast.inner), right: debugShowAux(ast.right) }
  }
  checkedAllCases(ast)
}

export function toString(ast: RegExpAST, options: RenderOptions): string {
  switch (ast.type) {
    case 'epsilon':
      return ''
    case 'start-anchor':
      return maybeWithParens(ast.left, ast, options) + '^' + maybeWithParens(ast.right, ast, options)
    case 'end-anchor':
      return maybeWithParens(ast.left, ast, options) + '$' + maybeWithParens(ast.right, ast, options)
    case 'literal':
      return CharSet.toString(ast.charset)
    case 'concat':
      return maybeWithParens(ast.left, ast, options) + maybeWithParens(ast.right, ast, options)
    case 'union':
      return maybeWithParens(ast.left, ast, options) + '|' + maybeWithParens(ast.right, ast, options)

    // For postfix operators if we have to check whether `ast.inner` is not effectively epsilon.
    // In that case we shouldn't append the operator, otherwise can generate invalid expressions.
    // For example, `aε*` would become `a*`.
    case 'star': {
      const innerStr = maybeWithParens(ast.inner, ast, options)
      if (innerStr === '')
        return ''
      else
        return innerStr + '*'
    }
    case 'plus': {
      const innerStr = maybeWithParens(ast.inner, ast, options)
      if (innerStr === '')
        return ''
      else
        return innerStr + '+'
    }
    case 'optional': {
      const innerStr = maybeWithParens(ast.inner, ast, options)
      if (innerStr === '')
        return ''
      else
        return innerStr + '?'
    }
    case 'repeat': {
      const innerStr = maybeWithParens(ast.inner, ast, options)
      if (innerStr === '')
        return ''
      else if (typeof ast.bounds === 'number' && ast.bounds <= 3 && innerStr.length === 1)
        // Just duplicate `innerStr` if that makes rendered expression shorter.
        // E.g. `aaa` instead of `a{3}`.
        return innerStr.repeat(ast.bounds)
      else
        return innerStr + repeatBoundsToString(ast.bounds)
    }

    case 'capture-group':
      return captureGroupToString(ast.name, ast.inner, options)
    case 'lookahead': {
      const inner = toString(ast.inner, options)
      const right = maybeWithParens(ast.right, ast, options)
      if (ast.isPositive)
        return '(?=' + inner + ')' + right
      else
        return '(?!' + inner + ')' + right
    }
  }
  checkedAllCases(ast)
}

// TODO: information is duplicated in parser:
function precLevel(nodeType: RegExpAST['type']) {
  switch (nodeType) {
    case 'epsilon': return 10
    case 'literal': return 10
    case 'capture-group': return 10

    case 'star': return 5
    case 'plus': return 5
    case 'optional': return 5
    case 'repeat': return 5

    case 'concat': return 4

    case 'lookahead': return 3

    case 'start-anchor': return 2
    case 'end-anchor': return 2

    case 'union': return 1
  }
  checkedAllCases(nodeType)
}

/**
 * AST nodes where no parenthesis have to be added when the parent has the same type.
 * E.g. in /a|(b|c)/ we can leave out the parenthesis /a|b|c/ but in /(a+)+/ the parenthesis
 * are needed, otherwise the expression is invalid.
 */
const needsNoParensOnSamePrecLevel = new Set([
  'concat',
  'positive-lookahead',
  'negative-lookahead',
  'start-anchor',
  'end-anchor',
  'union',
])

/**
 * Surrounds expression with parenthesis if necessary. For example, in `/(a)+|b/` the parenthesis
 * around `a` are not necessary because `+` has higher precedence than `|`. On the other hand,
 * in `/(a|b)+/` the parenthesis around `a|b` are necessary. Otherwise the expression has different
 * semantics.
 */
function maybeWithParens(ast: RegExpAST, parent: RegExpAST, options: RenderOptions): string {
  if (precLevel(ast.type) > precLevel(parent.type))
    return toString(ast, options)
  else if (precLevel(ast.type) === precLevel(parent.type) && needsNoParensOnSamePrecLevel.has(ast.type))
    return toString(ast, options)
  else if (options.useNonCapturingGroups)
    return '(?:' + toString(ast, options) + ')'
  else
    return '(' + toString(ast, options) + ')'
}

