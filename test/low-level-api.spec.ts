import fc from "fast-check"
import { describe, it, expect, test } from "vitest"
import { CacheOverflowError, isEmpty, VeryLargeSyntaxTreeError } from '../src/regex'
import * as RE from "../src/low-level-api"
import * as Arb from './arbitrary-regex'

/**
 * Stochastically verifies that `regex1` is a subset of `regex2`.
 * It samples a bunch of matches from `regex1` and checks whether
 * they match `regex2` as well. If a mismatch is found it is returned.
 * Otherwise, `undefined` is returned.
 */
function expectSubsetOf(regex1: RE.StdRegex, regex2: RE.StdRegex, maxSamples = 30) {
  const re2 = toRegExp_ignoreBlowUp(regex2)
  for (const match1 of RE.enumerate(regex1).take(maxSamples)) {
    expect(match1).toMatch(re2)
  }
}

function toRegExp_ignoreBlowUp(regex: RE.StdRegex) {
  try {
    return RE.toRegExp(regex)
  } catch (e) {
    if (e instanceof VeryLargeSyntaxTreeError) {
      console.warn(e)
      fc.pre(false)
    } else {
      throw e
    }     
  }
}

function toStdRegex_ignoreBlowUp(regex: RE.ExtRegex) {
  try {
    return RE.toStdRegex(regex)
  } catch (e) {
    if (e instanceof CacheOverflowError) {
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
        inputRegex => {
          const outputRegex = toStdRegex_ignoreBlowUp(inputRegex)
          expectSubsetOf(inputRegex, outputRegex)
          expectSubsetOf(outputRegex, inputRegex)
        }
      ),
      { numRuns: 100, maxSkipsPerRun: 100 }
    )
  }, 10_000)

})

test('A ∩ ¬A = ∅', () => {
  fc.assert(
    fc.property(
      Arb.stdRegex(),
      regexA => {
        const outputRegex = toStdRegex_ignoreBlowUp(
          RE.and([regexA, RE.not(regexA)])
        )
        expect(isEmpty(outputRegex)).toBe(true)
      }
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
        const unionAB = RE.or([regexA, regexB])
        const unionBC = RE.or([regexB, regexC])
        const interRegex = toStdRegex_ignoreBlowUp(RE.and([unionAB, unionBC]))
        expectSubsetOf(regexB, interRegex)
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
        const regexB = RE.repeat(RE.anySingleChar, length)
        const interAB = toStdRegex_ignoreBlowUp(RE.and([regexA, regexB]))

        for (const word of RE.enumerate(interAB).take(100)) {
          expect(word).toHaveLength(length)
        }
      }
    ),
  )   
})
