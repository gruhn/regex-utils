import * as CharSet from './char-set'
import * as RE from './regex'
import { UnsupportedSyntaxError } from './regex-parser'
import { assert, assertSubtype, checkedAllCases } from './utils'

/**
 * TODO: docs
 *
 * @public
 */
export type RepeatBounds =
  | number
  | { min: number, max?: number }
  | { min?: number, max: number }

export enum AssertionSign { POSITIVE, NEGATIVE }

export enum AssertionDir { AHEAD, BEHIND }

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
  | { type: "assertion", direction: AssertionDir, sign: AssertionSign, inner: RegExpAST, outer: RegExpAST }
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
type InterAST_stage1 =
  | ExtRegexNode
  | { type: "epsilon" }
  | { type: "literal", charset: CharSet.CharSet }
  | { type: "concat", left: InterAST_stage1, right: InterAST_stage1 }
  | { type: "union", left: InterAST_stage1, right: InterAST_stage1 }
  | { type: "star", inner: InterAST_stage1 }
  | { type: "plus", inner: InterAST_stage1 }
  | { type: "optional", inner: InterAST_stage1 }
  | { type: "repeat", inner: InterAST_stage1, bounds: RepeatBounds }
  | { type: "capture-group", name?: string, inner: InterAST_stage1 }
  | { type: "assertion", direction: AssertionDir, sign: AssertionSign, inner: InterAST_stage1, outer: InterAST_stage1 }
  | { type: "start-anchor", left: InterAST_stage1, right: InterAST_stage1 }
  | { type: "end-anchor", left: InterAST_stage1, right: InterAST_stage1 }

assertSubtype<RegExpAST, InterAST_stage1>()

/**
 * Stage 2:
 * - "plus", "repeat", "optional", "capture-group" are desugared
 * - "epsilon", "literal" are always converted to "ext-regex" nodes
 * - nullable "lookahead" nodes are eliminated
 * - "assertion" nodes always have positive sign and have ExtRegex `inner` expressions.
 */
type InterAST_stage2 =
  | ExtRegexNode
  | { type: "concat", left: InterAST_stage2, right: InterAST_stage2 }
  | { type: "union", left: InterAST_stage2, right: InterAST_stage2 }
  | { type: "star", inner: InterAST_stage2 }
  | { type: "assertion", direction: AssertionDir, sign: typeof AssertionSign.POSITIVE, inner: ExtRegexNode, outer: InterAST_stage2 }
  | { type: "start-anchor", left: InterAST_stage2, right: InterAST_stage2 }
  | { type: "end-anchor", left: InterAST_stage2, right: InterAST_stage2 }

assertSubtype<InterAST_stage2, InterAST_stage1>()

/**
 * Stage 3:
 * - start- and end anchors are eliminated
 */
type InterAST_stage3 =
  | ExtRegexNode
  | { type: "concat", left: InterAST_stage3, right: InterAST_stage3 }
  | { type: "union", left: InterAST_stage3, right: InterAST_stage3 }
  | { type: "star", inner: InterAST_stage3 }
  | { type: "assertion", direction: AssertionDir, sign: typeof AssertionSign.POSITIVE, inner: ExtRegexNode, outer: InterAST_stage3 }

assertSubtype<InterAST_stage3, InterAST_stage2>()

export type RenderOptions = {
  useNonCapturingGroups: boolean
}

//////////////////////////////////////////////
///// Mapping: AST -> ExtRegex           /////
//////////////////////////////////////////////

function isNullable(ast: InterAST_stage2): boolean {
  switch (ast.type) {
    case "ext-regex": return RE.isNullable(ast.content)
    case "concat": return isNullable(ast.left) && isNullable(ast.right)
    case "union": return isNullable(ast.left) || isNullable(ast.right)
    case "star": return true
    // case "lookahead": return (
    //   isNullable(ast.right) &&
    //   isNullable(ast.inner) === ast.isPositive
    // )
    case "assertion": return false // in stage 2, `inner` is always non-nullable
    case "start-anchor": return isNullable(ast.left) && isNullable(ast.right)
    case "end-anchor": return isNullable(ast.left) && isNullable(ast.right)
  }
  checkedAllCases(ast)
}

