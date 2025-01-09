import fc from 'fast-check'
import { describe, test, expect } from 'vitest'
import { extRegex } from './arbitrary-regex'
import * as RegexTree from '../src/regex-tree'

describe('fromRegExp', () => {
  test('is inverse of toRegExp', () => {
    fc.assert(
      fc.property(extRegex(), (tree) => {
        const regexp = RegexTree.toRegExp(tree)
        const result = RegexTree.equivalent(tree, RegexTree.fromRegExp(regexp))
        expect(result).toBe(true)
      })
    )
  })
})

describe('equivalent', () => {
  test('every regex is equivalent to itself', () => {
    fc.assert(
      fc.property(extRegex(), (tree) => {
        expect(RegexTree.equivalent(tree, tree)).toBe(true)
      })
    )
  })
})


describe('intersect', () => {
  test('two regex match a string if their intersection matches', () => {
    fc.assert(
      fc.property(
        extRegex(),
        extRegex(),
        (regex1, regex2) => {
          const intersectionRegex = RegexTree.intersect(regex1, regex2)
          expect(RegexTree.isSubsetOf(intersectionRegex, regex1)).toBe(true)
          expect(RegexTree.isSubsetOf(intersectionRegex, regex2)).toBe(true)
        }
      )
    )   
  })
})

describe('enumerate', () => {
  test('input regex matches all returned strings', () => {
    fc.assert(
      fc.property(
        extRegex(), 
        tree => {
          const regexp = RegexTree.toRegExp(tree)
          for (const str of RegexTree.enumerate(tree).take(30)) {
            expect(str).toMatch(regexp)
          }         
        }
      )
    )
  }) 
})
