import { describe, it, test } from "node:test"
import assert from "node:assert"
import { parseRegExp, parseRegExpString, UnsupportedSyntaxError } from "../src/regex-parser"
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

  const astTestCases = [
    [/a/, char('a')],
    [/(a)/, group(char('a'))],
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
    // positive lookahead
    [/(?=a)b/, AST.concat(AST.lookahead(true, char('a')), char('b'))],
    [/(?=a)(?:b)/, AST.concat(AST.lookahead(true, char('a')), char('b'))],
    [/(?=a)(?=b)c/, AST.concat(AST.lookahead(true, char('a')), AST.concat(AST.lookahead(true, char('b')), char('c')))],
    [/a(?=b)c/, AST.concat(char('a'), AST.concat(AST.lookahead(true, char('b')), char('c')))],
    [/a(?=b)/, AST.seq([char('a'), AST.lookahead(true, char('b'))])],
    [/a(?=b)c(?=d)e/, AST.seq([char('a'), AST.lookahead(true, char('b')), char('c'), AST.lookahead(true, char('d')), char('e')])],
    [/(?=)/, AST.lookahead(true, AST.epsilon)],
    [/(?=a){2}/, AST.repeat(AST.lookahead(true, char('a')), 2)],
    [/(?=a)*/, AST.star(AST.lookahead(true, char('a')))],
    // negative lookahead
    [/(?!a)b/, AST.concat(AST.lookahead(false, char('a')), char('b'))],
    [/(?!a)b|c/, AST.union(AST.concat(AST.lookahead(false, char('a')), char('b')), char('c'))],
    [/(?!)/, AST.lookahead(false, AST.epsilon)],
    // positive lookbehind
    [/(?<=a)/, AST.lookbehind(true, char('a'))],
    // negative lookbehind
    [/(?<!a)/, AST.lookbehind(false, char('a'))],
  ] as const

  for (const [regexp, expected] of astTestCases) {
    it(`returns correct AST for ${regexp}`, () => {
      assert.equal(
        AST.debugShow(parseRegExp(regexp)),
        AST.debugShow(expected)
      )
    })
  }

  const charSetTestCases = [
    [/./, CharSet.wildcard()],
    // char classes / escaping:
    [/\w/, CharSet.wordChars],
    [/[\w]/, CharSet.wordChars], // surrounding brackets change nothing
    [/\W/, CharSet.nonWordChars],
    [/\s/, CharSet.whiteSpaceChars],
    [/\S/, CharSet.nonWhiteSpaceChars],
    [/\d/, CharSet.digitChars],
    [/\D/, CharSet.nonDigitChars],
    [/\n/, CharSet.singleton('\n')],
    [/\./, CharSet.singleton('.')],
    [/\x5A/, CharSet.singleton('Z')],
    [/\x{005A}/, CharSet.singleton('Z')],
    // char class from range:
    [/[a-z]/, CharSet.charRange('a', 'z')],
    // combined range/char classes:
    [/[a-z_A-Z\d]/, CharSet.wordChars],
    // when dash is at the start or end it's interpreted literally:
    [/[a-]/, CharSet.fromArray(['a', '-'])],
    [/[-a]/, CharSet.fromArray(['a', '-'])],
    // except the for [^-a] (this is not a range):
    [/[^-a]/, CharSet.complement(CharSet.fromArray(['a', '-']))],
    // can also have ranges of non-alphanumeric chars:
    [/[ -~]/, CharSet.printableAsciiChars],
    [/[\x20-\x7E]/, CharSet.printableAsciiChars],
    // interpreted as range from dash to dash:
    [/[---]/, CharSet.singleton('-')],
    // interpreted as: range 'a-c' and literal '-' and 'e':
    [/[a-c-e]/, CharSet.fromArray(['a', 'b', 'c', '-', 'e'])],
    // negative char class:
    [/[^abc]/, CharSet.complement(CharSet.fromArray(['a', 'b', 'c']))],
    // some special chars don't need escape when inside brackets:
    [/[.^$*+?()[{|]/, CharSet.fromArray([...'.^$*+?()[{|'])],
    // other special chars need escape even inside brackets:
    [/[\\\]\/]/, CharSet.fromArray([...'\\]/'])],
  ] as const

  for (const [regexp, expected] of charSetTestCases) {
    it(`returns correct CharSet for ${regexp}`, () => {
      const parsed = parseRegExp(regexp)
      assert(parsed.type === 'literal')
      assert.deepEqual(
        [...CharSet.getRanges(parsed.charset)],
        [...CharSet.getRanges(expected)]
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
    // '[z-a]', // out-of-order ranges
    // '[\\w-z]', // can't have range between char classes
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

function parse_skipKnownIssues(re: RegExp) {
  try {
    return RB(re)
  } catch (error) {
    if (error instanceof UnsupportedSyntaxError) {
      fc.pre(false)
    } else {
      throw error
    }
  }
}

test('parse/stringify roundtrip preserves equivalence', { todo: true }, () => {
  fc.assert(
    fc.property(
      Arbitrary.regexp(),
      (inputRegExp: RegExp) => {
        const builder = parse_skipKnownIssues(inputRegExp)
        const outputRegExp = builder.toRegExp()

        for (const str of builder.enumerate().take(10)) {
          assert.match(str, outputRegExp)
          assert.match(str, inputRegExp)
        }
      },
    ),
    { numRuns: 100 },
  )
})
