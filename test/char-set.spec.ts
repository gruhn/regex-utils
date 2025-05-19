import { expect, test } from 'vitest'
import * as CharSet from '../src/char-set'
import fc from 'fast-check'
import * as Range from '../src/code-point-range'


const arbitraryRange: fc.Arbitrary<Range.CodePointRange> =
  fc.tuple(
    fc.integer({ min: 48, max: 122 }), // 0-9a-zA-Z
    fc.integer({ min: 48, max: 122 }),
  ).map(([start, end]) => ({ start, end }))

test('insertRange respects invariants', () => {
  fc.assert(
    fc.property(
      fc.array(arbitraryRange),
      (ranges) => {
        const charSet = ranges.reduce(CharSet.insertRange, CharSet.empty)
        CharSet.checkInvariants(charSet)
      }
    ),
  )
})

test('deleteRange respects invariants', () => {
  fc.assert(
    fc.property(
      arbitraryRange,
      fc.array(arbitraryRange),
      (deletedRange, ranges) => {
        const charSet = ranges.reduce(CharSet.insertRange, CharSet.empty)
        const result = CharSet.deleteRange(charSet, deletedRange)
        CharSet.checkInvariants(result)
      }
    ),
  )
})

test('(A \\ B) ⋃ (A ⋂ B) = A', () => { 
  fc.assert(
    fc.property(
      fc.array(arbitraryRange),
      fc.array(arbitraryRange),
      (rangesA, rangesB) => {
        const setA = rangesA.reduce(CharSet.insertRange, CharSet.empty)
        const setB = rangesB.reduce(CharSet.insertRange, CharSet.empty)

        const diffAB = CharSet.difference(setA, setB)
        const interAB = CharSet.intersection(setA, setB)
        const finalUnion = CharSet.union(diffAB, interAB)

        expect(finalUnion.hash.value).toBe(setA.hash.value)
      }
    ),
  )
})
