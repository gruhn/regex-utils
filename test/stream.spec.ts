import * as Stream from '../src/stream'
import { describe, test, expect } from 'vitest'

function pair<A,B>(a: A, b: B): [A,B] {
  return [a,b]
}

/**
 * `diagonalize` specialized to arrays for more convenient testing.
 */
function diagonalizeArray<A,B>(arrayA: A[], arrayB: B[]): [A,B][] {
  return [...Stream.values(
    Stream.diagonalize(
      pair,
      Stream.fromArray(arrayA),
      Stream.fromArray(arrayB),
    )
  )]
}

describe('diagonalize', () => {

  test('two finite lists of equal length', () => {
    expect(diagonalizeArray([1,2,3], ['a','b','c'])).toEqual([
      [1,'a'],
      [2,'a'], [1,'b'],
      [3,'a'], [2,'b'], [1,'c'],
      [3,'b'], [2,'c'],
      [3,'c']
    ])
  })

  test('two finite lists of unequal length', () => {
    expect(diagonalizeArray([1,2,3], ['a','b'])).toEqual([
      [1,'a'], 
      [2,'a'], [1,'b'],
      [3,'a'], [2,'b'],
      [3,'b']
    ])
  })

  test('with left stream empty', () => {
    expect(diagonalizeArray([1,2,3], [])).toEqual([])
  })

  test('with right stream empty', () => {
    expect(diagonalizeArray([], ['a','b','c'])).toEqual([])
  })
  
})



