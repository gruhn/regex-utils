import { describe, expect, it } from "vitest"
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
    [/^a{3}$/, RE.repeat(RE.singleChar('a'), 3)],
    [/^a{3,}$/, RE.repeat(RE.singleChar('a'), { min: 3 })],
    [/^a{,5}$/, RE.repeat(RE.singleChar('a'), { max: 5 })],
    [/^a{3,5}$/, RE.repeat(RE.singleChar('a'), { min: 3, max: 5 })],
    [/^\w$/, RE.literal(CharSet.wordChars)],
    [/^\W$/, RE.literal(CharSet.nonWordChars)],
    [/^\n$/, RE.literal(CharSet.singleton('\n'))],
    [/^\.$/, RE.literal(CharSet.singleton('.'))],
    [/^[a-z]$/, RE.literal(CharSet.charRange('a', 'z'))],
    [/^[^abc]$/, RE.literal(CharSet.complement(CharSet.fromArray(['a', 'b', 'c'])))],
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
        // Arb.stdRegex(),
        Arb.stdRegex(10),
        (stdRegex) => {
        const regexStr = RE.toString(stdRegex)
        const result = parseRegexString(regexStr)

        console.debug(RE.toRegExp(stdRegex))
        console.debug(RE.toRegExp(result))
        // console.debug([...stdRegex.children.values()].map(RE.debugShow)[3].inner.children)
        // console.debug([...result.children.values()].map(RE.debugShow)[3].inner.children)

        console.debug(JSON.stringify(RE.debugShow(stdRegex), null, 2))
        console.debug(JSON.stringify(RE.debugShow(result), null, 2))
        
        expect(result.hash).toBe(stdRegex.hash)
      }),
      // { seed: -1811385930, path: "79:0:0:0:0:2:2:2", endOnFailure: true }
      { seed: -1928456392, path: "88:2:2:2", endOnFailure: true }
    )   
  })

})

