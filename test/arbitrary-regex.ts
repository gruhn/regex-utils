import fc from 'fast-check'
import * as RE from '../src/regex'
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
      { arbitrary: literal(), weight: 5 },
      { arbitrary: concat(() => stdRegex(Math.floor(size/2))), weight: 3 },
      { arbitrary: union(() => stdRegex(Math.floor(size/2))), weight: 3 },
      { arbitrary: star(() => stdRegex(Math.floor(size/2))), weight: 1 },
    )
}

export function stdRegexString(): fc.Arbitrary<string> {
  return stdRegex().map(RE.toString)
}

