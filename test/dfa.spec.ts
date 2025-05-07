import fc from "fast-check"
import { describe, it, expect, test } from "vitest"
import * as RE from "../src/regex"
import * as Arb from './arbitrary-regex'
import * as Stream from '../src/stream'
import * as CharSet from '../src/char-set'
import { toRegExp } from "../src/regex"
import { parseRegExp } from "../src/regex-parser"
import { toStdRegex } from "../src/dfa"
import { assert } from "../src/utils"

/**
 * Stochastically verifies that `regex1` is a subset of `regex2`.
 * It samples a bunch of matches from `regex1` and checks whether
 * they match `regex2` as well. If a mismatch is found it is returned.
 * Otherwise, `true` is returned.
 */
function isSubsetOf(regex1: RE.StdRegex, regex2: RE.StdRegex, maxSamples = 30): true | string {
  const re2 = RE.toRegExp(regex2)

  for (const match1 of Stream.take(maxSamples, RE.enumerate(regex1))) {
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
          const outputRegex = toStdRegex(inputRegex)
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
        const outputRegex = toStdRegex(
          RE.intersection(
            regexA,
            RE.complement(regexA)
          )
        )
        expect(RE.isEmpty(outputRegex)).toBe(true)
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
        const unionAB = RE.union(regexA, regexB)
        const unionBC = RE.union(regexB, regexC)

        const interRegex = toStdRegex(RE.intersection(unionAB, unionBC))
        expect(isSubsetOf(regexB, interRegex)).toBe(true)
      }
    ),
    // { seed: 1125268176, path: "0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:1:1:1:1:1:1:1:1:1:0:2:2:2:2:2:2:2:2:2:2:2:2:2:2:2:2:2:2:2:2:2:2", endOnFailure: true }
  )   
})

test('intersection with regex /^.{N}$/ has only words of length N', () => {
  fc.assert(
    fc.property(
      fc.nat({ max: 10 }),
      Arb.stdRegexNoStar(),
      (length, regexA) => {
        const regexB = RE.replicate(length, length, RE.anySingleChar)
        const interAB = toStdRegex(RE.intersection(regexA, regexB))

        const samples = Stream.take(100, RE.enumerate(interAB))
        for (const word of samples) {
          expect(word).toHaveLength(length)
        }
      }
    ),
  )   
})
