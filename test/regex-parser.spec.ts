import { describe, expect, it, bench } from "vitest"
import { parseRegExp, parseRegexString } from "../src/regex-parser"
import { ParseError } from "../src/parser"
import * as RE from "../src/extended-regex"
import { readBenchFile } from './read-bench'

describe('parseRegexString', () => { 

  it.each([
    [/a/, RE.singleChar('a')],
    [/(a)/, RE.singleChar('a')],
    [/./, RE.anySingleChar],
    [/a*/, RE.star(RE.singleChar('a'))],
    [/a+/, RE.plus(RE.singleChar('a'))],
    [/a?/, RE.optional(RE.singleChar('a'))],
    [/abc/, RE.string('abc')],
    [/a|b/, RE.union(RE.singleChar('a'), RE.singleChar('b'))],
    [/aa|bb/, RE.union(RE.string('aa'), RE.string('bb'))],
    [/(a|b)*/, RE.star(RE.union(RE.singleChar('a'), RE.singleChar('b')))],
    [/ab*/, RE.concat(RE.singleChar('a'), RE.star(RE.singleChar('b')))],
  ])('can parses %s', (regexp, expected) => {
    const result = parseRegexString('^' + regexp.source + '$')
    expect(result).toEqual(expected)
  })

  it.each([
    ['a+*'],
    ['(a'],
  ])('rejects invalid regex /%s/', (regexStr) => {
    expect(() => parseRegexString(regexStr)).toThrowError(ParseError)
  })

  // it.only('can parse all regex from the benchmark', () => {
  //   for (const [regex1, regex2] of readBenchFile()) {
  //     let timeNow = performance.now()
  //     parseRegExp(regex1)
  //     console.debug(timeNow - performance.now())
  //     timeNow = performance.now()
  //     parseRegExp(regex2)
  //     console.debug(timeNow - performance.now())
  //   }
  // })

})

