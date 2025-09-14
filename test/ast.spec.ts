import { describe, it } from "node:test"
import { strict as assert } from "node:assert"
import * as RE from "../src/regex"
import * as AST from "../src/ast"
import { parseRegExp } from "../src/regex-parser"

describe('toExtRegex', () => {

  const dotStar = RE.star(RE.anySingleChar)

  // function infix(regex: RE.ExtRegex) {
  //   return RE.seq([ dotStar, regex, dotStar ])
  // }

  function prefix(regex: RE.ExtRegex) {
    return RE.concat(regex, dotStar)
  }

  function suffix(regex: RE.ExtRegex) {
    return RE.concat(dotStar, regex)
  }

  describe('union with empty members', () => {
    const testCases = [
      [/^(|a)$/, RE.optional(RE.singleChar('a'))],
      [/^(a||)$/, RE.optional(RE.singleChar('a'), )],
      [/^(|a|)$/, RE.optional(RE.singleChar('a'))],
      [/^(|)$/, RE.epsilon],
    ] as const

    for (const [regexp, expected] of testCases) {
      it(`${regexp}`, () => {
        const actual = AST.toExtRegex(parseRegExp(regexp))
        assert.equal(actual.hash, expected.hash)
      })
    }
  })

  describe('start/end anchor elimination', () => {
    const testCases = [
      [/^abc/, RE.seq([RE.string('abc'), dotStar])],
      // start marker contradictions can only match empty set:
      [/a^b/, RE.empty],
      [/^a^b/, RE.empty],
      // but two ^^ directly in a row are not a contradiction:
      [/(^^a|b)/, prefix(RE.union(RE.singleChar('a'), suffix(RE.singleChar('b'))))],
      // in fact, as long as anything between two ^ can match epsilon, 
      // there is no contradiction:
      [/(^(c|)^a|b)/, prefix(RE.union(RE.singleChar('a'), suffix(RE.singleChar('b'))))],
      [/(^c*^a|b)/, prefix(RE.union(RE.singleChar('a'), suffix(RE.singleChar('b'))))],
      // Also, contradiction inside a union does NOT collapse
      // the whole expression to empty set:
      [/(a^b|c)/, RE.seq([dotStar, RE.singleChar('c'), dotStar])],
      [/^(a^b|c)/, RE.seq([RE.singleChar('c'), dotStar])],

      // End anchor before start anchor is contradictory and describes empty set:
      [/$.^/, RE.empty],
      // Can still match epsilon as long as there's nothing between end- and start anchor:
      [/$^/, RE.epsilon],
      // Nullable expressions on the left and right can be ignored:
      [/(a?)$^(b*)/, RE.epsilon],

      [/(^a|)^b/, RE.seq([RE.singleChar('b'), dotStar])],
      [/^a(b^|c)/, RE.seq([RE.string('ac'), dotStar]) ],
      [/(^|a)b/, prefix(RE.concat(RE.optional(suffix(RE.singleChar('a'))), RE.singleChar('b')))],

      // FIXME:
      // [/(^)+a$/, RE.singleChar('a') ],
      [/(^)*a$/, suffix(RE.singleChar('a')) ],
      [/(b|^)a$/, RE.concat(RE.optional(suffix(RE.singleChar('b'))), RE.singleChar('a'))],
      [/a(^)/, RE.empty],
    ] as const

    for (const [regexp, expected] of testCases) {
      it(`${regexp}`, () => {
        const actual = AST.toExtRegex(parseRegExp(regexp))
        assert.equal(actual.hash, expected.hash)
      })
    }
  })

  describe('lookahead elimination', () => {
    const testCases = [
      // positive lookahead:
      [/^(?=a)a$/, RE.string('a')],
      [/^a(?=b)b$/, RE.string('ab')],
      [/^((?=a)a|(?=b)b)$/, RE.union(RE.string('a'), RE.string('b'))],
      [/^(?=[0-5])(?=[5-9])[3-7]$/, RE.string('5')],
      // negative lookahead:
      [/^a(?!b)c$/, RE.concat(RE.string('a'), RE.intersection(RE.complement(RE.string('b')), RE.string('c')))],
      // TODO: lookahead + lookbehind
      // [/^a(?=b)(?<=a)b$/, RE.string('ab')], 
      // [/^b(?=ab)a(?<=ba)b$/, RE.string('bab')],
      // [/^a(?=b)(?<=a)(?!a)(?<!b)b$/, RE.string('ab')],
    ] as const

    for (const [regexp, expected] of testCases) {
      it(`${regexp}`, () => {
        const actual = AST.toExtRegex(parseRegExp(regexp))
        assert.equal(actual.hash, expected.hash, RE.debugShow(actual) + '\n\n' + RE.debugShow(expected))
      })
    }

    it('fixme', { todo: true }, () => {
      const actual = AST.toExtRegex(parseRegExp(/^(a(?!b))*$/))
      const expected = RE.star(RE.string('a'))
      assert.equal(actual.hash, expected.hash) 
    })

  })
  
})