export function traverseDepthFirst(ast: RegExpAST, fn: (node: RegExpAST) => RegExpAST): RegExpAST {
  const astNew = fn(ast)
  switch (astNew.type) {
    case 'epsilon': return astNew
    case 'literal': return astNew
    case 'concat': return concat(traverseDepthFirst(astNew.left, fn), traverseDepthFirst(astNew.right, fn))
    case 'union': return union(traverseDepthFirst(astNew.left, fn), traverseDepthFirst(astNew.right, fn))
    case 'star': return star(traverseDepthFirst(astNew.inner, fn))
    case 'plus': return plus(traverseDepthFirst(astNew.inner, fn))
    case 'optional': return optional(traverseDepthFirst(astNew.inner, fn))
    case 'repeat': return repeat(traverseDepthFirst(astNew.inner, fn), astNew.bounds)
    case 'capture-group': return captureGroup(traverseDepthFirst(astNew.inner, fn), astNew.name)
    case 'assertion': return assertion(astNew.direction, astNew.sign, traverseDepthFirst(astNew.inner, fn), traverseDepthFirst(astNew.outer, fn))
    case 'start-anchor': return startAnchor(traverseDepthFirst(astNew.left, fn), traverseDepthFirst(astNew.right, fn))
    case 'end-anchor': return endAnchor(traverseDepthFirst(astNew.left, fn), traverseDepthFirst(astNew.right, fn))
    default: checkedAllCases(astNew)
  }
}

