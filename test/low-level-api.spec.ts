import fc from "fast-check"
import { describe, it, expect, test } from "vitest"
import { isEmpty } from '../src/regex'
import * as RE from "../src/low-level-api"
import * as Arb from './arbitrary-regex'
import * as Stream from '../src/stream'
import { assert } from "../src/utils"

/**
 * Stochastically verifies that `regex1` is a subset of `regex2`.
 * It samples a bunch of matches from `regex1` and checks whether
 * they match `regex2` as well. If a mismatch is found it is returned.
 * Otherwise, `true` is returned.
 */
function isSubsetOf(regex1: RE.StdRegex, regex2: RE.StdRegex, maxSamples = 30): true | string {
  const re2 = RE.toRegExp(regex2)

  for (const match1 of RE.enumerate(regex1).take(maxSamples)) {
    if (!re2.test(match1)) {
      return match1
    }
  }

  return true
}

describe('toStdRegex', () => {

  it('is idempotent on StdRegex', () => {
    fc.assert(
      fc.property(
        // FIXME: `star` often leads to exponential blow up.
        Arb.stdRegexNoStar(),
        inputRegex => {
          const outputRegex = RE.toStdRegex(inputRegex)
          expect(isSubsetOf(inputRegex, outputRegex)).toBe(true)
          expect(isSubsetOf(outputRegex, inputRegex)).toBe(true)
        }
      ),
    )
  })

})

test('A ∩ ¬A = ∅', () => {
  fc.assert(
    fc.property(
      Arb.stdRegexNoStar(),
      regexA => {
        const outputRegex = RE.toStdRegex(
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
      Arb.stdRegexNoStar(),
      Arb.stdRegexNoStar(),
      Arb.stdRegexNoStar(),
      (regexA, regexB, regexC) => {
        const unionAB = RE.or([regexA, regexB])
        const unionBC = RE.or([regexB, regexC])
        const interRegex = RE.toStdRegex(RE.and([unionAB, unionBC]))
        expect(isSubsetOf(regexB, interRegex)).toBe(true)
      }
    ),
  )   
})

test('intersection with regex /^.{N}$/ has only words of length N', () => {
  fc.assert(
    fc.property(
      fc.nat({ max: 10 }),
      Arb.stdRegexNoStar(),
      (length, regexA) => {
        const regexB = RE.repeat(RE.anySingleChar, length)
        const interAB = RE.toStdRegex(RE.and([regexA, regexB]))

        for (const word of RE.enumerate(interAB).take(100)) {
          expect(word).toHaveLength(length)
        }
      }
    ),
  )   
})
