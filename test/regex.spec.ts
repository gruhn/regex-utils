import fc from "fast-check"
import { describe, it, expect } from "vitest"
import * as RE from "../src/regex"
import * as Arb from './arbitrary-regex'
import * as Stream from '../src/stream'
import { toRegExp } from "../dist/regex"
import { parseRegExp } from "../dist/regex-parser"

describe('toString', () => {

  it('output is accepted by RegExp constructor', () => {
    fc.assert(
      fc.property(
        Arb.stdRegex(),
        stdRegex => {
          // Throws error if regex is invalid:
          new RegExp(RE.toString(stdRegex))
        }
      )
    )
  })

})

// TODO: how to test that `enumerate` is complete?
describe('enumerate', () => {
  
  it('only produces strings matching the input regex', () => {
    fc.assert(
      fc.property(
        Arb.stdRegex(),
        stdRegex => {
          const regexp = RE.toRegExp(stdRegex)
          const allWords = RE.enumerate(stdRegex)

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
      ),
    )
  })

})

// describe('equivalent', () => {
//   it('every regex is equivalent to itself', () => {
//     fc.assert(
//       fc.property(extRegex(), (tree) => {
//         expect(RegexTree.equivalent(tree, tree)).toBe(true)
//       })
//     )
//   })
// })

// describe('intersect', () => {
//   it('two regex match a string if their intersection matches', () => {
//     fc.assert(
//       fc.property(
//         extRegex(),
//         extRegex(),
//         (regex1, regex2) => {
//           const intersectionRegex = RegexTree.intersect(regex1, regex2)
//           expect(RegexTree.isSubsetOf(intersectionRegex, regex1)).toBe(true)
//           expect(RegexTree.isSubsetOf(intersectionRegex, regex2)).toBe(true)
//         }
//       )
//     )   
//   })
// })
