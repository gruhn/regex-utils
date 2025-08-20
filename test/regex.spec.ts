import fc from "fast-check"
import { describe, it } from "node:test"
import { strict as assert } from "node:assert"
import * as RE from "../src/regex"
import * as AST from "../src/ast"
import * as DFA from '../src/dfa'
import * as Arb from './arbitrary-regex'
import * as Stream from '../src/stream'
import * as CharSet from '../src/char-set'
import { parseRegExp, parseRegExpString } from "../src/regex-parser"

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

  it('is inverted by parser', () => {
    fc.assert(
      fc.property(
        Arb.stdRegex(),
        (inputRegex) => {
          // Add anchors to ensure the parser produces the exact same AST
          const regexStr = `^(${RE.toString(inputRegex)})$`
          const outputRegex = AST.toExtRegex(parseRegExpString(regexStr))
          assert.equal(inputRegex.hash, outputRegex.hash)
        }
      ),
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
          const allComplementWords = RE.enumerate(inputRegexComplement)

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

describe('sample', () => {

  it('output strings match the input regex', () => {
    fc.assert(
      fc.property(
        Arb.stdRegex(),
        fc.integer({ min: 0, max: 1000 }),
        (inputRegex, seed) => {
          const regexp = RE.toRegExp(inputRegex)
          const samples = RE.sample(inputRegex, seed)

          // Test first 50 samples
          let count = 0
          for (const sample of samples) {
            if (count >= 50) break
            assert.match(sample, regexp)
            count++
          }
        }
      ),
    )
  })

  it('is deterministic with same seed', () => {
    const regex = RE.string('test')
    const samples1 = []
    const samples2 = []
    
    const generator1 = RE.sample(regex, 42)
    const generator2 = RE.sample(regex, 42)
    
    for (let i = 0; i < 10; i++) {
      samples1.push(generator1.next().value)
      samples2.push(generator2.next().value)
    }
    
    assert.deepEqual(samples1, samples2)
  })

  it('produces different results with different seeds', () => {
    fc.assert(
      fc.property(
        Arb.stdRegex(),
        (inputRegex) => {
          // Only test regexes that have multiple possible matches
          fc.pre(!RE.isEmpty(inputRegex))
          
          const samples1: string[] = []
          const samples2: string[] = []
          
          const generator1 = RE.sample(inputRegex, 42)
          const generator2 = RE.sample(inputRegex, 123)
          
          for (let i = 0; i < 20; i++) {
            samples1.push(generator1.next().value)
            samples2.push(generator2.next().value)
          }
          
          // With different seeds, we should get some different samples
          // (this might occasionally fail for very simple regexes, but should be rare)
          const identical = samples1.every((sample, i) => sample === samples2[i])
          
          // Only assert if the regex has enough variation to produce different samples
          if (RE.size(inputRegex) === undefined || (RE.size(inputRegex) && RE.size(inputRegex)! > 1n)) {
            // For regexes with multiple matches, we expect some variation
            // We allow some identical samples but not all
            const identicalCount = samples1.filter((sample, i) => sample === samples2[i]).length
            assert(identicalCount < samples1.length, 'All samples are identical despite different seeds')
          }
        }
      ),
    )
  })

  it('handles simple literal regex', () => {
    const regex = RE.singleChar('a')
    const samples = RE.sample(regex, 42)
    
    for (let i = 0; i < 10; i++) {
      assert.equal(samples.next().value, 'a')
    }
  })

  it('handles epsilon regex', () => {
    const regex = RE.epsilon
    const samples = RE.sample(regex, 42)
    
    for (let i = 0; i < 10; i++) {
      assert.equal(samples.next().value, '')
    }
  })

  it('handles concat regex', () => {
    const regex = RE.concat(RE.singleChar('a'), RE.singleChar('b'))
    const samples = RE.sample(regex, 42)
    
    for (let i = 0; i < 10; i++) {
      assert.equal(samples.next().value, 'ab')
    }
  })

  it('handles union regex', () => {
    const regex = RE.union(RE.singleChar('a'), RE.singleChar('b'))
    const samples = RE.sample(regex, 42)
    const results = new Set()
    
    for (let i = 0; i < 50; i++) {
      const sample = samples.next().value
      results.add(sample)
      assert(sample === 'a' || sample === 'b')
    }
    
    // With 50 samples, we should see both 'a' and 'b'
    assert(results.has('a') && results.has('b'))
  })

  it('handles star regex with reasonable length distribution', () => {
    const regex = RE.star(RE.singleChar('a'))
    const samples = RE.sample(regex, 42)
    const lengths = []
    
    for (let i = 0; i < 100; i++) {
      const sample = samples.next().value
      assert.match(sample, /^a*$/)
      lengths.push(sample.length)
    }
    
    // Should include empty string and various lengths, but biased towards shorter strings
    assert(lengths.includes(0), 'Should include empty string')
    assert(lengths.some(len => len > 0), 'Should include non-empty strings')
    
    // Average length should be reasonable (not too long)
    const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length
    assert(avgLength < 5, `Average length should be reasonable, got ${avgLength}`)
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

          const allWords = [...RE.enumerate(stdRegex)]
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
    // TODO: could avoid extra parenthesis when rendering
    // expected expression:
    [/^(a|(a|b))$/, /^([ab])$/],
    [/^(a|(b|a))$/, /^([ab])$/],
    [/^((b|a)|a)$/, /^([ab])$/],
    [/^((a|b)|a)$/, /^([ab])$/],
    [/^(a?)?$/, /^(a?)$/],
    [/^(a*)?$/, /^(a*)$/],
    // TODO:
    // [/^(a|a*)$/, /^(aa*)$/],
    // union-of-concat rules:
    [/^(ab|ac)$/, /^(a[bc])$/],
    [/^(ba|ca)$/, /^([bc]a)$/],
    [/^(ab|a)$/, /^(ab?)$/],
    [/^(ba|a)$/, /^(b?a)$/],
    [/^(a|ab)$/, /^(ab?)$/],
    [/^(a|ba)$/, /^(b?a)$/],
    // TODO:
    // [/^(a|a{2}|a{3}|a{4}|a{5})$/, /^(a{1,5})$/],
    // [/^(a|a{2}|a{3}|a{4}|a{5}|b)$/, /^(a{1,5}|b)$/],
    // star rules:
    [/^(a*)*$/, /^(a*)$/],
    [/^(a*b*)*$/, /^([ab]*)$/],
  ] as const
  
  for (const [source, target] of rewriteCases) {
    it(`rewrites ${source} to ${target}`, () => {
      const parsed = AST.toExtRegex(parseRegExp(source))
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
    const actual = RE.derivative(str, AST.toExtRegex(parseRegExp(input)))
      assert(RE.isStdRegex(actual))
      assert.deepEqual(RE.toRegExp(actual), expected)
    })
  }
  
})

