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

function stochasticEquiv(regex1: RE.StdRegex, regex2: RE.StdRegex): { left: string } | { right: string } | undefined {
  if (regex1.hash === regex2.hash) {
    return undefined
  }

  const re1 = RE.toRegExp(regex1)
  const re2 = RE.toRegExp(regex1)

  const matches1 = Stream.take(30, RE.enumerate(regex1))
  const matches2 = Stream.take(30, RE.enumerate(regex2))

  for (const m1 of Stream.toArray(matches1)) {
    if (!re1.test(m1)) {
      return { left: m1 }
    }
  }

  for (const m2 of Stream.toArray(matches2)) {
    if (!re1.test(m2)) {
      return { right: m2 }
    }
  }
  
  return undefined
}

describe('toStdRegex', () => {

  it('is idempotent on StdRegex', () => {
    fc.assert(
      fc.property(
        // FIXME: `star` often leads to exponential blow up.
        Arb.stdRegexNoStar(),
        inputRegex => {
          console.debug('inp:', RE.toString(inputRegex))

          const time = performance.now()
          const outputRegex = toStdRegex(inputRegex)
          console.debug('time: ', performance.now() - time)
          console.debug('out:', RE.toString(outputRegex))

          // expect(outputRegex.hash).toBe(inputRegex.hash)
          expect(stochasticEquiv(inputRegex, outputRegex))
            .toBeUndefined()
        }
      ),
      // { seed: 1421202580, path: "0:0:0", endOnFailure: true }
      // { seed: 568057861, path: "0:0:0:0:0:0:0:0:0:0:0:0:0:0", endOnFailure: true }
      // { seed: 2050898313, path: "3:0:0:1:1:1:1:1:2:7:0:0:0:0:0:0:0:0:0:1:0:2:2:2:4:4:4:4:4:4:4:4", endOnFailure: true }
      // { seed: 149770099, path: "2:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:1:1:3:3:5:4:4:4:4:4:4:4:5:5:5:5:7:7:4:4:6:6:5:6:3:5:1", endOnFailure: true }
    )
  })

})


test('A ⋂ ¬A = ∅', () => {
  fc.assert(
    fc.property(
      Arb.stdRegexNoStar(),
      inputRegex => {
        const outputRegex = toStdRegex(
          RE.intersection(
            inputRegex,
            RE.complement(inputRegex)
          )
        )
        expect(RE.isEmpty(outputRegex)).toBe(true)
      }
    ),
  )
})


