import * as CharSet from './char-set'
import * as RE from './regex'
import { UnsupportedSyntaxError } from './regex-parser'
import { assert, checkedAllCases, isOneOf } from './utils'

/**
 * TODO: docs
 *
 * @public
 */
export type RepeatBounds =
  | number
  | { min: number, max?: number }
  | { min?: number, max: number }

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
  | { type: "lookahead", isPositive: boolean, inner: RegExpAST }
  | { type: "lookbehind", isPositive: boolean, inner: RegExpAST }
  | { type: "start-anchor", left: RegExpAST, right: RegExpAST }
  | { type: "end-anchor", left: RegExpAST, right: RegExpAST }

export type RenderOptions = {
  useNonCapturingGroups: boolean
}

const dotStar = star(literal(CharSet.wildcard({ dotAll: false })))

//////////////////////////////////////////////
///// Mapping: AST -> ExtRegex           /////
//////////////////////////////////////////////

function isNullable(ast: RegExpAST): boolean {
  switch (ast.type) {
    case "epsilon": return true
    case "literal": return false
    case "concat": return isNullable(ast.left) && isNullable(ast.right)
    case "union": return isNullable(ast.left) || isNullable(ast.right)
    case "star": return true
    case "plus": return isNullable(ast.inner)
    case "optional": return true
    case "repeat": {
      if (typeof ast.bounds === 'number') {
        return ast.bounds === 0 || isNullable(ast.inner)
      } else {
        const min = ast.bounds.min ?? 0
        return min === 0 || isNullable(ast.inner)
      }
    }
    case "capture-group": return isNullable(ast.inner)
    case "lookahead": return isNullable(ast.inner) // TODO: is this correct?
    case "lookbehind": return isNullable(ast.inner) // TODO: is this correct?
    case "start-anchor": return isNullable(ast.left) && isNullable(ast.right)
    case "end-anchor": return isNullable(ast.left) && isNullable(ast.right)
  }
  checkedAllCases(ast)
}

export const sugarNodeTypes = [
  'plus',
  'repeat',
  'optional',
  'capture-group',
] as const

function desugar(ast: RegExpAST): RegExpAST {
  switch (ast.type) {
    case 'epsilon': return epsilon
    case 'literal': return literal(ast.charset)
    case 'concat': return concat(desugar(ast.left), desugar(ast.right))
    case 'union': return union(desugar(ast.left), desugar(ast.right))
    case 'star': return star(desugar(ast.inner))
    case 'start-anchor': return startAnchor(desugar(ast.left), desugar(ast.right))
    case 'end-anchor': return endAnchor(desugar(ast.left), desugar(ast.right))
    case 'lookahead': return lookahead(ast.isPositive, desugar(ast.inner))
    case 'lookbehind': return lookbehind(ast.isPositive, desugar(ast.inner))
    // sugar nodes:
    case 'capture-group': return desugar(ast.inner)
    case 'plus': {
      const inner = desugar(ast.inner)
      return concat(inner, star(inner))
    }
    case 'optional': {
      const inner = desugar(ast.inner)
      return union(epsilon, inner)
    }
    case 'repeat': {
      const inner = desugar(ast.inner)
      if (ast.bounds === undefined) {
        return desugarRepeat(inner, 0, Infinity)
      } else if (typeof ast.bounds === 'number') {
        return desugarRepeat(inner, ast.bounds, ast.bounds)
      } else {
        const { min = 0, max = Infinity } = ast.bounds
        assert(0 <= min && min <= max)
        return desugarRepeat(inner, min, max)
      }

    }
  }
  checkedAllCases(ast)
}
function desugarRepeat(ast: RegExpAST, min: number, max: number): RegExpAST {
  const requiredPrefix = seq(Array(min).fill(ast))

  if (max === Infinity)
    return concat(requiredPrefix, star(ast))
  else
    return concat(
      requiredPrefix,
      seq(Array(max - min).fill(union(epsilon, ast)))
    )
}

