import { describe, it } from "node:test"
import { strict as assert } from "node:assert"
import * as RE from "../src/regex"
import * as AST from "../src/ast"
import { parseRegExp, UnsupportedSyntaxError } from "../src/regex-parser"
import { toStdRegex } from "src/dfa"

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
      [/^abc/, prefix(RE.string('abc'))],
      // start marker contradictions can only match empty set:
      [/a^b/, RE.empty],
      [/^a^b/, RE.empty],
      [/a(^)/, RE.empty],
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
      [/^$^$^/, RE.epsilon],
      // FIXME: [/($)(^)/, RE.epsilon],
      // Nullable expressions on the left and right can be ignored:
      [/(a?)$^(b*)/, RE.epsilon],
      // Nullable lookaheads before start anchor have no effect:
      [/(?=a*)^b$/, RE.string('b')],
      // Nullable lookaheads after end anchor have no effect:
      [/^b$(?=a*)/, RE.string('b')],
      // Non-nullable lookaheads before start anchor introduce contraction:
      [/(?=a+)^b/, RE.empty],
      // Non-nullable lookaheads after end anchor introduce contraction:
      [/^b$(?=a+)/, RE.empty],

      // Anchors inside quantifier:
      [/(^)*a$/, suffix(RE.singleChar('a'))],
      [/(b|^)a$/, RE.concat(RE.optional(suffix(RE.singleChar('b'))), RE.singleChar('a'))],
      [/(^a)*$/, RE.union(RE.dotStar, RE.singleChar('a'))], // (^a)*$ == (^a)?$ == ^(.*|a)$
      // TODO:
      // [/(^)+a$/, RE.singleChar('a')],
      // [/(^a*)+b$/, suffix(RE.singleChar('b'))],

      // TODO: Contradiction inside lookahead collapses to empty set. Then empty set lookahead can't match anything:
      // [/(?=a^)/, RE.empty],

      // Start anchor + union:
      [/(^a|)^b/, prefix(RE.singleChar('b'))],
      [/^a(b^|c)/, prefix(RE.string('ac'))],
      [/(^|a)b/, prefix(RE.concat(RE.optional(suffix(RE.singleChar('a'))), RE.singleChar('b')))],
    ] as const

    for (const [regexp, expected] of testCases) {
      it(`${regexp}`, () => {
        const actual = AST.toExtRegex(parseRegExp(regexp))
        assert.equal(actual.hash, expected.hash, RE.debugShow(actual) + '\n\n' + RE.debugShow(expected))
      })
    }
  })

  describe('lookahead elimination', () => {
    const testCases = [
      // positive lookahead:
      [/^(?=a)a$/, RE.string('a')],
      [/^a(?=b)b$/, RE.string('ab')],
      [/(?=a)b/, RE.empty],
      [/^((?=a)a|(?=b)b)$/, RE.union(RE.string('a'), RE.string('b'))],
      [/^(?=[0-5])(?=[5-9])[3-7]$/, RE.string('5')],
      // TODO: nested positive lookahead:
      // [/^(?=(?=(?=[0-5])[5-9])[3-7])[0-9]$/, RE.string('5')],
      // positive lookahead/lookbehind with nullable expression always succeed:
      [/^a(?=)b$/, RE.string('ab')],
      [/^a(?=b*)c$/, RE.string('ac')],
      [/^a(?<=)b$/, RE.string('ab')],
      [/^a(?<=b*)c$/, RE.string('ac')],
      // negative lookahead/lookbehind:
      [/^a(?!a)[ab]$/, RE.string('ab')],
      [/^a[ab](?<!a)$/, RE.string('ab')],
      // negative lookahead/lookbehind with nullable expression always fail:
      [/a(?!)c/, RE.empty],
      [/a(?!b*)c/, RE.empty],
      [/a(?<!)c/, RE.empty],
      [/a(?<!b*)c/, RE.empty],
      // TODO: lookahead + lookbehind
      // [/^a(?=b)(?<=a)b$/, RE.string('ab')],
      // [/^b(?=ab)a(?<=ba)b$/, RE.string('bab')],
      // [/^a(?=b)(?<=a)(?!a)(?<!b)b$/, RE.string('ab')],
      // [/((?=a)b)|(a|e)(?<=a)/, ]

      // TODO: lookahead inside quantifier
      // [/^(a(?!b))*$/, RE.star(RE.string('a'))],
      // [/^((?=a)a|(?=b)b)$/, RE.union(RE.string('a'), RE.string('b'))],
      // [/(?![^a])/, ???],

      // TODO: nested lookaheads/lookbehinds
      // [/(?!a?(?<=a+))b/, ]
    ] as const

    for (const [regexp, expected] of testCases) {
      it(`${regexp}`, () => {
        const actual = toStdRegex(AST.toExtRegex(parseRegExp(regexp)))
        assert.equal(actual.hash, expected.hash, RE.debugShow(actual) + '\n\n' + RE.debugShow(expected))
      })
    }
  })

  const testCasesUnsupported = [
    // start anchor inside single union member with non-empty prefix:
    /p(^l|r)/,
    /p(l|^r)/,
    // start anchor inside unbounded quantifier with non-empty prefix:
    /p(^i)*/,
    /p(^i)+/,
    /p(^i){3,}/,
    // end anchor inside single union member with non-empty prefix:
    /(l$|r)s/,
    /(l|r$)s/,
    // end anchor inside unbounded quantifier with non-empty prefix:
    /(i$)*s/,
    /(i$)+s/,
    /(i$){3,}s/,
    // anchors inside lookaheads:
    /(?=^a)/,
    /(?=a$)/,
    /(?!^a)/,
    /(?!a$)/,
    /(?<=^a)/,
    /(?<=a$)/,
    /(?<!^a)/,
    /(?<!a$)/,
    // regex flags:
    /.../i,
    /.../m,
    /.../u,
    /.../v,
    /.../y,
    // word boundary assertions:
    /\b/,
    /\B/,
  ] as const

  for (const regexp of testCasesUnsupported) {
    it(`throws UnsupportedSyntaxError for ${regexp}`, () => {
      assert.throws(() => AST.toExtRegex(parseRegExp(regexp)), UnsupportedSyntaxError)
    })
  }

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
    it(`${expected}`, { only: true }, () => {
      const str = AST.toString(inputAST, { useNonCapturingGroups: false })
      assert.equal(str, expected.source)
    })
  }

})
