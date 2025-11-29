import * as AST from "./ast"
import * as P from "./parser"
import * as CharSet from './char-set'
import * as Range from './code-point-range'
import { assert } from "./utils"

const regExpFlags = [
  'hasIndices',
  'global',
  'ignoreCase',
  'multiline',
  'dotAll',
  'unicode',
  'unicodeSets',
  'sticky',
] as const

// type RegExpFlag = typeof regExpFlags[number]

const wildcard = P.string('.').map(
  () => AST.literal(CharSet.wildcard({ dotAll: false }))
)

const alphaNumChar = P.satisfy(char => /^[a-zA-Z0-9]$/.test(char))

const unescapedCharInsideBrackets = P.satisfy(char => !Range.mustBeEscapedInsideBrackets(char))
  .map(CharSet.singleton)

const unescapedCharOutsideBrackets = P.satisfy(char => !Range.mustBeEscapedOutsideBrackets(char))
  .map(CharSet.singleton)

export class UnsupportedSyntaxError extends Error {
  name = "UnsupportedSyntaxError"
}

const escapeSequence = P.string('\\').andThen(_ => P.anyChar).andThen(escapedChar => {
  switch (escapedChar) {
    case 'w': return P.pure(CharSet.wordChars)
    case 'W': return P.pure(CharSet.nonWordChars)
    case 's': return P.pure(CharSet.whiteSpaceChars)
    case 'S': return P.pure(CharSet.nonWhiteSpaceChars)
    case 'd': return P.pure(CharSet.digitChars)
    case 'D': return P.pure(CharSet.nonDigitChars)
    case 't': return P.pure(CharSet.singleton('\t')) // horizontal tab
    case 'r': return P.pure(CharSet.singleton('\r')) // carriage return
    case 'n': return P.pure(CharSet.singleton('\n')) // line feed
    case 'v': return P.pure(CharSet.singleton('\v')) // vertical tab
    case 'f': return P.pure(CharSet.singleton('\f')) // form feed
    case '0': return P.pure(CharSet.singleton('\0')) // NUL character
    case 'b': throw new UnsupportedSyntaxError('\b word-boundary assertion')
    case 'c': throw new UnsupportedSyntaxError('\cX control characters')
    case 'x': return P.count(2, P.hexChar).map(chars =>
      CharSet.fromRange(Range.singleton(parseInt(chars.join(''), 16)))
    )
    case 'u': return P.count(4, P.hexChar).map(chars =>
      CharSet.fromRange(Range.singleton(parseInt(chars.join(''), 16)))
    )
    case 'p': throw new UnsupportedSyntaxError('\\p')
    case 'P': throw new UnsupportedSyntaxError('\\P')
    default: return P.pure(CharSet.singleton(escapedChar)) // match character literally
  }
})

// E.g. "a-z", "0-9", "A-Z"
const alphaNumRange: P.Parser<CharSet.CharSet> = alphaNumChar.andThen(start =>
  P.optional(P.string('-')).andThen(dash => {
    if (dash === undefined) {
      // e.g. [a]
      return P.pure(CharSet.singleton(start))
    } else {
      return P.optional(alphaNumChar).map(end => {
        if (end === undefined) {
          // e.g. [a-] so dash is interpreted literally
          return CharSet.fromArray([start, dash])
        } else {
          // e.g. [a-z]
          return CharSet.charRange(start, end)
        }
      })
    }
  })
)

const charSet = P.choice([
  P.between(
    // square brackets can't be nested
    P.string('['),
    P.string(']'),
    P.optional(P.string('^')).andThen(negated =>
      P.many(P.choice([
        escapeSequence, // e.g. "\$", "\]"
        alphaNumRange, // e.g. "a-z", "0-9" (will also match just "a", "3")
        unescapedCharInsideBrackets, // e.g. "$", "."
      ])).map(
        sets => {
          if (negated === undefined)
            return sets.reduce(CharSet.union, CharSet.empty)
          else
            return sets.reduce(CharSet.difference, CharSet.alphabet)
        }
      )
    )
  ),
  unescapedCharOutsideBrackets,
])