function pullUpStartAnchor(ast: RegExpAST, isLeftClosed: boolean): RegExpAST {
  assert(!isOneOf(ast.type, sugarNodeTypes), `Got ${ast.type} node. Expected desugared AST.`)

  switch (ast.type) {
    case "epsilon": return ast
    case "literal": return ast
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
          return empty
        }
      } else if (left.type === 'start-anchor') {
        // Expression has the form `(^l)r` where `r` does not contain a start anchor.
        // We can just pull up the start-anchor:
        return startAnchor(undefined, concat(left.right, right)) // i.e. `^(lr)`
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
        return startAnchor(undefined, union(left.right, right.right)) // i.e. `^(l|r)`
      } else if (left.type === 'start-anchor') {
        if (isLeftClosed) {
          // Expression has the form `p(^l|r)`:
          throw new UnsupportedSyntaxError('union with non-empty prefix where only some members have anchors like a(^b|c)')
        } else {
          // Expression has the form `(^l|r)`:
          return startAnchor(undefined, union(left.right, concat(dotStar, right))) // i.e. `^(l|.*r)`
        }
      } else if (right.type === 'start-anchor') {
        if (isLeftClosed)
          // Expression has the form `p(l|^r)`:
          throw new UnsupportedSyntaxError('union with non-empty prefix where only some members have anchors like a(b|^c)')
        else
          // Expression has the form `(l|^r)`:
          return startAnchor(undefined, union(concat(dotStar, left), right.right)) // i.e. `^(.*l|r)`
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
          return startAnchor(undefined, union(dotStar, inner.right)) // i.e. `^(.*|r)`
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
        return empty
      } else if (left.type === 'end-anchor') {
        // Expression has the form `(l$)^r`. This can (at most) match epsilon,
        // if `r` is also nullable. Otherwise, this can't match anything:
        if (isNullable(right))
          return startAnchor(undefined, endAnchor(epsilon, undefined)) // i.e. `^$`
        else
          return empty
      } else if (right.type === 'start-anchor') {
        // Expression has the form `^(^r)`. Multiple start anchor don't introduce
        // a contradiction as long as there is nothing between them:
        return right // i.e. `^r`
      } else {
        // Expression has the form `^r` where `r` contain no start anchor:
        return startAnchor(undefined, right) // i.e. `^r`
      }
    }
    case "end-anchor": {
      const left = pullUpStartAnchor(ast.left, isLeftClosed)
      const right = pullUpStartAnchor(ast.right, true)

      if (!isNullable(ast.right)) {
        // Expression has the form `l$r` where `r` is not nullable. Thus, the whole
        // expression collapses to the empty set:
        return empty
      } else if (right.type === 'start-anchor') {
        // Expression has the form `l$(^r)`. This can (at most) match epsilon,
        // if both `l` is also nullable:
        if (isNullable(left))
          return startAnchor(undefined, endAnchor(epsilon, undefined)) // i.e `^$`
        else
          return empty
      } else if (left.type === 'start-anchor') {
        // Expression has the form `(^r)$`. We can just pull the start anchor to the top:
        return startAnchor(undefined, endAnchor(left.right, undefined)) // i.e. `^(r$)`
      } else {
        // Expression has the form `r$` where `r` contain no start anchor:
        return endAnchor(left, undefined)
      }
    }
    case "lookahead":
      // FIXME:
      // const inner = pullUpStartAnchor(ast.inner, true)
      // const right = pullUpStartAnchor(ast.right, isLeftClosed)
      // if (inner.type === 'start-anchor') {
      //   throw new UnsupportedSyntaxError('start anchors inside lookaheads like (?=^a)')
      // } else if (right.type === 'start-anchor') {
      //   return startAnchor(undefined, lookahead(ast.isPositive, ast.inner, right.right))
      // } else {
      //   return lookahead(ast.isPositive, inner, right)
      // }
      throw new UnsupportedSyntaxError('lookahead assertion')
    case 'lookbehind':
      throw new UnsupportedSyntaxError('lookbehind assertion')
  }
  checkedAllCases(ast.type)
}

