import fc from "fast-check"
import { describe, it } from "node:test"
import { strict as assert } from "node:assert"
import * as RE from "../src/regex"
import * as DFA from '../src/dfa'
import * as Arb from './arbitrary-regex'
import * as Stream from '../src/stream'
import * as CharSet from '../src/char-set'
import { parseRegExp } from "../src/regex-parser"

function toStdRegex_ignoreBlowUp(regex: RE.ExtRegex) {
  try {
    return DFA.toStdRegex(regex)
  } catch (e) {
    if (e instanceof RE.CacheOverflowError) {
      fc.pre(false)
    } else {
      throw e
    }     
  }
}

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
          const allWords = RE.enumerateAux(inputRegex)

          // long words are likely result of repitiion and are less interesting to test
          // and also blow up memory use:
          const shortWords = Stream.takeWhile(word => word.length <= 30, allWords)

          for (const word of Stream.take(100, shortWords)) {
            assert.match(word, regexp)
          }
        }
      ),
    )
  })

  // completeness
  it('strings NOT in the output, do NOT match the input regex', () => {
    fc.assert(
      fc.property(
        Arb.stdRegex(),
        inputRegex => {
          const regexp = RE.toRegExp(inputRegex)

          // get words NOT in the output by enumerating words of the complement:
          const inputRegexComplement = toStdRegex_ignoreBlowUp(RE.complement(inputRegex))
          const allComplementWords = RE.enumerateAux(inputRegexComplement)

          // long words are likely result of repetition and are less interesting to test
          // and also blow up memory:
          const shortWords = Stream.takeWhile(word => word.length <= 30, allComplementWords)

          for (const complementWord of Stream.take(100, shortWords)) {
            assert.doesNotMatch(complementWord, regexp)
          }
        }
      ),
      { endOnFailure: true }
    )
  })

})

describe('size', () => {

  it('returns 1 for ∅ *', () => {
    const regex = RE.star(RE.empty) 
    assert.equal(RE.size(regex), 1n)
  })

  it('returns 1 for ε*', () => {
    const regex = RE.star(RE.empty) 
    assert.equal(RE.size(regex), 1n)
  })

  it('returns undefined for a*', () => {
    const regex = RE.star(RE.singleChar('a')) 
    assert.equal(RE.size(regex), undefined)
  })

  it('returns 1 for (a|a)', () => {
    const regex = RE.union(RE.singleChar('a'), RE.singleChar('a')) 
    assert.equal(RE.size(regex), 1n)
  })

  it('returns 26 for ([a-z]|[a-z])', () => {
    const regex = RE.union(
      RE.literal(CharSet.charRange('a', 'z')),
      RE.literal(CharSet.charRange('a', 'z')),
    )
    assert.equal(RE.size(regex), 26n)
  })

  it('returns 260 for [a-z][0-9]', () => {
    const regex = RE.concat(
      RE.literal(CharSet.charRange('a', 'z')),
      RE.literal(CharSet.charRange('0', '9')) 
    )
    assert.equal(RE.size(regex), 260n)
  })

  it('returns 26**60 for [a-z]{60}', () => {
    const regex = RE.repeat(RE.literal(CharSet.charRange('a', 'z')), 60)
    assert.equal(RE.size(regex), 26n**60n)
  })

  it('is same as length of exhausitve enumeration', () => {
    fc.assert(
      fc.property(
        Arb.stdRegex(),
        stdRegex => {
          const predicatedSize = RE.size(stdRegex)
          fc.pre(predicatedSize !== undefined && predicatedSize <= 100n)

          const allWords = [...RE.enumerateAux(stdRegex)]
          assert.equal(predicatedSize, BigInt(allWords.length))
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

  const rewriteCases = [
    // concat rules:
    [/^a*a$/, /^(aa*)$/],
    [/^a*(ab)$/, /^(aa*b)$/],
    [/^a*a*$/, /^(a*)$/],
    [/^a*(a*b)$/, /^(a*b)$/],
    [/^a?a$/, /^(aa?)$/],
    [/^a?(ab)$/, /^(aa?b)$/],
    [/^a{3}a?a{2}$/, /^(a{5}a?)$/],
    [/^a?a?$/, /^((a?){2})$/],
    // union rules:
    [/^(a|a)$/, /^(a)$/],
    [/^a|(a|b)$/, /^([ab])$/],
    [/^a|(b|a)$/, /^([ab])$/],
    [/^(b|a)|a$/, /^([ab])$/],
    [/^(a|b)|a$/, /^([ab])$/],
    [/^(a?)?$/, /^(a?)$/],
    [/^(a*)?$/, /^(a*)$/],
    // TODO:
    // [/^(a|a*)$/, /^(aa*)$/],
    // union-of-concat rules:
    [/^ab|ac$/, /^(a[bc])$/],
    [/^ba|ca$/, /^([bc]a)$/],
    [/^ab|a$/, /^(ab?)$/],
    [/^ba|a$/, /^(b?a)$/],
    [/^a|ab$/, /^(ab?)$/],
    [/^a|ba$/, /^(b?a)$/],
    // TODO:
    // [/^(a|a{2}|a{3}|a{4}|a{5})$/, /^(a{1,5})$/],
    // [/^(a|a{2}|a{3}|a{4}|a{5}|b)$/, /^(a{1,5}|b)$/],
    // star rules:
    [/^(a*)*$/, /^(a*)$/],
    [/^(a*b*)*$/, /^([ab]*)$/],
  ] as const
  
  for (const [source, target] of rewriteCases) {
    it(`rewrites ${source} to ${target}`, () => {
      const parsed = parseRegExp(source)
      assert(RE.isStdRegex(parsed))
      assert.deepEqual(RE.toRegExp(parsed), target)
    })
  }
  
})

describe('derivative', () => {

  const derivativeCases = [
    [/^((aa*)?)$/, 'a', /^(a*)$/],
    [/^(a{2}(a{3})*)$/, 'a', /^(a(a{3})*)$/],
    [/^(a{2}(a*)|(aa*))$/, 'a', /^(a?a*)$/],
    [/^(a(a{3})*|(aa*)?)$/, 'a', /^((a{3})*|a*)$/],
    [/^(a{2}(a{3})*|(aa*)?)$/, 'a', /^(a(a{3})*|a*)$/],
  ] as const
  
  for (const [input, str, expected] of derivativeCases) {
    it(`of ${input} with respect to "${str}" is ${expected}`, () => {
      const actual = RE.derivative(str, parseRegExp(input))
      assert(RE.isStdRegex(actual))
      assert.deepEqual(RE.toRegExp(actual), expected)
    })
  }
  
})
