import { describe, expect, test } from 'vitest'
import { Range, insertRange } from '../src/char-set'
import fc from 'fast-check'

const arbitraryRange = fc.tuple(fc.nat(30), fc.nat(30))
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
            .reduce(insertRange, [])

          expect(joinedBackTogether).toEqual([rangeA])
        }
      ),
    )
  })
  
})
