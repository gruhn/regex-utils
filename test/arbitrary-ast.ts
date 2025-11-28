import fc from 'fast-check'
import * as AST from '../src/ast'
import * as CharSet from '../src/char-set'
import { checkedAllCases } from 'src/utils'

export function charSet(): fc.Arbitrary<CharSet.CharSet> {
  return fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f')
    .map(CharSet.singleton)
}

export function repeatBounds(): fc.Arbitrary<AST.RepeatBounds> {
  return fc.oneof(
    fc.nat({ max: 10 }),
    fc.record({ min: fc.nat({ max: 10 }) }),
    fc.record({ max: fc.nat({ max: 10 }) }),
    fc.record({ min: fc.nat({ max: 5 }), max: fc.integer({ min: 5, max: 10 }) })
  )
}

export function captureName(): fc.Arbitrary<string | undefined> {
  return fc.option(fc.stringMatching(/^[a-zA-Z_]\w{0,8}$/))
}

function epsilon(): fc.Arbitrary<AST.RegExpAST> {
  return fc.constant(AST.epsilon)
}

function literal(): fc.Arbitrary<AST.RegExpAST> {
  return charSet().map(AST.literal)
}

function concat(childArb: () => fc.Arbitrary<AST.RegExpAST>): fc.Arbitrary<AST.RegExpAST> {
  return fc.tuple(childArb(), childArb())
    .map(([left, right]) => AST.concat(left, right))
}

function union(childArb: () => fc.Arbitrary<AST.RegExpAST>): fc.Arbitrary<AST.RegExpAST> {
  return fc.tuple(childArb(), childArb())
    .map(([left, right]) => AST.union(left, right))
}

function star(innerArb: () => fc.Arbitrary<AST.RegExpAST>): fc.Arbitrary<AST.RegExpAST> {
  return innerArb().map(AST.star)
}

function plus(innerArb: () => fc.Arbitrary<AST.RegExpAST>): fc.Arbitrary<AST.RegExpAST> {
  return innerArb().map(AST.plus)
}

function optional(innerArb: () => fc.Arbitrary<AST.RegExpAST>): fc.Arbitrary<AST.RegExpAST> {
  return innerArb().map(AST.optional)
}

function repeat(innerArb: () => fc.Arbitrary<AST.RegExpAST>): fc.Arbitrary<AST.RegExpAST> {
  return fc.tuple(innerArb(), repeatBounds())
    .map(([inner, bounds]) => AST.repeat(inner, bounds))
}

function captureGroup(innerArb: () => fc.Arbitrary<AST.RegExpAST>): fc.Arbitrary<AST.RegExpAST> {
  return fc.tuple(innerArb(), captureName())
    .map(([inner, name]) => AST.captureGroup(inner, name))
}

function lookahead(childArb: () => fc.Arbitrary<AST.RegExpAST>): fc.Arbitrary<AST.RegExpAST> {
  return fc.tuple(fc.boolean(), childArb())
    .map(([isPositive, inner]) => AST.lookahead(isPositive, inner))
}

function lookbehind(childArb: () => fc.Arbitrary<AST.RegExpAST>): fc.Arbitrary<AST.RegExpAST> {
  return fc.tuple(fc.boolean(), childArb())
    .map(([isPositive, inner]) => AST.lookbehind(isPositive, inner))
}

function startAnchor(childArb: () => fc.Arbitrary<AST.RegExpAST>): fc.Arbitrary<AST.RegExpAST> {
  return fc.tuple(childArb(), childArb())
    .map(([left, right]) => AST.startAnchor(left, right))
}

function endAnchor(childArb: () => fc.Arbitrary<AST.RegExpAST>): fc.Arbitrary<AST.RegExpAST> {
  return fc.tuple(childArb(), childArb())
    .map(([left, right]) => AST.endAnchor(left, right))
}

/**
 * Traverses AST and renames capturing groups if the name already occurs in the expression.
 * `new RegExp(...)` throws an error when capture group names occur multiple times in the
 * same expression.
 */
export function makeCaptureGroupNamesUnique(ast: AST.RegExpAST): AST.RegExpAST {
  const seenNames = new Map<string, number>()

  function renameIfSeen(name: string) {
    const counter = seenNames.get(name)
    if (counter === undefined) {
      seenNames.set(name, 1)
      return name
    } else {
      const newName = `${name}_${counter + 1}`
      return renameIfSeen(newName)
    }
  }

  function traverse(node: AST.RegExpAST): AST.RegExpAST {
    switch (node.type) {
      case 'epsilon':
        return node
      case 'literal':
        return node
      case 'concat':
        return AST.concat(traverse(node.left), traverse(node.right))
      case 'union':
        return AST.union(traverse(node.left), traverse(node.right))
      case 'star':
        return AST.star(traverse(node.inner))
      case 'plus':
        return AST.plus(traverse(node.inner))
      case 'optional':
        return AST.optional(traverse(node.inner))
      case 'repeat':
        return AST.repeat(traverse(node.inner), node.bounds)
      case 'capture-group': {
        const innerProcessed = traverse(node.inner)

        if (node.name === undefined) {
          return AST.captureGroup(innerProcessed, node.name)
        } else {
          const nameProcessed = renameIfSeen(node.name)
          return AST.captureGroup(innerProcessed, nameProcessed)
        }
      }
      case 'lookahead':
        return AST.lookahead(node.isPositive, traverse(node.inner))
      case 'lookbehind':
        return AST.lookbehind(node.isPositive, traverse(node.inner))
      case 'start-anchor':
        return AST.startAnchor(traverse(node.left), traverse(node.right))
      case 'end-anchor':
        return AST.endAnchor(traverse(node.left), traverse(node.right))
      default:
        checkedAllCases(node)
    }
  }

  return traverse(ast)
}

export function regexpAST(size = 20): fc.Arbitrary<AST.RegExpAST> {
  return regexpAST_(size).map(makeCaptureGroupNamesUnique)
}
function regexpAST_(size: number): fc.Arbitrary<AST.RegExpAST> {
  if (size <= 1) {
    return fc.oneof(
      epsilon(),
      literal()
    )
  } else {
    const childSize = Math.floor(size / 2)
    return fc.oneof(
      { arbitrary: epsilon(), weight: 1 },
      { arbitrary: literal(), weight: 5 },
      { arbitrary: concat(() => regexpAST_(childSize)), weight: 3 },
      { arbitrary: union(() => regexpAST_(childSize)), weight: 3 },
      { arbitrary: star(() => regexpAST_(childSize)), weight: 1 },
      { arbitrary: plus(() => regexpAST_(childSize)), weight: 1 },
      { arbitrary: optional(() => regexpAST_(childSize)), weight: 1 },
      { arbitrary: repeat(() => regexpAST_(childSize)), weight: 1 },
      { arbitrary: captureGroup(() => regexpAST_(childSize)), weight: 2 },
      { arbitrary: lookahead(() => regexpAST_(childSize)), weight: 1 },
      { arbitrary: lookbehind(() => regexpAST_(childSize)), weight: 1 },
      { arbitrary: startAnchor(() => regexpAST_(childSize)), weight: 1 },
      { arbitrary: endAnchor(() => regexpAST_(childSize)), weight: 1 }
    )
  }
}

export function regexp(size?: number): fc.Arbitrary<RegExp> {
  return regexpAST(size).map(ast => new RegExp(AST.toString(ast, { useNonCapturingGroups: true })))
}
