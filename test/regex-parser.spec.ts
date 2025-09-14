import { describe, it, test } from "node:test"
import assert from "node:assert"
import { parseRegExp, parseRegExpString } from "../src/regex-parser"
import { RB } from "../src/index"
import { ParseError } from "../src/parser"
import * as AST from "../src/ast"
import * as CharSet from "../src/char-set"
import fc from "fast-check"
import * as Arbitrary from './arbitrary-ast'

// Helper functions for cleaner test construction
function char(c: string) {
  return AST.literal(CharSet.singleton(c))
}
function str(s: string) { 
  const chars = [...s].map(char)
  // Use right-associative concatenation: a(bc) not (ab)c
  return chars.reduceRight((acc, curr) => AST.concat(curr, acc))
}
function group(inner: AST.RegExpAST, name?: string) {
  return AST.captureGroup(inner, name)
}

describe('parseRegExp', () => {

  const testCases = [
    [/a/, char('a')],
    [/(a)/, group(char('a'))],
    [/./, AST.literal(CharSet.wildcard({ dotAll: false }))],
    // [/./s, AST.literal(CharSet.wildcard({ dotAll: true }))],
    [/a*/, AST.star(char('a'))],
    [/a+/, AST.plus(char('a'))],
    [/a?/, AST.optional(char('a'))],
    [/abc/, str('abc')],
    [/ab*/, AST.concat(char('a'), AST.star(char('b')))],
    // union:
    [/a|b/, AST.union(char('a'), char('b'))],
    [/aa|bb/, AST.union(str('aa'), str('bb'))],
    [/(a|b)*/, AST.star(group(AST.union(char('a'), char('b'))))],
    [/ab*/, AST.concat(char('a'), AST.star(char('b')))],
    // bounded quantifier:
    [/a{3}/, AST.repeat(char('a'), 3)],
    [/a{3,}/, AST.repeat(char('a'), { min: 3 })],
    [/a{3,5}/, AST.repeat(char('a'), { min: 3, max: 5 })],
    // if curly bracket is not terminated the whole thing is interpreted literally:
    [/a{3,5/, str('a{3,5')],
    // same if max value is given but min value is missing: 
    [/a{,5}/, str('a{,5}')],
    // char classes / escaping:
    [/\w/, AST.literal(CharSet.wordChars)],
    [/\W/, AST.literal(CharSet.nonWordChars)],
    [/\n/, AST.literal(CharSet.singleton('\n'))],
    [/\./, AST.literal(CharSet.singleton('.'))],
    // char class from range:
    [/[a-z]/, AST.literal(CharSet.charRange('a', 'z'))],
    [/[a-]/, AST.literal(CharSet.fromArray(['a', '-']))],
    // negative char class:
    [/[^abc]/, AST.literal(CharSet.complement(CharSet.fromArray(['a', 'b', 'c'])))],
    // regular capturing groups:
    [/()/, group(AST.epsilon)],
    // non-capturing groups
    [/(?:ab)/, str('ab')],
    [/(?:)/, AST.epsilon],
    // named capturing groups
    [/(?<abc_012_ABC>abc)/, group(str('abc'), 'abc_012_ABC')],
    [/(?<ABC>abc)/, group(str('abc'), 'ABC')],
    [/(?<___>abc)/, group(str('abc'), '___')],
    // start/end marker
    [/^abc/, AST.startAnchor(undefined, str('abc'))],
    [/a^b/, AST.startAnchor(char('a'), str('b'))],
    [/^a|^b/, AST.union(AST.startAnchor(undefined, str('a')), AST.startAnchor(undefined, char('b')))],
    [/^abc$/, AST.startAnchor(undefined, AST.endAnchor(str('abc'), undefined))],
    [/$a^/, AST.startAnchor(AST.endAnchor(undefined, char('a')), undefined)],
    // positive lookahead - now parsed as lookahead AST nodes, not intersections
    [/(?=a)b/, AST.positiveLookahead(char('a'), char('b'))], 
    [/(?=a)(?:b)/, AST.positiveLookahead(char('a'), char('b'))], 
    [/(?=a)(?=b)c/, AST.positiveLookahead(char('a'), AST.positiveLookahead(char('b'), char('c')))], 
    [/a(?=b)c/, AST.concat(char('a'), AST.positiveLookahead(char('b'), char('c')))], 
    [/a(?=b)/, AST.concat(char('a'), AST.positiveLookahead(char('b'), AST.epsilon))], 
    [/a(?=b)c(?=d)e/, AST.concat(char('a'), AST.positiveLookahead(char('b'), AST.concat(char('c'), AST.positiveLookahead(char('d'), char('e')))))], 
    [/(?=)/, AST.positiveLookahead(AST.epsilon, AST.epsilon)], 
    // negative lookahead
    [/(?!a)b/, AST.negativeLookahead(char('a'), char('b'))], 
    [/(?!a)b|c/, AST.union(AST.negativeLookahead(char('a'), char('b')), char('c'))],
    [/(?!)/, AST.negativeLookahead(AST.epsilon, AST.epsilon)],
    // TODO: positive lookbehind
    // [/(?<=a)/, AST.positiveLookbehind(char('a'))], 
    // TODO: negative lookbehind
    // [/(?<!a)/, AST.negativeLookbehind(char('a'))], 
    // some special chars don't need escape when inside brackets:
    [/[.^$*+?()[{-|]/, AST.literal(CharSet.fromArray([...'.^$*+?()[{-|']))],
    // other special chars need escape even inside brackets:
    [/[\\\]\/]/, AST.literal(CharSet.fromArray([...'\\]/']))],
  ] as const

  for (const [regexp, expected] of testCases) {
    it(`can parse ${regexp}`, () => {
      assert.deepStrictEqual(
        AST.debugShow(parseRegExp(regexp)),
        AST.debugShow(expected)
      )
    })
  }

  const invalidTestCases = [
    // unclosed parenthesis:
    '(a',
    // combined quantifiers:
    'a+*',
    // invalid capture group names:
    '(?<1abc>.)',

    // TODO: duplicate capture group name:
    // '(?<abc>.)(?<abc>.)',

    // TODO:
    // 'a?{2}',
    // 'a+{2}',

    // TODO: invalid ranges:
    // '[a-#]',
    // '[%-#]',
  ]

  for (const regexStr of invalidTestCases) {
    it(`rejects invalid regex /${regexStr}/`, () => {
      assert.throws(() => parseRegExpString(regexStr), ParseError)
    })
  }

  it('can parse email regex', () => {
    parseRegExp(/^[\w\-\.]+@([\w-]+\.)+[\w-]{2,}$/)
  })

})

test('parse/stringify roundtrip preserves equivalence', {todo:true}, () => {
  fc.assert(
    fc.property(
      Arbitrary.regexp(),
      (inputRegExp: RegExp) => {
        const builder = RB(inputRegExp)
        const outputRegExp = builder.toRegExp()

        for (const str of builder.enumerate().take(100)) {
          assert.match(str, outputRegExp)
          assert.match(str, inputRegExp)
        }
      },
    ),
    // { numRuns: 1000 },
    // FIXME:
    { seed: 841961781, path: "495:1:0:0:0:1:1", endOnFailure: true }
  )
})

test('fixme 1', { todo: true }, () => {
  const inputRegExp = /(^)+a/
  const builder = RB(inputRegExp)
  const outputRegExp = builder.toRegExp()

  // console.debug(outputRegExp)

  for (const str of builder.enumerate().take(10)) {
    assert.match(str, outputRegExp)
    assert.match(str, inputRegExp)
  }
})