function pullUpEndAnchor(ast: RegExpAST, isRightClosed: boolean): RegExpAST {
  assert(!isOneOf(ast.type, sugarNodeTypes), `Got ${ast.type} node. Expected desugared AST.`)

  switch (ast.type) {
    case "epsilon": return ast
    case "literal": return ast
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
          return empty
        }
      } else if (right.type === 'end-anchor') {
        // Expression has the form `l(r$)` where `l` does not contain an end anchor.
        // We can just pull up the end anchor:
        return endAnchor(concat(left, right.left), undefined) // i.e. `(lr)$`
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
        return endAnchor(union(left.left, right.left), undefined) // i.e. `(l$|r$)`
      } else if (left.type === 'end-anchor') {
        if (isRightClosed)
          // Expression has the form `(l$|r)s`:
          throw new UnsupportedSyntaxError('union with non-empty suffix where only some members have anchors like (a$|b)c')
        else
          // Expression has the form `(l$|r)`:
          return endAnchor(union(left.left, concat(right, dotStar)), undefined) // i.e. `(l|r.*)$`
      } else if (right.type === 'end-anchor') {
        // Expression has the form `(l|r$)s`:
        if (isRightClosed)
          throw new UnsupportedSyntaxError('union with non-empty suffix where only some members have anchors like (a|b$)c')
        else
          // Expression has the form `(l|r$)`:
          return endAnchor(union(concat(left, dotStar), right.left), undefined) // i.e. `(l.*|r)$`
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
          return endAnchor(union(dotStar, inner.left), undefined) // i.e. `(.*|l)$`
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
        return empty
      } else if (left.type === 'end-anchor') {
        // Expression has the form `(l$)^r`. This can (at most) match epsilon,
        // if `r` is also nullable:
        if (isNullable(right))
          return endAnchor(startAnchor(undefined, epsilon), undefined) // i.e `^$`
        else
          return empty
      } else if (right.type === 'end-anchor') {
        // Expression has the form `^(r$)`. We can just pull the end anchor to the top:
        return endAnchor(startAnchor(undefined, right.left), undefined) // i.e. `(^r)$`
      } else {
        // Expression has the form `^r` where `r` contain no end anchor:
        return startAnchor(undefined, right)
      }
    }
    case "end-anchor": {
      const left = pullUpEndAnchor(ast.left, true)
      const right = pullUpStartAnchor(ast.right, isRightClosed)

      if (!isNullable(right)) {
        // Expression has the form `l$r` where `r` is not nullable. Thus, the whole
        // expression collapses to the empty set:
        return empty
      } else if (right.type === 'start-anchor') {
        // Expression has the form `l$(^r)`. This can (at most) match epsilon,
        // if `l` is also nullable. Otherwise, this can't match anything:
        if (isNullable(left))
          return endAnchor(startAnchor(undefined, epsilon), undefined) // i.e. `^$`
        else
          return empty
      } else if (left.type === 'end-anchor') {
        // Expression has the form `(l$)$`. Multiple end anchor don't introduce
        // a contradiction as long as there is nothing between them:
        return left // i.e. `l$`
      } else {
        // Expression has the form `l$` where `l` contain no end anchor:
        return endAnchor(left, undefined) // i.e. `l$`
      }
    }
    case "lookahead":
      // FIXME:
      // const inner = pullUpEndAnchor(ast.inner, false)
      // const right = pullUpEndAnchor(ast.right, isRightClosed)
      // if (inner.type === 'end-anchor') {
      //   throw new UnsupportedSyntaxError('end anchors inside lookaheads like (?=a$)')
      // } else if (right.type === 'end-anchor') {
      //   return endAnchor(lookahead(ast.isPositive, ast.inner, right.left), undefined)
      // } else {
      //   return lookahead(ast.isPositive, inner, right)
      // }
      throw new UnsupportedSyntaxError('lookahead assertion')
    case "lookbehind":
      throw new UnsupportedSyntaxError('lookbehind assertion')
  }
  checkedAllCases(ast.type)
}

export function toExtRegex(ast: RegExpAST): RE.ExtRegex {
  // First eliminate nodes like `plus`, `optional`, etc.
  ast = desugar(ast)

  // Then eliminate start anchors by first pulling them to the top:
  ast = pullUpStartAnchor(ast, false)
  if (ast.type === 'start-anchor') {
    // If the root node is indeed a start anchor now, then start anchors have been
    // eliminated from all sub-expressions and we can just drop the root-level one:
    ast = ast.right
  } else {
    // If the root node is not a start anchor, then the expression contained
    // no start anchors anywhere and we have to prepend the implicit `.*`:
    ast = concat(dotStar, ast)
  }

  // Then eliminate end anchors by first pulling them to the top:
  ast = pullUpEndAnchor(ast, false)
  if (ast.type === 'end-anchor') {
    // If the root node is indeed an end anchor now, then end anchors have been
    // eliminated from all sub-expressions and we can just drop the root-level one:
    ast = ast.left
  } else {
    // If the root node is not a end anchor, then the expression contained
    // no end anchors anywhere and we have to append the implicit `.*`:
    ast = concat(ast, dotStar)
  }

  return toExtRegexAux(ast)
}
function toExtRegexAux(ast: RegExpAST): RE.ExtRegex {
  assert(!isOneOf(ast.type, sugarNodeTypes), `Got ${ast.type} node. Expected desugared AST.`)
  assert(ast.type !== 'start-anchor', `Unexpected start anchor. Should already be eliminated.`)
  assert(ast.type !== 'end-anchor', `Unexpected end anchor. Should already be eliminated.`)
  switch (ast.type) {
    case 'epsilon': return RE.epsilon
    case 'literal': return RE.literal(ast.charset)
    case 'concat': return RE.concat(toExtRegexAux(ast.left), toExtRegexAux(ast.right))
    case 'union': return RE.union(toExtRegexAux(ast.left), toExtRegexAux(ast.right))
    case 'star': return RE.star(toExtRegexAux(ast.inner))
    case 'lookahead':
      // FIXME:
      //   const inner = toExtRegexAux(ast.inner)
      //   const right = toExtRegexAux(ast.right)
      //   if (ast.isPositive)
      //     return RE.intersection(inner, right)
      //   else
      //     return RE.intersection(RE.complement(inner), right)
      throw new UnsupportedSyntaxError('lookahead assertion')
    case 'lookbehind':
      throw new UnsupportedSyntaxError('lookbehind assertion')
  }
  checkedAllCases(ast.type)
}

