import * as CharSet from './char-set'
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
  | { type: "positive-lookahead", inner: RegExpAST, right: RegExpAST }
  | { type: "negative-lookahead", inner: RegExpAST, right: RegExpAST }
  | { type: "start-marker", left: RegExpAST, right: RegExpAST }
  | { type: "end-marker", left: RegExpAST, right: RegExpAST  }

export type RenderOptions = {
  useNonCapturingGroups: boolean
}

const dotStar = star(literal(CharSet.wildcard({ dotAll: false })))

/**
 * 
 */
export function addImplicitStartMarker(ast: RegExpAST): RegExpAST {
  if (ast.type === 'union') {
    return union(addImplicitStartMarker(ast.left), addImplicitStartMarker(ast.right))
  } else if (ast.type === 'start-marker') {
    return ast
  } else if (ast.type === 'end-marker') {
    // Assuming end markers are always below start markers.
    // Should be guaranteed by the parser.
    return startMarker(undefined, concat(dotStar, ast))
  } else if (ast.type === 'capture-group') {
    return captureGroup(addImplicitStartMarker(ast.inner), ast.name)
  } else {
    assert(precLevel(ast.type) > precLevel('start-marker'))
    return startMarker(undefined, concat(dotStar, ast))
  }
}

/**
 * 
 */
export function addImplicitEndMarker(ast: RegExpAST): RegExpAST {
  if (ast.type === 'union') {
    return union(addImplicitEndMarker(ast.left), addImplicitEndMarker(ast.right))
  } else if (ast.type === 'start-marker') {
    return startMarker(ast.left, addImplicitEndMarker(ast.right))
  } else if (ast.type === 'end-marker') {
    return ast
  } else if (ast.type === 'capture-group') {
    return captureGroup(addImplicitEndMarker(ast.inner), ast.name)
  } else {
    assert(precLevel(ast.type) > precLevel('end-marker'))
    return endMarker(concat(ast, dotStar), undefined)
  }
}

//////////////////////////////////////////////
///// smart constructors                 /////
//////////////////////////////////////////////

export const epsilon: RegExpAST = { type: 'epsilon' }

export function startMarker(left: RegExpAST | undefined, right: RegExpAST | undefined): RegExpAST {
  return { type: 'start-marker', left: left ?? epsilon, right: right ?? epsilon }
}

export function endMarker(left: RegExpAST | undefined, right: RegExpAST | undefined): RegExpAST {
  return { type: 'end-marker', left: left ?? epsilon, right: right ?? epsilon }
}

export function literal(charset: CharSet.CharSet): RegExpAST {
  return { type: 'literal', charset }
}

export function concat(left: RegExpAST, right: RegExpAST): RegExpAST {
  return { type: 'concat', left, right }
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

export function positiveLookahead(
  inner: RegExpAST,
  right: RegExpAST,
): RegExpAST {
  return { type: 'positive-lookahead', inner, right }
}

export function negativeLookahead(
  inner: RegExpAST,
  right: RegExpAST,
): RegExpAST {
  return { type: 'negative-lookahead', inner, right }
}

//////////////////////////////////////////////
///// rendering                          /////
//////////////////////////////////////////////

function repeatBoundsToString(bounds: RepeatBounds): string {
  if (typeof bounds === 'number')
    return `{${bounds}}`
  else
    return `{${bounds.min ?? ''},${bounds.max ?? ''}}`
}

function captureGroupToString(name: string | undefined, inner: RegExpAST, options: RenderOptions) {
  if (name === undefined) 
    return `(${toString(inner, options)})`
  else 
    return `(?<${name}>${toString(inner, options)})`
}

export function debugShow(ast: RegExpAST): unknown {
  switch (ast.type) {
    case 'epsilon':
      return '';
    case 'start-marker':
      return { type: 'start-marker', left: debugShow(ast.left), right: debugShow(ast.right) }
    case 'end-marker':
      return { type: 'end-marker', left: debugShow(ast.left), right: debugShow(ast.right) }
    case 'literal':
      return CharSet.toString(ast.charset)
    case 'concat':
      return { type: 'concat', left: debugShow(ast.left), right: debugShow(ast.right) }
    case 'union':
      return { type: 'union', left: debugShow(ast.left), right: debugShow(ast.right) }
    case 'star':
      return { type: 'star', inner: debugShow(ast.inner) }
    case 'plus':
      return { type: 'plus', inner: debugShow(ast.inner) }
    case 'optional':
      return { type: 'optional', inner: debugShow(ast.inner) }
    case 'repeat':
      return { type: 'repeat', inner: debugShow(ast.inner), bounds: ast.bounds }
    case 'capture-group':
      return { type: 'capture-group', name: ast.name, inner: debugShow(ast.inner) }
    case 'positive-lookahead':
      return { type: 'positive-lookahead', inner: debugShow(ast.inner) }
    case 'negative-lookahead':
      return { type: 'negative-lookahead', inner: debugShow(ast.inner) }
  }
  checkedAllCases(ast)
}

export function toString(ast: RegExpAST, options: RenderOptions): string {
  switch (ast.type) {
    case 'epsilon':
      return ''
    case 'start-marker':
      return maybeWithParens(ast.left, ast, options) + '^' + maybeWithParens(ast.right, ast, options)
    case 'end-marker':
      return maybeWithParens(ast.left, ast, options) + '$' + maybeWithParens(ast.right, ast, options)
    case 'literal':
      return CharSet.toString(ast.charset)
    case 'concat':
      return maybeWithParens(ast.left, ast, options) + maybeWithParens(ast.right, ast, options)
    case 'union': 
      return maybeWithParens(ast.left, ast, options) + '|' + maybeWithParens(ast.right, ast, options)   
    case 'star':
      return maybeWithParens(ast.inner, ast, options) + '*'
    case 'plus':
      return maybeWithParens(ast.inner, ast, options) + '+'
    case 'optional':
      return maybeWithParens(ast.inner, ast, options) + '?'
    case 'repeat':
      return maybeWithParens(ast.inner, ast, options) + repeatBoundsToString(ast.bounds)
    case 'capture-group':
      return captureGroupToString(ast.name, ast.inner, options)
    case 'positive-lookahead':
      return '(?=' + toString(ast.inner, options) + ')' + maybeWithParens(ast.right, ast, options)
    case 'negative-lookahead':
      return '(?!' + toString(ast.inner, options) + ')' + maybeWithParens(ast.right, ast, options)
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

    case 'positive-lookahead': return 3
    case 'negative-lookahead': return 3

    case 'start-marker': return 2
    case 'end-marker': return 2

    case 'union': return 1
  }
  checkedAllCases(nodeType)
}

/**
 * Surrounds expression with parenthesis if necessary. For example, in `/(a)+|b/` the parenthesis
 * around `a` are not necessary because `+` has higher precedence than `|`. On the other hand,
 * in `/(a|b)+/` the parenthesis around `a|b` are necessary. Otherwise the expression has different
 * semantics.
 */
function maybeWithParens(ast: RegExpAST, parent: RegExpAST, options: RenderOptions): string {
  if (ast.type === parent.type || precLevel(ast.type) > precLevel(parent.type)) 
    return toString(ast, options)
  else if (options.useNonCapturingGroups)
    return '(?:' + toString(ast, options) + ')'
  else
    return '(' + toString(ast, options) + ')'
}

