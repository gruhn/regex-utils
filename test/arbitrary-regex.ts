import fc from 'fast-check'
import * as RE from '../src/regex'
import * as CharSet from '../src/char-set'
import { checkedAllCases } from '../src/utils'

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

export function literal(): fc.Arbitrary<RE.StdRegex> {
  return charSet().map(RE.literal)
}

function concat(childArb: () => fc.Arbitrary<RE.StdRegex>): fc.Arbitrary<RE.StdRegex> {
  return fc.tuple(childArb(), childArb())
    .map(([ left, right ]) => RE.concat(left, right))
}

function union(childArb: () => fc.Arbitrary<RE.StdRegex>): fc.Arbitrary<RE.StdRegex> {
  return fc.tuple(childArb(), childArb())
    .map(([ left, right ]) => RE.union(left, right))
}

function star(innerArb: () => fc.Arbitrary<RE.StdRegex>): fc.Arbitrary<RE.StdRegex> {
  return innerArb().map(inner => RE.star(inner))
}

export function stdRegex(size = 100): fc.Arbitrary<RE.StdRegex> {
  if (size <= 0)
    return literal()
  else
    return fc.oneof(
      star(() => stdRegex(Math.floor(size/2))),
      concat(() => stdRegex(Math.floor(size/2))),
      union(() => stdRegex(Math.floor(size/2))),
      literal(),
    )
}

export function stdRegexNoStar(size = 100): fc.Arbitrary<RE.StdRegex> {
  if (size <= 0)
    return literal()
  else
    return fc.oneof(
      concat(() => stdRegexNoStar(Math.floor(size/2))),
      union(() => stdRegexNoStar(Math.floor(size/2))),
      literal(),
    )
}

export function stdRegexNoNestedStar(size = 100): fc.Arbitrary<RE.StdRegex> {
  if (size <= 0)
    return literal()
  else
    return fc.oneof(
      star(() => stdRegexNoStar(Math.floor(size/2))),
      concat(() => stdRegexNoNestedStar(Math.floor(size/2))),
      union(() => stdRegexNoNestedStar(Math.floor(size/2))),
      literal(),
    )
}

export function stdRegexString(): fc.Arbitrary<string> {
  return stdRegex().map(RE.toString)
}