//////////////////////////////////////////////
///// smart constructors                 /////
//////////////////////////////////////////////

export const epsilon: RegExpAST = { type: 'epsilon' }

export function startAnchor(left: RegExpAST | undefined, right: RegExpAST | undefined): RegExpAST {
  return { type: 'start-anchor', left: left ?? epsilon, right: right ?? epsilon }
}

export function endAnchor(left: RegExpAST | undefined, right: RegExpAST | undefined): RegExpAST {
  return { type: 'end-anchor', left: left ?? epsilon, right: right ?? epsilon }
}

export function literal(charset: CharSet.CharSet): RegExpAST {
  return { type: 'literal', charset }
}

export const empty: RegExpAST = literal(CharSet.empty)

export function concat(left: RegExpAST, right: RegExpAST): RegExpAST {
  return { type: 'concat', left, right }
}

export function seq(asts: RegExpAST[]): RegExpAST {
  if (asts.length === 0)
    return epsilon
  else
    // Reducing right-to-left should trigger fewer normalization steps when converting to ExtRegex:
    return asts.reduceRight((right, left) => concat(left, right))
}

export function string(chars: string): RegExpAST {
  return seq(
    [...chars].map(
      char => RE.literal(CharSet.singleton(char))
    )
  )
}

export function union(left: RegExpAST | undefined, right: RegExpAST | undefined): RegExpAST {
  return { type: 'union', left: left ?? epsilon, right: right ?? epsilon }
}

export function star(inner: RegExpAST): RegExpAST {
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

export function lookahead(
  isPositive: boolean,
  inner: RegExpAST,
): RegExpAST {
  return { type: 'lookahead', isPositive, inner }
}

export function lookbehind(
  isPositive: boolean,
  inner: RegExpAST,
): RegExpAST {
  return { type: 'lookahead', isPositive, inner }
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

export function debugPrint(ast: RegExpAST): unknown {
  return console.debug(debugShow(ast))
}
export function debugShow(ast: RegExpAST): unknown {
  return JSON.stringify(debugShow_(ast), null, 2)
}
function debugShow_(ast: RegExpAST): unknown {
  switch (ast.type) {
    case 'epsilon':
      return '';
    case 'start-anchor':
      return { type: 'start-anchor', left: debugShow_(ast.left), right: debugShow_(ast.right) }
    case 'end-anchor':
      return { type: 'end-anchor', left: debugShow_(ast.left), right: debugShow_(ast.right) }
    case 'literal':
      return CharSet.toString(ast.charset)
    case 'concat':
      return { type: 'concat', left: debugShow_(ast.left), right: debugShow_(ast.right) }
    case 'union':
      return { type: 'union', left: debugShow_(ast.left), right: debugShow_(ast.right) }
    case 'star':
      return { type: 'star', inner: debugShow_(ast.inner) }
    case 'plus':
      return { type: 'plus', inner: debugShow_(ast.inner) }
    case 'optional':
      return { type: 'optional', inner: debugShow_(ast.inner) }
    case 'repeat':
      return { type: 'repeat', inner: debugShow_(ast.inner), bounds: ast.bounds }
    case 'capture-group':
      return { type: 'capture-group', name: ast.name, inner: debugShow_(ast.inner) }
    case 'lookahead':
      return { type: 'lookahead', isPositive: ast.isPositive, inner: debugShow_(ast.inner) }
    case 'lookbehind':
      return { type: 'lookbehind', isPositive: ast.isPositive, inner: debugShow_(ast.inner) }
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
      if (ast.isPositive)
        return '(?=' + inner + ')'
      else
        return '(?!' + inner + ')'
    }
    case 'lookbehind': {
      const inner = toString(ast.inner, options)
      if (ast.isPositive)
        return '(?<=' + inner + ')'
      else
        return '(?<!' + inner + ')'
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
    case 'lookahead': return 10
    case 'lookbehind': return 10

    case 'star': return 5
    case 'plus': return 5
    case 'optional': return 5
    case 'repeat': return 5

    case 'concat': return 4

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

