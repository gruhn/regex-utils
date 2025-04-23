import * as Stream from '../src/stream'
import { describe, test, expect } from 'vitest'

function pair<A,B>(a: A, b: B): [A,B] {
  return [a,b]
}

function diagonalizeArray<A,B>(arrayA: A[], arrayB: B[]): [A,B][] {
  return [...Stream.toIterable(
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
      [1,'a'], [1,'b'], [2,'a'], [1,'c'], [2,'b'], [3,'a'], [2,'c'], [3,'b'], [3,'c']
    ])
  })

  test('two finite lists of unequal length', () => {
    expect(diagonalizeArray([1,2,3], ['a','b'])).toEqual([
      [1,'a'], [1,'b'], [2,'a'], [2,'b'], [3,'a'], [3,'b']
    ])
  })

  test('with one empty list', () => {
    expect(diagonalizeArray([1,2,3], [])).toEqual([])
  })
  
})



