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
    [/^ab*$/, RE.concat(RE.singleChar('a'), RE.star(RE.singleChar('b')))],
    // union:
    [/^a|b$/, RE.union(RE.singleChar('a'), RE.singleChar('b'))],
    [/^aa|bb$/, RE.union(RE.string('aa'), RE.string('bb'))],
    [/^(a|b)*$/, RE.star(RE.union(RE.singleChar('a'), RE.singleChar('b')))],
    [/^(|a)$/, RE.optional(RE.singleChar('a'))],
    [/^(a||)$/, RE.optional(RE.singleChar('a'))],
    [/^(|a|)$/, RE.optional(RE.singleChar('a'))],
    [/^(|)$/, RE.epsilon],
    // bounded quantifier:
    [/^a{3}$/, RE.repeat(RE.singleChar('a'), 3)],
    [/^a{3,}$/, RE.repeat(RE.singleChar('a'), { min: 3 })],
    [/^a{,5}$/, RE.repeat(RE.singleChar('a'), { max: 5 })],
    [/^a{3,5}$/, RE.repeat(RE.singleChar('a'), { min: 3, max: 5 })],
    // if curly bracket is not terminated the whole thing is interpreted literally:
    [/^a{3,5$/, RE.string('a{3,5')],
    // char classes / escaping:
    [/^\w$/, RE.literal(CharSet.wordChars)],
    [/^\W$/, RE.literal(CharSet.nonWordChars)],
    [/^\n$/, RE.literal(CharSet.singleton('\n'))],
    [/^\.$/, RE.literal(CharSet.singleton('.'))],
    // char class from range:
    [/^[a-z]$/, RE.literal(CharSet.charRange('a', 'z'))],
    [/^[a-]$/, RE.literal(CharSet.fromArray(['a', '-']))],
    // negative char class:
    [/^[^abc]$/, RE.literal(CharSet.complement(CharSet.fromArray(['a', 'b', 'c'])))],
    // non-capturing groups
    [/^(?:ab)$/, RE.string('ab')],
    // named capturing groups
    [/^(?<abc_012>abc)$/, RE.string('abc')],
    // positive lookahead
    [/^(?=^a$)b$/, RE.intersection(RE.string('a'), RE.string('b'))], 
    [/^(?=^a$)(?:b)$/, RE.intersection(RE.string('a'), RE.string('b'))], 
    [/^(?=^a$)(?=^b$)c$/, RE.intersection(RE.string('a'), RE.intersection(RE.string('b'), RE.string('b')))], 
    [/^a(?=^b$)c$/, RE.concat(RE.singleChar('a'), RE.intersection(RE.string('b'), RE.string('c')))], 
    [/^a(?=^b$)$/, RE.concat(RE.string('a'), RE.intersection(RE.string('b'), RE.string('')))], 
    [/^a(?=^b$)c(?=^d$)e$/, RE.concat(RE.string('a'), RE.intersection(RE.string('b'), RE.concat(RE.string('c'), RE.intersection(RE.string('d'), RE.string('e')))))], 
    // negative lookahead
    [/^(?!^a$)b$/, RE.intersection(RE.complement(RE.string('a')), RE.string('b'))], 
    [/^(?!^a$)b|c$/, RE.union(RE.intersection(RE.complement(RE.string('a')), RE.string('b')), RE.string('c'))],
    // some special chars don't need escape when inside brackets:
    [/^[.^$*+?()[{-|]$/, RE.literal(CharSet.fromArray([...'.^$*+?()[{-|']))],
    // other special chars need escape even inside brackets:
    [/^[\\\]\/]$/, RE.literal(CharSet.fromArray([...'\\]/']))],
  ])('can parse %s', (regexp, expected) => {
    expect(parseRegExp(regexp).hash).toBe(expected.hash)
  })

  it.each([
    // unclosed parenthesis:
    ['(a'],
    // combined quantifiers:
    ['a+*'],
    // FIXME:
    // ['a?{2}'],
    // ['a+{2}'],
    // FIXME: invalid ranges:
    // ['[a-#]'],
    // ['[%-#]'],
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

