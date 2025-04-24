import * as Stream from '../src/stream'
import { describe, test, expect } from 'vitest'

function pair<A,B>(a: A, b: B): [A,B] {
  return [a,b]
}

/**
 * `diagonalize` specialized to arrays for more convenient testing.
 */
function diagonalizeArray<A,B>(arrayA: A[], arrayB: B[]): [A,B][] {
  return Stream.toArray(
    Stream.diagonalize(
      pair,
      Stream.fromArray(arrayA),
      Stream.fromArray(arrayB)
    )
  )
}

describe('diagonalize', () => {

  test('two infinite streams', () => {
    const allPairs = Stream.diagonalize(
      pair,
      Stream.range(1, Infinity),
      Stream.range(1, Infinity),
    )   

    const first10 = Stream.toArray(Stream.take(10, allPairs))

    expect(first10).toEqual([
      [1,1],
      [2,1], [1,2],
      [3,1], [2,2], [1,3],
      [4,1], [3,2], [2,3], [1,4]
    ])
  })

  test('left stream finite, right stream infinite', () => {
    const allPairs = Stream.diagonalize(
      pair,
      Stream.fromArray(['a', 'b', 'c']),
      Stream.range(1, Infinity),
    )   

    const first10 = Stream.toArray(Stream.take(10, allPairs))

    expect(first10).toEqual([
      ['a',1],
      ['b',1], ['a',2],
      ['c',1], ['b',2], ['a',3],
      ['c',2], ['b',3], ['a',4],
      ['c',3]
    ])
  })

  test('left stream infinite, right stream finite', () => {
    const allPairs = Stream.diagonalize(
      pair,
      Stream.range(1, Infinity),
      Stream.fromArray(['a', 'b', 'c']),
    )   

    const first10 = Stream.toArray(Stream.take(10, allPairs))

    expect(first10).toEqual([
      [1,'a'],
      [2,'a'], [1,'b'],
      [3,'a'], [2,'b'], [1,'c'],
      [4,'a'], [3,'b'], [2,'c'],
      [5,'a']
    ])
  })

  test('two finite streams, equal length', () => {
    expect(diagonalizeArray([1,2,3], ['a','b','c'])).toEqual([
      [1,'a'],
      [2,'a'], [1,'b'],
      [3,'a'], [2,'b'], [1,'c'],
      [3,'b'], [2,'c'],
      [3,'c']
    ])
  })

  test('two finite streams, unequal length', () => {
    expect(diagonalizeArray([1,2,3], ['a','b'])).toEqual([
      [1,'a'], 
      [2,'a'], [1,'b'],
      [3,'a'], [2,'b'],
      [3,'b']
    ])
  })

  test('left stream empty', () => {
    expect(diagonalizeArray([1,2,3], [])).toEqual([])
  })

  test('right stream empty', () => {
    expect(diagonalizeArray([], ['a','b','c'])).toEqual([])
  })
  
})

function interleaveArray<T>(arrayA: T[], arrayB: T[]): T[] {
  return Stream.toArray(
    Stream.interleave(
      Stream.fromArray(arrayA),
      Stream.fromArray(arrayB),
    )
  )
}

describe('interleave', () => {

  test('two infinite streams', () => {
    const stream = Stream.interleave(
      Stream.range(1, Infinity),
      Stream.range(1, Infinity),
    )   

    const first10 = Stream.toArray(Stream.take(10, stream))
    expect(first10).toEqual([1,1,2,2,3,3,4,4,5,5])
  })

  test('two finite streams, equal length', () => {
    expect(interleaveArray([1,3,5], [2,4,6])).toEqual([1,2,3,4,5,6])
  })

  test('two finite streams, unequal length', () => {
    expect(interleaveArray([1,3], [2,4,5,6])).toEqual([1,2,3,4,5,6])
  })

})