const captureGroupName =
  P.sequence([
    // must start with non-number word char:
    P.satisfy(char => /^[a-zA-Z_]$/.test(char)),
    // followed by arbitrary word chars:
    P.many(P.satisfy(char => /^\w$/.test(char))),
  ]).map(([firstChar, restChars]) => {
    return firstChar + restChars.join('')
  })

const group = P.choice([
  // non-capture group:
  P.between(
    P.string('(?:'),
    P.string(')'),
    regex()
  ), // returns inner directly
  // named capture group:
  P.sequence([
    P.string('(?<'),
    captureGroupName,
    P.string('>'),
    regex(),
    P.string(')')
  ]).map(([_, name, __, inner, ___]) =>
    AST.captureGroup(inner, name)
  ),
  // regular capture group:
  P.between(
    P.string('('),
    P.string(')'),
    regex()
  ).map(AST.captureGroup)
])

// Need to backtrack on bounded quantifier because if the curly bracket is
// not terminated (e.g. "a{2,3") then all characters are interpreted literally.
// The same if min value is missing but max value is given (e.g. "a{,3}").
//
// FIXME: However, this breaks something else. E.g. "a*{3}" must still be rejected as
// invalid and not interpreted as "a*" and then literal charactesr "{3}".
const boundedQuantifier: P.Expr.UnaryOperator<AST.RegExpAST> = P.tryElseBacktrack(
  P.between(
    P.string('{'),
    P.string('}'),
    P.decimal.andThen(min =>
      P.optional(P.string(',')).andThen(comma => {
        if (comma === undefined)
          // e.g. a{3}
          return P.pure(inner => AST.repeat(inner, min))
        else
          return P.optional(P.decimal).map(max => inner => {
            if (max === undefined)
              // e.g. a{3,}
              return AST.repeat(inner, { min })
            else
              // e.g. a{3,5}
              return AST.repeat(inner, { min, max })
          })
      })
    )
  )
)

const positiveLookAhead = P.between(
  P.string('(?='),
  P.string(')'),
  regex(),
).map(inner => AST.lookahead(true, inner))

const negativeLookAhead = P.between(
  P.string('(?!'),
  P.string(')'),
  regex(),
).map(inner => AST.lookahead(false, inner))

const positiveLookBehind = P.between(
  P.string('(?<='),
  P.string(')'),
  regex(),
).map(inner => AST.lookbehind(true, inner))

const negativeLookBehind = P.between(
  P.string('(?<!'),
  P.string(')'),
  regex(),
).map(inner => AST.lookbehind(false, inner))

function regexTerm() {
  return P.choice([
    wildcard,
    P.tryElseBacktrack(group),
    escapeSequence.map(AST.literal),
    charSet.map(AST.literal),
    positiveLookAhead,
    negativeLookAhead,
    positiveLookBehind,
    negativeLookBehind,
  ])
}

function regex(): P.Parser<AST.RegExpAST> {
  const nonEmptyRegex = P.lazy(() => P.Expr.makeExprParser<AST.RegExpAST>(
    regexTerm(),
    [
      { type: 'postfix', op: P.string('*').map(_ => AST.star) },
      { type: 'postfix', op: boundedQuantifier },
      { type: 'postfix', op: P.string('+').map(_ => AST.plus) },
      { type: 'postfix', op: P.string('?').map(_ => AST.optional) },
      { type: 'infixRight', op: P.string('').map(_ => AST.concat) },
      { type: 'infixRightOptional', op: P.string('$').map(_ => AST.endAnchor) },
      { type: 'infixRightOptional', op: P.string('^').map(_ => AST.startAnchor) },
      { type: 'infixRightOptional', op: P.string('|').map(_ => AST.union) },
    ]
  ))

  return P.optional(nonEmptyRegex).map(ast => {
    if (ast === undefined)
      return AST.epsilon
    else
      return ast
  })
}

export function parseRegExpString(
  regexStr: string,
): AST.RegExpAST {
  const { value, restInput } = regex().run(regexStr)
  if (restInput === '') {
    return value
  } else {
    throw new P.ParseError('Expected end of input.', restInput)
  }
}

/**
 * TODO: docs
 *
 * @public
 */
export function parseRegExp(regexp: RegExp): AST.RegExpAST {
  for (const flag of regExpFlags) {
    assert(!regexp[flag], `[regex-utils] RegExp flags not supported`)
  }

  return parseRegExpString(regexp.source)
}
