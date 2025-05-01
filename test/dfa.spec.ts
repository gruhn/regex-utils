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
        Arb.stdRegexNoStar(100),
        inputRegex => {
          console.log(RE.toString(inputRegex))
          const startTime = performance.now()
          const outputRegex = toStdRegex(inputRegex)
          console.log('time', performance.now() - startTime)

          expect(isSubsetOf(inputRegex, outputRegex)).toBe(true)
          expect(isSubsetOf(outputRegex, inputRegex)).toBe(true)
        }
      ),
      { endOnFailure: true }
      // { seed: 1421202580, path: "0:0:0", endOnFailure: true }
      // { seed: 568057861, path: "0:0:0:0:0:0:0:0:0:0:0:0:0:0", endOnFailure: true }
      // { seed: 2050898313, path: "3:0:0:1:1:1:1:1:2:7:0:0:0:0:0:0:0:0:0:1:0:2:2:2:4:4:4:4:4:4:4:4", endOnFailure: true }
      // { seed: 149770099, path: "2:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:1:1:3:3:5:4:4:4:4:4:4:4:5:5:5:5:7:7:4:4:6:6:5:6:3:5:1", endOnFailure: true }
    )
  })

  it.only('debug', () => {
    const inputRegex = parseRegExp(/^(a|((d|(e|ce[a-b]))|(e[af]|[bd])(f|bc)))a([b-e][be]|bd(a|db))(ccafb|([ae]|(beaf|d)))$/)
    const outputRegex = toStdRegex(inputRegex)
    console.debug(RE.toString(inputRegex))
    // console.debug(RE.toString(outputRegex))
    console.debug(JSON.stringify(outputRegex, null, 2).length)
    // expect(isSubsetOf(inputRegex, outputRegex)).toBe(true)
    // expect(isSubsetOf(outputRegex, inputRegex)).toBe(true)
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
    { seed: 1125268176, path: "0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:1:1:1:1:1:1:1:1:1:0:2:2:2:2:2:2:2:2:2:2:2:2:2:2:2:2:2:2:2:2:2:2", endOnFailure: true }
  )   
})
