import { describe, it } from "node:test"
import { strict as assert } from "node:assert"
import * as RE from "../src/regex"
import * as AST from "../src/ast"
import { parseRegExp } from "../src/regex-parser"

describe('toExtRegex', () => {

  // function infix(regex: RE.ExtRegex) {
  //   return RE.seq([ dotStar, regex, dotStar ])
  // }

  function prefix(regex: RE.ExtRegex) {
    return RE.concat(regex, RE.dotStar)
  }

  function suffix(regex: RE.ExtRegex) {
    return RE.concat(RE.dotStar, regex)
  }

  describe('union with empty members', () => {
    const testCases = [
      [/^(|a)$/, RE.optional(RE.singleChar('a'))],
      [/^(a||)$/, RE.optional(RE.singleChar('a'),)],
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
      [/^abc/, RE.seq([RE.string('abc'), RE.dotStar])],
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
      [/(a^b|c)/, RE.seq([RE.dotStar, RE.singleChar('c'), RE.dotStar])],
      [/^(a^b|c)/, RE.seq([RE.singleChar('c'), RE.dotStar])],

      // End anchor before start anchor is contradictory and describes empty set:
      [/$.^/, RE.empty],
      // Can still match epsilon as long as there's nothing between end- and start anchor:
      [/$^/, RE.epsilon],
      // Nullable expressions on the left and right can be ignored:
      [/(a?)$^(b*)/, RE.epsilon],

      // Contradiction inside lookahead collapses to empty set. Then empty set lookahead can't match anything:
      [/(?=a^)/, RE.empty],

      [/(^a|)^b/, RE.seq([RE.singleChar('b'), RE.dotStar])],
      [/^a(b^|c)/, RE.seq([RE.string('ac'), RE.dotStar])],
      [/(^|a)b/, prefix(RE.concat(RE.optional(suffix(RE.singleChar('a'))), RE.singleChar('b')))],

      // FIXME:
      // [/(^)+a$/, RE.singleChar('a') ],
      [/(^)*a$/, suffix(RE.singleChar('a'))],
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
      [/(?=a)b/, RE.empty],
      // FIXME:
      // [/^((?=a)a|(?=b)b)$/, RE.union(RE.string('a'), RE.string('b'))],
      [/^(?=[0-5])(?=[5-9])[3-7]$/, RE.string('5')],
      [/^(?=(?=(?=[0-5])[5-9])[3-7])[0-9]$/, RE.string('5')],
      // negative lookahead:
      [/^a(?!b)c$/, RE.intersection(RE.concat(RE.string('a'), RE.complement(RE.string('b'))), RE.string('ac'))],
      [/(?!)/, RE.empty],
      [/(?!a*)/, RE.empty],
      [/(?![^abc])/, RE.empty],
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

    it('fixme 1', { todo: true }, () => {
      const actual = AST.toExtRegex(parseRegExp(/^(a(?!b))*$/))
      const expected = RE.star(RE.string('a'))
      assert.equal(actual.hash, expected.hash)
    })

    it('fixme 2', { todo: true }, () => {
      const actual = AST.toExtRegex(parseRegExp(/^((?=a)a|(?=b)b)$/))
      const expected = RE.union(RE.string('a'), RE.string('b'))
      assert.equal(actual.hash, expected.hash)
    })

    it('fixme 3', { todo: true }, () => {
      const actual = AST.toExtRegex(parseRegExp(/(?![^a])/))
      // const expected = RE.union(RE.string('a'), RE.string('b'))
      // assert.equal(actual.hash, expected.hash)
      RE.debugPrint(actual)
      throw 'idk'
    })
  })

})

describe('toString', () => {

  const testCases = [
    [AST.repeat(AST.string('a'), { min: 0, max: 3 }), /a{0,3}/],
    // If `min` is `undefined` it must still explicitly be set to zero
    // because `a{,3}` is interpreted as the literal string "a{,3}" in
    // the JavaScript regex flavor:
    [AST.repeat(AST.string('a'), { max: 3 }), /a{0,3}/],
  ] as const

  for (const [inputAST, expected] of testCases) {
    it(`${expected}`, () => {
      const str = AST.toString(inputAST, { useNonCapturingGroups: false })
      assert.equal(str, expected.source)
    })
  }

})
