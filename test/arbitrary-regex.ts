import fc from 'fast-check'
import * as RE from '../src/regex'
import * as CharSet from '../src/char-set'
import { checkedAllCases } from '../src/utils.ts'

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

function concat(size: number): fc.Arbitrary<RE.StdRegex> {
  return fc.tuple(stdRegex(size), stdRegex(size))
    .map(([ left, right ]) => RE.concat(left, right))
}

function union(size: number): fc.Arbitrary<RE.StdRegex> {
  return fc.tuple(stdRegex(size), stdRegex(size))
    .map(([ left, right ]) => RE.union(left, right))
}

function star(size: number): fc.Arbitrary<RE.StdRegex> {
  return stdRegex(size).map(inner => RE.star(inner))
}

export function stdRegex(size = 100): fc.Arbitrary<RE.StdRegex> {
  if (size <= 0)
    return literal()
  else
    return fc.oneof(
      star(Math.floor(size/2)),
      concat(Math.floor(size/2)),
      union(Math.floor(size/2)),
      literal(),
    )
}

export function stdRegexString(): fc.Arbitrary<string> {
  return stdRegex().map(RE.toString)
}

