import { describe, expect, it, bench } from "vitest"
import { parseRegExp, parseRegexString } from "../src/regex-parser"
import { ParseError } from "../src/parser"
import * as RE from "../src/regex"
import * as CharSet from "../src/char-set"
import fc from "fast-check"
import * as Arb from './arbitrary-regex'

describe('parseRegexString', () => { 

  it.each([
    [/^a$/, RE.singleChar('a')],
    [/^(a)$/, RE.singleChar('a')],
    [/^.$/, RE.literal(CharSet.wildcard({ dotAll: false }))],
    // [/^.$/s, RE.literal(CharSet.wildcard({ dotAll: true }))],
    [/^a*$/, RE.star(RE.singleChar('a'))],
    [/^a+$/, RE.plus(RE.singleChar('a'))],
    [/^a?$/, RE.optional(RE.singleChar('a'))],
    [/^abc$/, RE.string('abc')],
    [/^a|b$/, RE.union(RE.singleChar('a'), RE.singleChar('b'))],
    [/^aa|bb$/, RE.union(RE.string('aa'), RE.string('bb'))],
    [/^(a|b)*$/, RE.star(RE.union(RE.singleChar('a'), RE.singleChar('b')))],
    [/^ab*$/, RE.concat(RE.singleChar('a'), RE.star(RE.singleChar('b')))],
    [/^a{3}$/, RE.replicate(3, 3, RE.singleChar('a'))],
    [/^a{3,}$/, RE.replicate(3, Infinity, RE.singleChar('a'))],
    [/^a{,5}$/, RE.replicate(0, 5, RE.singleChar('a'))],
    [/^a{3,5}$/, RE.replicate(3, 5, RE.singleChar('a'))],
    [/^\w$/, RE.literal(CharSet.wordChars)],
    [/^\W$/, RE.literal(CharSet.nonWordChars)],
    [/^\n$/, RE.literal(CharSet.singleton('\n'))],
    [/^\.$/, RE.literal(CharSet.singleton('.'))],
  ])('can parse %s', (regexp, expected) => {
    expect(parseRegExp(regexp)).toEqual(expected)
  })

  it.each([
    ['a+*'],
    ['(a'],
    ['a?{2}'],
    ['a+{2}'],
  ])('rejects invalid regex /%s/', (regexStr) => {
    expect(() => parseRegexString(regexStr)).toThrowError(ParseError)
  })

  it('can parse email regex', () => {
    parseRegExp(/^[\w\-\.]+@([\w-]+\.)+[\w-]{2,}$/)
  })

  it('inverts RE.toString', () => {
    fc.assert(
      fc.property(
        Arb.stdRegex(),
        (stdRegex) => {
        const regexStr = RE.toString(stdRegex)
        const result = parseRegexString(regexStr)
        expect(result.hash).toBe(stdRegex.hash)
      }),
    )   
  })

})

