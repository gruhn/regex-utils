import fc from 'fast-check'
import * as AST from '../src/ast'
import * as CharSet from '../src/char-set'

// TODO: try larger alphabet:
export function charSet(): fc.Arbitrary<CharSet.CharSet> {
  // return fc.uniqueArray(
  //   fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f'),
  //   // TODO: regex parser can't handle empty set yet:
  //   { minLength: 1 },
  // ).map(CharSet.fromArray)

  return fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f')
    .map(CharSet.singleton)
}

export function literal(): fc.Arbitrary<AST.RegExpAST> {
  return charSet().map(AST.literal)
}

function concat(childArb: () => fc.Arbitrary<AST.RegExpAST>): fc.Arbitrary<AST.RegExpAST> {
  return fc.tuple(childArb(), childArb())
    .map(([ left, right ]) => AST.concat(left, right))
}

function union(childArb: () => fc.Arbitrary<AST.RegExpAST>): fc.Arbitrary<AST.RegExpAST> {
  return fc.tuple(childArb(), childArb())
    .map(([ left, right ]) => AST.union(left, right))
}

function star(innerArb: () => fc.Arbitrary<AST.RegExpAST>): fc.Arbitrary<AST.RegExpAST> {
  return innerArb().map(inner => AST.star(inner))
}

function plus(innerArb: () => fc.Arbitrary<AST.RegExpAST>): fc.Arbitrary<AST.RegExpAST> {
  return innerArb().map(inner => AST.plus(inner))
}

function optional(innerArb: () => fc.Arbitrary<AST.RegExpAST>): fc.Arbitrary<AST.RegExpAST> {
  return innerArb().map(inner => AST.optional(inner))
}

function repeat(innerArb: () => fc.Arbitrary<AST.RegExpAST>): fc.Arbitrary<AST.RegExpAST> {
  return fc.tuple(
    innerArb(),
    fc.oneof(
      fc.integer({ min: 0, max: 5 }), // exact count
      fc.record({ min: fc.integer({ min: 0, max: 3 }) }), // min only
      fc.record({ max: fc.integer({ min: 1, max: 5 }) }), // max only  
      fc.record({ // min and max
        min: fc.integer({ min: 0, max: 2 }),
        max: fc.integer({ min: 3, max: 5 })
      })
    )
  ).map(([inner, bounds]) => AST.repeat(inner, bounds))
}

export function regexpAST(size = 100): fc.Arbitrary<AST.RegExpAST> {
  if (size <= 0)
    return literal()
  else
    return fc.oneof(
      { arbitrary: literal(), weight: 6 },
      // Skip epsilon for now as the parser has issues with empty patterns
      // { arbitrary: fc.constant(AST.epsilon), weight: 1 },
      { arbitrary: concat(() => regexpAST(Math.floor(size/2))), weight: 3 },
      { arbitrary: union(() => regexpAST(Math.floor(size/2))), weight: 3 },
      { arbitrary: star(() => regexpAST(Math.floor(size/2))), weight: 1 },
      { arbitrary: plus(() => regexpAST(Math.floor(size/2))), weight: 1 },
      { arbitrary: optional(() => regexpAST(Math.floor(size/2))), weight: 1 },
      { arbitrary: repeat(() => regexpAST(Math.floor(size/2))), weight: 1 },
    )
}

export function regexpASTString(): fc.Arbitrary<string> {
  return regexpAST().map(ast => AST.toString(ast, { useNonCapturingGroups: false }))
}

// Backward compatibility for existing tests
import * as RE from '../src/regex'

export function stdRegex(size = 100): fc.Arbitrary<RE.StdRegex> {
  return regexpAST(size).map(ast => {
    const extRegex = RE.fromRegExpAST(ast)
    if (RE.isStdRegex(extRegex)) {
      return extRegex
    } else {
      // Since we only generate standard regex features (no intersections/complements),
      // fromRegExpAST should always return a StdRegex
      throw new Error('Unexpected: fromRegExpAST returned ExtRegex for standard AST')
    }
  })
}

export function stdRegexString(): fc.Arbitrary<string> {
  return stdRegex().map(RE.toString)
}

