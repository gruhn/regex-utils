import fc from 'fast-check'
import * as RE from '../src/extended-regex'
import * as CharSet from '../src/char-set'

// TODO: only singleton sets for currently:
export function charSet(): fc.Arbitrary<CharSet.CharSet> {
  return fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f')
    .map(CharSet.singleton)
}

export function extRegex(): fc.Arbitrary<RE.ExtRegex> {
  type LetrecBuilder = {
    epsilon: RE.ExtRegex
    literal: RE.ExtRegex
    concat: RE.ExtRegex
    union: RE.ExtRegex
    star: RE.ExtRegex
    intersection: RE.ExtRegex
    complement: RE.ExtRegex

    regex: RE.ExtRegex
  }

  const { regex } = fc.letrec<LetrecBuilder>(tie => ({
    epsilon: fc.record({
      type: fc.constant('epsilon'),
    }),
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
    intersection: fc.record({
      type: fc.constant('intersection'),
      left: tie('regex'),
      right: tie('regex'),
    }),
    star: fc.record({
      type: fc.constant('star'),
      inner: tie('regex'),
    }),
    complement: fc.record({
      type: fc.constant('complement'),
      inner: tie('regex'),
    }),

    // Listing leaf nodes first prevents infinite recursion:
    regex: fc.oneof(
      tie('epsilon'),
      tie('literal'),
      tie('concat'),
      tie('union'),
      tie('star'),
      tie('intersection'),
      tie('complement'),
    ),
  }))

  return regex
}
