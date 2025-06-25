import fc from "fast-check"
import { describe, it, expect, test } from "vitest"
import { CacheOverflowError, VeryLargeSyntaxTreeError } from '../src/regex'
import * as RE from "../src/regex"
import { RB, RegexBuilder } from "../src/index"
import * as Arb from './arbitrary-regex'
import { toStdRegex } from "src/dfa"

/**
 * Stochastically verifies that `regex1` is a subset of `regex2`.
 * It samples a bunch of matches from `regex1` and checks whether
 * they match `regex2` as well. If a mismatch is found it is returned.
 * Otherwise, `undefined` is returned.
 */
function expectSubsetOf(regex1: RegexBuilder, regex2: RegexBuilder, maxSamples = 30) {
  try {
    const re2 = regex2.toRegExp()
    for (const match1 of regex1.enumerate().take(maxSamples)) {
      expect(match1).toMatch(re2)
    }
  } catch (e) {
    if (e instanceof VeryLargeSyntaxTreeError) {
      console.warn(e)
      fc.pre(false)
    } else if (e instanceof CacheOverflowError) {
      console.warn(e)
      fc.pre(false)
    } else {
      throw e
    }     
  }
}

describe('toStdRegex', () => {

  it('is idempotent on StdRegex', () => {
    fc.assert(
      fc.property(
        Arb.stdRegex(),
        regex => {
          try {
            const inputRegex = RB(regex)
            const outputRegex = RB(toStdRegex(regex))
            expectSubsetOf(inputRegex, outputRegex)
            expectSubsetOf(outputRegex, inputRegex)
          } catch (e) {
            if (e instanceof CacheOverflowError) {
              console.warn(e)
              fc.pre(false)
            } else {
              throw e
            }     
          }
        }
      ),
      { numRuns: 100, maxSkipsPerRun: 100 }
    )
  }, 10_000)

})

describe('isEquivalent', () => {

  test.each([
    [/a+/, /a{1,}/],
    [/(a|b|c)*/, /(((ab)*)*c*)*/],
  ])('%s is equivalent to %s', (re1, re2) => {
    expect(RB(re1).isEquivalent(re2)).toBe(true)
  })

  test.each([
    [/a{2}|a*/,  /a(a|a*)/],
  ])('%s is not equivalent to %s', (re1, re2) => {
    expect(RB(re1).isEquivalent(re2)).toBe(false)
  })
})


test('A ∩ ¬A = ∅', () => {
  fc.assert(
    fc.property(
      Arb.stdRegex(),
      inputRegex => {
        try {
          const regexA = RB(inputRegex)
          const outputRegex = regexA.and(regexA.not())
          expect(outputRegex.isEmpty()).toBe(true)
        } catch (e) {
          if (e instanceof CacheOverflowError) {
            console.warn(e)
            fc.pre(false)
          } else {
            throw e
          }     
        }
      },
    ),
  )
})

test('B ⊆ (A ∪ B) ∩ (B ∪ C)', () => {
  fc.assert(
    fc.property(
      Arb.stdRegex(),
      Arb.stdRegex(),
      Arb.stdRegex(),
      (regexA, regexB, regexC) => {
        const unionAB = RB(regexA).or(regexB)
        const unionBC = RB(regexB).or(regexC)
        const interRegex = RB(unionAB).and(unionBC)
        expectSubsetOf(RB(regexB), interRegex)
      }
    ),
  )   
})

test('intersection with regex /^.{N}$/ has only words of length N', () => {
  fc.assert(
    fc.property(
      fc.nat({ max: 10 }),
      Arb.stdRegex(),
      (length, regexA) => {
        const regexB = RB(RE.anySingleChar).repeat(length)
        const interAB = RB(regexA).and(regexB)

        try {
          for (const word of interAB.enumerate().take(100)) {
            expect(word).toHaveLength(length)
          }
        } catch (e) {
          if (e instanceof CacheOverflowError) {
            console.warn(e)
            fc.pre(false)
          } else {
            throw e
          }     
        }
      }
    ),
  )   
})
