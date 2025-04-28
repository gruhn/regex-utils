import fc from "fast-check"
import { describe, test, expect } from "vitest"
import * as SRE from "../src/standard-regex"
import { stdRegex } from './arbitrary-regex'
import * as Stream from '../src/stream'

describe('toString', () => {

  test('output is accepted by RegExp constructor', () => {
    fc.assert(
      fc.property(
        stdRegex(),
        stdRegex => {
          // Throws error if regex is invalid:
          new RegExp(SRE.toString(stdRegex))
        }
      )
    )
  })

})

describe('enumerate', () => {

  test('output strings match input regex', () => {
    fc.assert(
      fc.property(
        stdRegex(),
        stdRegex => {
          const regexp = new RegExp('^' + SRE.toString(stdRegex) + '$')

          const allWords = SRE.enumerate(stdRegex)
          // long words are likely result of repitiion and are less interesting to test
          // and also blow up memory use:
          const shortWords = Stream.takeWhile(word => word.length <= 30, allWords)

          const selectedWords = Stream.toArray(
            Stream.take(300, shortWords)
          )

          for (const word of selectedWords) {
            expect(word).toMatch(regexp)
          }
        }
      )
    )
  })

})


