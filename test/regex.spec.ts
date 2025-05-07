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

  // soundness
  it('output strings match the input regex', () => {
    fc.assert(
      fc.property(
        Arb.stdRegex(),
        inputRegex => {
          const regexp = RE.toRegExp(inputRegex)
          const allWords = RE.enumerate(inputRegex)

          // long words are likely result of repitiion and are less interesting to test
          // and also blow up memory use:
          const shortWords = Stream.takeWhile(word => word.length <= 30, allWords)

          const selectedWords = [...Stream.take(100, shortWords)]

          for (const word of selectedWords) {
            expect(word).toMatch(regexp)
          }
        }
      ),
    )
  })

  // completeness
  it('strings NOT in the output, do NOT match the input regex', () => {
    fc.assert(
      fc.property(
        // FIXME: have to exclude `star` because complement operation
        // then often leads to exponential blow-up:
        Arb.stdRegexNoStar(),
        inputRegex => {
          const regexp = RE.toRegExp(inputRegex)

          // get words NOT in the output by enumerating words of the complement:
          const inputRegexComplement = DFA.toStdRegex(RE.complement(inputRegex))
          const allComplementWords = RE.enumerate(inputRegexComplement)

          // long words are likely result of repitiion and are less interesting to test
          // and also blow up memory:
          const shortWords = Stream.takeWhile(word => word.length <= 30, allComplementWords)
          const selectedWords = [...Stream.take(100, shortWords)]

          for (const complementWord of selectedWords) {
            expect(complementWord).not.toMatch(regexp)
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
    const regex = RE.replicate(60, 60, RE.literal(CharSet.charRange('a', 'z')))
    expect(RE.size(regex)).toBe(26n**60n)
  })

  it('is same as length of exhausitve enumeration', () => {
    fc.assert(
      fc.property(
        Arb.stdRegex(),
        stdRegex => {
          const predicatedSize = RE.size(stdRegex)
          fc.pre(predicatedSize !== undefined && predicatedSize <= 100n)

          const allWords = [...RE.enumerate(stdRegex)]
          expect(predicatedSize).toBe(BigInt(allWords.length))
        }       
      )
    )   
  })

})

describe('rewrite rules', () => {

  // TODO:
  // - test intersection/complement rules.
  // - test rules involving epsilon / empty set
  //   (can't be tested right now because parser does not
  //   support empty set `$.^` and epsilon `()`.

  it.only.each([
    // concat rules:
    [/^a*a$/, /^a(a)*$/],
    [/^a*(ab)$/, /^a(a)*b$/],
    [/^a*a*$/, /^(a)*$/],
    [/^a*(a*b)$/, /^(a)*b$/],
    // union rules:
    [/^(a|a)$/, /^a$/],
    [/^a|(a|b)$/, /^[ab]$/],
    [/^a|(b|a)$/, /^[ab]$/],
    [/^(b|a)|a$/, /^[ab]$/],
    [/^(a|b)|a$/, /^[ab]$/],
    // union+concat rules:
    [/^ab|ac$/, /^a[bc]$/],
    [/^ba|ca$/, /^[bc]a$/],
    [/^ab|a$/, /^a(b)?$/],
    [/^ba|a$/, /^(b)?a$/],
    [/^a|ab$/, /^a(b)?$/],
    [/^a|ba$/, /^(b)?a$/],
    // star rules:
    [/^(a*)*$/, /^(a)*$/],
  ])('rewrites %s to %s', (source, target) => {
    expect(RE.toRegExp(parseRegExp(source))).toEqual(target)
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