function simplify(ast: RegExpAST): InterAST_stage2 {
  switch (ast.type) {
    case 'epsilon': return extRegex(RE.epsilon)
    case 'literal': return extRegex(RE.literal(ast.charset))
    case 'concat': return concat(simplify(ast.left), simplify(ast.right))
    case 'union': return union(simplify(ast.left), simplify(ast.right))
    case 'star': return star(simplify(ast.inner))
    case 'start-anchor': return startAnchor(simplify(ast.left), simplify(ast.right))
    case 'end-anchor': return endAnchor(simplify(ast.left), simplify(ast.right))
    case 'assertion': {
      // Don't know how to handle anchors inside lookaheads/lookbehinds yet.
      // So throwing an UnsupportedSyntaxError if we encounter any:
      traverseDepthFirst(ast.inner, node => {
        if (node.type === 'start-anchor')
          throw new UnsupportedSyntaxError('start anchors inside lookahead/lookbehind like (?=^a)')
        else if (node.type === 'end-anchor')
          throw new UnsupportedSyntaxError('end anchors inside lookahead/lookbehind like (?=a$)')
        else if (node.type === 'assertion')
          throw new UnsupportedSyntaxError('nested lookahead/lookbehind like (?=a(?=b))')
        else
          return node
      })

      // Convert `ast.inner` to `ExtRegex` so we take its `complement`.
      // That way, we can turn negative lookaheads/lookbehinds into positive ones.
      const inner = ((): RE.ExtRegex => {
        if (ast.direction === AssertionDir.AHEAD) {
          // For lookaheads we need to add a start anchor to `ast.inner` otherwise `toExtRegex` will add a `.*` at the start.
          // That's because a normal regex like /abc/ has an implicit `.*` at the start/end.
          // But in a lookahead like `(?=abc)` the inner expression does not have an implicit `.*` at the start.
          // It has one at the end though so we allow `toExtRegex` to add `.*` at the end.
          return toExtRegex(startAnchor(epsilon, ast.inner))
        } else {
          // Conversely, for lookbehinds we need to add an end anchor to `ast.inner`.
          // In a lookbehind like `(?<=abc)` the inner expression does not have an implicit `.*` at the end,
          // but it has one at the start.
          return toExtRegex(endAnchor(ast.inner, epsilon))
        }
      })()

      if (RE.isNullable(inner)) {
        // If the inner expression is nullable then it can always match the empty string. So ...
        if (ast.sign === AssertionSign.POSITIVE) {
          // ... positive lookaheads/lookbehinds like `(?=b*)c` always succeed.
          // Thus, we can just ignore them:
          return simplify(ast.outer) // i.e. `c`
        } else {
          // ... negative lookaheads/lookbehinds like `a(?!b*)c` always fail.
          // Thus, the whole expression collapses to the empty set:
          return empty()
        }
      } else {
        const outer = simplify(ast.outer)
        if (ast.sign === AssertionSign.POSITIVE) {
          return assertion(ast.direction, AssertionSign.POSITIVE, extRegex(inner), outer)
        } else {
          // Normalize negative lookahead/lookbehind `(?!inner)` into positive lookahead/lookbehind `(?=~inner)`:
          return assertion(ast.direction, AssertionSign.POSITIVE, extRegex(RE.complement(inner)), outer)
        }
      }
    }
    case 'capture-group': return simplify(ast.inner)
    case 'optional':
      // `a?` ==> `ε|a`
      return union(extRegex(RE.epsilon), simplify(ast.inner))
    case 'plus': {
      const inner = simplify(ast.inner)
      // `a+` ==> `aa*`
      return concat(inner, star(inner))
    }
    case 'repeat': {
      const inner = simplify(ast.inner)
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
function desugarRepeatNode(ast: InterAST_stage2, min: number, max: number): InterAST_stage2 {
  const requiredPrefix = seq(Array(min).fill(ast))

  if (max === Infinity)
    return concat(requiredPrefix, star(ast))
  else
    return concat(
      requiredPrefix,
      seq(Array(max - min).fill(union(extRegex(RE.epsilon), ast)))
    )
}

function pullUpStartAnchor(ast: InterAST_stage2, isLeftClosed: boolean): InterAST_stage2 {
  switch (ast.type) {
    case "ext-regex": return ast
    case "concat": {
      const right = pullUpStartAnchor(ast.right, true)
      if (right.type === 'start-anchor') {
        // Expression has the form `l(rl^rr)`.
        // Pull up the anchor directly (i.e. `lrl^rr`) then call `pullUpStartAnchor` again
        // to re-use the logic in the "startAnchor" case:
        return pullUpStartAnchor(startAnchor(concat(ast.left, right.left), right.right), isLeftClosed)
      }

      // Otherwise, `right` is start-anchor free. Check if `left` contains any:
      const left = pullUpStartAnchor(ast.left, isLeftClosed)
      if (left.type === 'start-anchor') {
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
      if (left.type === 'start-anchor') {
        if (right.type === 'start-anchor')
          // Expression has the form `(^l|^r)`:
          return startAnchor(extRegex(RE.epsilon), union(left.right, right.right)) // i.e. `^(l|r)`
        else if (isLeftClosed)
          // Expression has the form `p(^l|r)`:
          throw new UnsupportedSyntaxError('union with non-empty prefix where only some members have anchors like a(^b|c)')
        else
          // Expression has the form `(^l|r)`:
          return startAnchor(extRegex(RE.epsilon), union(left.right, concat(dotStar(), right))) // i.e. `^(l|.*r)`
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
          throw new UnsupportedSyntaxError('start anchor inside quantifier with non-empty prefix like a(^b)*')
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
    case "assertion": {
      if (ast.direction === AssertionDir.AHEAD) {
        const right = pullUpStartAnchor(ast.outer, true) // TODO: double-check if `true` is correct here
        if (right.type === 'start-anchor') {
          // Expression has the form `(?=i)(^r)`.
          // After `simplify` all lookaheads should be non-nullable and positive.
          // Thus, `i` can't match anything _before_ a start anchor and the whole expression collapses to the empty set.
          return empty()
        } else {
          // Expression has the form `(?=i)r` so no start anchor to deal with:
          return assertion(ast.direction, ast.sign, ast.inner, right)
        }
      } else {
        const left = pullUpStartAnchor(ast.outer, isLeftClosed)
        if (left.type === 'start-anchor') {
          // Expression has the form `(^l)(?<=i)`.
          // We can just pull the start anchor to the top:
          return startAnchor(extRegex(RE.epsilon), assertion(ast.direction, ast.sign, ast.inner, left.right)) // i.e. `^l(?<=i)`
        } else {
          // Expression has the form `l(?<=i)` so no start anchor to deal with:
          return assertion(ast.direction, ast.sign, ast.inner, left)
        }
      }
    }
  }
  checkedAllCases(ast)
}

function pullUpEndAnchor(ast: InterAST_stage2, isRightClosed: boolean): InterAST_stage2 {
  switch (ast.type) {
    case "ext-regex": return ast
    case "concat": {
      const left = pullUpEndAnchor(ast.left, true) // TODO: rather `isRightClosed || right != epsilon`
      if (left.type === 'end-anchor') {
        // Expression has the form `(ll$lr)r`.
        // Pull up the anchor directly (i.e. `ll$lrr`) then call `pullUpEndAnchor` again
        // to re-use the logic in the "endAnchor" case:
        return pullUpEndAnchor(endAnchor(left.left, concat(left.right, ast.right)), isRightClosed)
      }

      // Otherwise, `left` is end-anchor free. Check if `right` contains any:
      const right = pullUpEndAnchor(ast.right, isRightClosed)
      if (right.type === 'end-anchor') {
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
      if (left.type === 'end-anchor') {
        if (right.type === 'end-anchor')
          // Expression has the form `(l$|r$)`:
          return endAnchor(union(left.left, right.left), extRegex(RE.epsilon)) // i.e. `(l$|r$)`
        else if (isRightClosed)
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
    case "assertion": {
      if (ast.direction === AssertionDir.AHEAD) {
        const right = pullUpEndAnchor(ast.outer, isRightClosed)
        if (right.type === 'end-anchor') {
          // Expression has the form `(?=i)(r$)`.
          // We can just pull the end anchor to the top:
          return endAnchor(assertion(ast.direction, ast.sign, ast.inner, right.left), extRegex(RE.epsilon)) // i.e. `(?=i)r$`
        } else {
          // Expression has the form `(?=i)r` so no end anchor to deal with:
          return assertion(ast.direction, ast.sign, ast.inner, right)
        }
      } else {
        const left = pullUpEndAnchor(ast.outer, true) // TODO: double-check if `true` is correct here
        if (left.type === 'end-anchor') {
          // Expression has the form `(l$)(?<=i)`.
          // After `simplify` all lookbehinds should be non-nullable and positive.
          // Thus, `i` can't match anything _after_ an end anchor and the whole expression collapses to the empty set.
          return empty()
        } else {
          // Expression has the form `l(?<=i)` so no start anchor to deal with:
          return assertion(ast.direction, ast.sign, ast.inner, left)
        }
      }
    }
  }
  checkedAllCases(ast)
}

function intersection(nodeA: ExtRegexNode, nodeB: ExtRegexNode): ExtRegexNode {
  return extRegex(RE.intersection(nodeA.content, nodeB.content))
}

/**
 * Eliminates lookahead nodes by taking the intersection of the `inner`
 * expression with the `right` expression. E.g.
 *
 *     (?=a)b   -->   a&b
 *
 * When there are multiple lookaheads then they are eliminated right-to-left, e.g.
 *
 *    (?=a)b(?=c)d   --->   (?=a)b(c&d)  --->  a&(b(c&d))
 *
 * ## Background:
 *
 * Lookaheads act on sibling nodes. For example, the lookahead in `((?=ab)a)b` only has "a"
 * in it's `right` subtree but it also affects "b" which is in a sibling node.
 * The equivalent intersection is `(ab)&(ab)` not `((ab)&a)b`.
 * Thus, `eliminateLookaheads` needs access to it's entire `rightSibling` tree.
 *
 * Also, we can only compute the intersection of trees that are already lookahead-free
 * (i.e. for the form `ExtRegexNode`). By eliminating lookaheads right-to-left,
 * right subtrees are always lookahead-free.
 */
function eliminateLookaheads(ast: InterAST_stage3, rightSibling: ExtRegexNode): ExtRegexNode {
  switch (ast.type) {
    case "ext-regex": return concat(ast, rightSibling)
    case "assertion": {
      // Can't handle lookahead/lookbehind combinations:
      assert(ast.direction === AssertionDir.AHEAD)
      const right = eliminateLookaheads(ast.outer, rightSibling)
      return intersection(ast.inner, right)
    }
    case "concat": {
      const right = eliminateLookaheads(ast.right, rightSibling)
      return eliminateLookaheads(ast.left, right)
    }
    case "union": {
      const left = eliminateLookaheads(ast.left, rightSibling)
      const right = eliminateLookaheads(ast.right, rightSibling)
      return union(left, right)
    }
    case "star": {
      // We can't handle lookaheads inside quantifiers,
      // which must be the case if we encounter a "star" node here.
      // We don't need to recursively check child nodes.
      // That's because "star" nodes that don't contain lookaheads should be inside "extRegex" nodes.
      throw new UnsupportedSyntaxError('lookahead inside quantifier like (?=a)*')
    }
  }
  checkedAllCases(ast)
}
function eliminateLookbehinds(leftSibling: ExtRegexNode, ast: InterAST_stage3): ExtRegexNode {
  switch (ast.type) {
    case "ext-regex": return concat(leftSibling, ast)
    case "assertion": {
      // Can't handle lookahead/lookbehind combinations:
      assert(ast.direction === AssertionDir.BEHIND)
      const left = eliminateLookbehinds(leftSibling, ast.outer)
      return intersection(left, ast.inner)
    }
    case "concat": {
      const left = eliminateLookbehinds(leftSibling, ast.left)
      return eliminateLookbehinds(left, ast.right)
    }
    case "union": {
      const left = eliminateLookbehinds(leftSibling, ast.left)
      const right = eliminateLookbehinds(leftSibling, ast.right)
      return union(left, right)
    }
    case "star": {
      // We can't handle lookbehinds inside quantifiers,
      // which must be the case if we encounter a "star" node here.
      // We don't need to recursively check child nodes.
      // That's because "star" nodes that don't contain lookbehinds should be inside "extRegex" nodes.
      throw new UnsupportedSyntaxError('lookbehinds inside quantifier like (?<=a)*')
    }
  }
  checkedAllCases(ast)
}

export function toExtRegex(baseAST: RegExpAST): RE.ExtRegex {
  // First eliminate nodes like `plus`, `optional`, etc.
  const astDesugared = simplify(baseAST)

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

  // TODO: avoid type-cast
  const astStage3 = astNoAnchors as InterAST_stage3

  // If `astStage3` contains no lookahead/lookbehind assertions we are done:
  if (astStage3.type === 'ext-regex') {
    return astStage3.content
  }

  // Otherwise we try to eliminate lookaheads/lookbehinds.
  // We can do it if the expression contains only lookaheads or only lookbehinds but not both.
  // Combinations are trickier because they can "x-ray through each other".
  // For example, `^a(?=bc)b(?<=ab)c$` is equivalent to `^abc$`.
  // The lookahead "acts on" the "c" after the lookbehind
  // and the the lookbehind "acts on" the "a" before the lookahead.
  //
  // First try to eliminate lookaheads:
  try {
    return eliminateLookaheads(astStage3, extRegex(RE.epsilon)).content
  } catch (error) {
    if (error instanceof UnsupportedSyntaxError) {
      throw error
    } else {
      // `eliminateLookaheads` fails if it finds a lookbehind.
      // So try `eliminateLookbehind` instead:
      try {
        return eliminateLookbehinds(extRegex(RE.epsilon), astStage3).content
      } catch (error) {
        if (error instanceof UnsupportedSyntaxError) {
          throw error
        } else {
          // The expression contains both lookaheads and lookbehinds:
          throw new UnsupportedSyntaxError('lookahead/lookbehind combinations like (?=a)b(?<=c)')
        }
      }
    }
  }
}

//////////////////////////////////////////////
///// smart constructors                 /////
//////////////////////////////////////////////

function extRegex(re: RE.ExtRegex): ExtRegexNode {
  return { type: 'ext-regex', content: re }
}

export const epsilon: RegExpAST = { type: 'epsilon' }

export function startAnchor(left: InterAST_stage2, right: InterAST_stage2): InterAST_stage2
export function startAnchor(left: RegExpAST, right: RegExpAST): RegExpAST
export function startAnchor(left: InterAST_stage1, right: InterAST_stage1): InterAST_stage1 {
  return { type: 'start-anchor', left, right }
}


export function endAnchor(left: InterAST_stage3, right: InterAST_stage3): InterAST_stage3
export function endAnchor(left: InterAST_stage2, right: InterAST_stage2): InterAST_stage2
export function endAnchor(left: RegExpAST, right: RegExpAST): RegExpAST
export function endAnchor(left: InterAST_stage1, right: InterAST_stage1): InterAST_stage1 {
  return { type: 'end-anchor', left, right }
}

export function literal(charset: CharSet.CharSet): RegExpAST {
  return { type: 'literal', charset }
}

function empty(): ExtRegexNode {
  return extRegex(RE.empty)
}

function dotStar(): ExtRegexNode {
  return extRegex(RE.dotStar)
}

export function concat(left: ExtRegexNode, right: ExtRegexNode): ExtRegexNode
export function concat(left: InterAST_stage3, right: InterAST_stage3): InterAST_stage3
export function concat(left: InterAST_stage2, right: InterAST_stage2): InterAST_stage2
export function concat(left: RegExpAST, right: RegExpAST): RegExpAST
export function concat(left: InterAST_stage1, right: InterAST_stage1): InterAST_stage1 {
  if (left.type === 'ext-regex' && right.type === 'ext-regex')
    return extRegex(RE.concat(left.content, right.content))
  else
    return { type: 'concat', left, right }
}

function seq(array: InterAST_stage2[]): InterAST_stage2 {
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
export function union(left: InterAST_stage3 | undefined, right: InterAST_stage3 | undefined): InterAST_stage3
export function union(left: InterAST_stage3 | undefined, right: InterAST_stage3 | undefined): InterAST_stage3
export function union(left: InterAST_stage2 | undefined, right: InterAST_stage2 | undefined): InterAST_stage2
export function union(left: RegExpAST | undefined, right: RegExpAST | undefined): RegExpAST
export function union(left: InterAST_stage1 = epsilon, right: InterAST_stage1 = epsilon): InterAST_stage1 {
  if (left.type === 'ext-regex' && right.type === 'ext-regex')
    return extRegex(RE.union(left.content, right.content))
  else
    return { type: 'union', left, right }
}

export function star(inner: ExtRegexNode): ExtRegexNode
export function star(inner: InterAST_stage3): InterAST_stage3
export function star(inner: InterAST_stage3): InterAST_stage3
export function star(inner: InterAST_stage2): InterAST_stage2
export function star(inner: RegExpAST): RegExpAST
export function star(inner: InterAST_stage1): InterAST_stage1 {
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

/**
 * For lookahead assertions (i.e. `direction === AssertionDir.AHEAD`), `outer` is on the right.
 * For lookabehind assertions (i.e. `direction === AssertionDir.BEHIND`), `outer` is on the left.
 */
export function assertion(direction: AssertionDir, sign: typeof AssertionSign.POSITIVE, inner: ExtRegexNode, outer: InterAST_stage3): InterAST_stage3
export function assertion(direction: AssertionDir, sign: typeof AssertionSign.POSITIVE, inner: ExtRegexNode, outer: InterAST_stage2): InterAST_stage2
export function assertion(direction: AssertionDir, sign: AssertionSign, inner: RegExpAST, outer: RegExpAST): RegExpAST
export function assertion(direction: AssertionDir, sign: AssertionSign, inner: InterAST_stage1, outer: InterAST_stage1): InterAST_stage1 {
  return { type: 'assertion', direction, sign, inner, outer }
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

export function debugPrint(ast: InterAST_stage1): unknown {
  return console.debug(debugShow(ast))
}
export function debugShow(ast: InterAST_stage1): unknown {
  return JSON.stringify(debugShowAux(ast), null, 2)
}
function debugShowAux(ast: InterAST_stage1): unknown {
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
    case 'assertion':
      return {
        type: 'assertion',
        direction: ast.direction === AssertionDir.AHEAD ? "AHEAD" : "BEHIND",
        sign: ast.sign === AssertionSign.POSITIVE ? "POSITIVE" : "NEGATIVE",
        inner: debugShowAux(ast.inner),
        outer: debugShowAux(ast.outer),
      }
  }
  checkedAllCases(ast)
}

// TODO:
// - skip `^.*` and `.*$`
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
    case 'assertion': {
      if (ast.direction === AssertionDir.AHEAD) {
        const inner = toString(ast.inner, options)
        const right = maybeWithParens(ast.outer, ast, options)
        if (ast.sign === AssertionSign.POSITIVE)
          return '(?=' + inner + ')' + right
        else
          return '(?!' + inner + ')' + right
      } else {
        const inner = toString(ast.inner, options)
        const left = maybeWithParens(ast.outer, ast, options)
        if (ast.sign === AssertionSign.POSITIVE)
          return left + '(?<=' + inner + ')'
        else
          return left + '(?<!' + inner + ')'
      }
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

    case 'assertion': return 3

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

