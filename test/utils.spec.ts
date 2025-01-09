import { diagonalize, diagonalStripes } from '../src/utils'
import { describe, test, expect } from 'vitest'


describe.skip('diagonalize', () => {

  test('two finite lists of equal length', () => {
    for (const stripe of diagonalStripes(pair, [1,2,3], ['a','b','c'])) {
      console.debug([...stripe])
    }

    expect([...diagonalize(pair, [1,2,3], ['a','b','c'])]).toEqual([
      [1,'a'], [1,'b'], [2,'a'], [1,'c'], [2,'b'], [3,'a'], [2,'c'], [3,'b'], [3,'c']
    ])
  })

  test('two finite lists of unequal length', () => {
    expect([...diagonalize(pair, [1,2,3], ['a','b'])]).toEqual([
      [1,'a'], [1,'b'], [2,'a'], [2,'b'], [3,'a'], [3,'b']
    ])
  })

  test('with one empty list', () => {
    expect([...diagonalize(pair, [1,2,3], [])]).toEqual([])
  })
  
})

describe('interleave', () => {

  test('two finite lists of equal length', () => {
    expect(diagonalize(pair, [1,2,3], ['a','b','c'])).toEqual([
      [1,'a'], [1,'b'], [2,'a'], [1,'c'], [2,'b'], [3,'a'], [2,'c'], [3,'b'], [3,'c']
    ])
  })

  test('two finite lists of unequal length', () => {
    expect(diagonalize(pair, [1,2,3], ['a','b'])).toEqual([
      [1,'a'], [1,'b'], [2,'a'], [2,'b'], [3,'a'], [3,'b']
    ])
  })
  
})


function pair<A,B>(a: A, b: B): [A,B] {
  return [a,b]
}
