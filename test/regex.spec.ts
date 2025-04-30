import fc from "fast-check"
import { describe, it, expect, test } from "vitest"
import * as RE from "../src/regex"
import * as DFA from '../src/dfa'
import * as Arb from './arbitrary-regex'
import * as Stream from '../src/stream'
import * as CharSet from '../src/char-set'
import { toRegExp } from "../src/regex"
import { parseRegExp } from "../src/regex-parser"

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

describe('enumerate', () => {
  
  // TODO: also test that `enumerate` is complete by matching with 
  // the complement.

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
            Stream.take(100, shortWords)
          )

          for (const word of selectedWords) {
            expect(word).toMatch(regexp)
          }
        }
      ),
    )
  })

})

describe('size', () => {

  it('returns 1 for ∅ *', () => {
    const regex = RE.star(RE.empty) 
    expect(RE.size(regex)).toBe(1n)
  })

  it('returns 1 for ε*', () => {
    const regex = RE.star(RE.empty) 
    expect(RE.size(regex)).toBe(1n)
  })

  it('returns undefined for a*', () => {
    const regex = RE.star(RE.singleChar('a')) 
    expect(RE.size(regex)).toBe(undefined)
  })

  it('returns 1 for (a|a)', () => {
    const regex = RE.union(RE.singleChar('a'), RE.singleChar('a')) 
    expect(RE.size(regex)).toBe(1n)
  })

  it('returns 26 for ([a-z]|[a-z])', () => {
    const regex = RE.union(
      RE.literal(CharSet.charRange('a', 'z')),
      RE.literal(CharSet.charRange('a', 'z')),
    )
    expect(RE.size(regex)).toBe(26n)
  })

  it('returns 260 for [a-z][0-9]', () => {
    const regex = RE.concat(
      RE.literal(CharSet.charRange('a', 'z')),
      RE.literal(CharSet.charRange('0', '9')) 
    )
    expect(RE.size(regex)).toBe(260n)
  })

  it('returns 26**60 for [a-z]{60}', () => {
    const regex = RE.replicate(60, RE.literal(CharSet.charRange('a', 'z')))
    expect(RE.size(regex)).toBe(26n**60n)
  })

  it('is same as length of exhausitve enumeration', () => {
    fc.assert(
      fc.property(
        Arb.stdRegex(),
        stdRegex => {
          const predicatedSize = RE.size(stdRegex)
          fc.pre(predicatedSize !== undefined && predicatedSize <= 100n)

          const allWords = Stream.toArray(RE.enumerate(stdRegex))
          expect(predicatedSize).toBe(BigInt(allWords.length))
        }       
      )
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

// describe('intersection', () => {
//   it('two regex match a string if their intersection matches', () => {
//     fc.assert(
//       fc.property(
//         Arb.stdRegex(),
//         Arb.stdRegex(),
//         (regex1, regex2) => {
//           const intersectionRegex = RE.intersection(regex1, regex2)
//           expect(RegexTree.isSubsetOf(intersectionRegex, regex1)).toBe(true)
//           expect(RegexTree.isSubsetOf(intersectionRegex, regex2)).toBe(true)
//         }
//       )
//     )   
//   })
// })
