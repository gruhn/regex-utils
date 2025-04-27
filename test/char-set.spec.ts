import { describe, expect, test } from 'vitest'
import * as CharSet from '../src/char-set'
import fc from 'fast-check'
import * as Range from '../src/code-point-range'

const arbitraryRange: fc.Arbitrary<Range.CodePointRange> =
  fc.tuple(fc.nat(30), fc.nat(30))
    .map(([start, length]) => ({ start, end: start + length }))

describe('Range', () => {

  test('joining the result of subtract(rangeA, rangeB) gives back rangeA', () => {
    fc.assert(
      fc.property(
        arbitraryRange,
        arbitraryRange,
        (rangeA, rangeB) => {
          const [before, intersection, after] = Range.subtract(rangeA, rangeB)
          const joinedBackTogether = [before, intersection, after]
            .filter(r => !Range.isEmpty(r))
            .reduce(CharSet.insertRange, CharSet.empty)

          expect(joinedBackTogether).toEqual([rangeA])
        }
      ),
    )
  })
  
})

const arbitraryCharSet: fc.Arbitrary<CharSet.CharSet> = fc.array(arbitraryRange)
  .map(ranges => ranges.reduce(CharSet.insertRange, CharSet.empty))

test('insertRange respects invariants', () => {
  fc.assert(
    fc.property(
      arbitraryCharSet,
      (charSet) => {
        CharSet.checkInvariants(charSet)
      }
    ),
  )
})

test('deleteRange respects invariants', () => {
  fc.assert(
    fc.property(
      arbitraryCharSet,
      arbitraryRange,
      (charSet, range) => {
        const result = CharSet.deleteRange(charSet, range)
        CharSet.checkInvariants(result)
      }
    ),
  )
})

test('(A \\ B) ⋃ (A ⋂ B) = A', () => { 
  fc.assert(
    fc.property(
      arbitraryCharSet,
      arbitraryCharSet,
      (setA, setB) => {
        const diffAB = CharSet.difference(setA, setB)
        const interAB = CharSet.intersection(setA, setB)
        expect(CharSet.union(diffAB, interAB)).toEqual(setA)
      }
    ),
  )
})
