import fc from 'fast-check'
import * as RE from '../src/extended-regex'
import * as StdRegex from '../src/standard-regex'
import * as CharSet from '../src/char-set'
import { checkedAllCases } from '../src/utils.ts'

// TODO: try larger alphabet:
export function charSet(): fc.Arbitrary<CharSet.CharClass> {
  // return fc.uniqueArray(
  //   fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f'),
  //   // TODO: regex parser can't handle empty set yet:
  //   { minLength: 1 },
  // ).map(CharSet.fromArray)

  return fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f')
    .map(CharSet.singleton)
}

export function stdRegex(): fc.Arbitrary<StdRegex.StdRegex> {
  type LetrecBuilder = {
    // epsilon: StdRegex.StdRegex
    literal: StdRegex.StdRegex
    concat: StdRegex.StdRegex
    union: StdRegex.StdRegex
    star: StdRegex.StdRegex
    // intersection: RE.ExtRegex
    // complement: RE.ExtRegex

    regex: StdRegex.StdRegex
  }

  const { regex } = fc.letrec<LetrecBuilder>(tie => ({
    // epsilon: fc.record({
    //   type: fc.constant('epsilon'),
    // }),
    literal: fc.record({
      type: fc.constant('literal'),
      charset: charSet(),
    }),
    concat: fc.record({
      type: fc.constant('concat'),
      left: tie('regex'),
      right: tie('regex'),
    }),
    union: fc.record({
      type: fc.constant('union'),
      left: tie('regex'),
      right: tie('regex'),
    }),
    star: fc.record({
      type: fc.constant('star'),
      inner: tie('regex'),
    }),
    // intersection: fc.record({
    //   type: fc.constant('intersection'),
    //   left: tie('regex'),
    //   right: tie('regex'),
    // }),
    // complement: fc.record({
    //   type: fc.constant('complement'),
    //   inner: tie('regex'),
    // }),

    // Listing leaf nodes first prevents infinite recursion:
    regex: fc.oneof(
      // tie('epsilon'),
      tie('literal'),
      tie('concat'),
      tie('union'),
      tie('star'),
      // tie('intersection'),
      // tie('complement'),
    ),
  }))

  return regex
}

export function stdRegexString(): fc.Arbitrary<string> {
  return stdRegex().map(StdRegex.toString)
}

