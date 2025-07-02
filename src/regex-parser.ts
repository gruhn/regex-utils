import * as RE from "./regex"
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

const startMarker = P.optional(P.string('^')).map(marker => {
  if (marker === undefined) {
    return RE.star(RE.anySingleChar)
  } else {
    return RE.epsilon
  }
})

const endMarker = P.optional(P.string('$')).map(marker => {
  if (marker === undefined) {
    return RE.star(RE.anySingleChar)
  } else {
    return RE.epsilon
  }
})

const wildcard = P.string('.').map(
  () => RE.literal(CharSet.wildcard({ dotAll: false }))
)

const alphaNumChar = P.satisfy(char => /^[a-zA-Z0-9]$/.test(char))

const unescapedCharInsideBrackets = P.satisfy(char => !Range.mustBeEscapedInsideBrackets(char))
  .map(CharSet.singleton)

const unescapedCharOutsideBrackets = P.satisfy(char => !Range.mustBeEscapedOutsideBrackets(char))
  .map(CharSet.singleton)

export class UnsupportedSyntaxError extends Error {}

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
    case 'b': throw new UnsupportedSyntaxError('\b word-boundary assertion not supported')
    case 'c': throw new UnsupportedSyntaxError('\cX control characters not supported')
    case 'x': return P.count(2, P.hexChar).map(chars => 
                CharSet.fromRange(Range.singleton(parseInt(chars.join(''), 16)))
              )
    case 'u': return P.count(4, P.hexChar).map(chars =>
                CharSet.fromRange(Range.singleton(parseInt(chars.join(''), 16)))
              )
    case 'p': throw new UnsupportedSyntaxError('\\p not supported')
    case 'P': throw new UnsupportedSyntaxError('\\P not supported')
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
    // square brackets cant't be nested
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

const group = P.between(
  P.choice<unknown>([
    // non-capture group:
    P.string('(?:'),
    // named capture group:
    P.sequence([
      P.string('(?<'),
      P.some(P.satisfy(char => /^\w$/.test(char))),
      P.string('>'),
    ]),
    // regular capture group:
    P.string('('),
  ]),
  P.string(')'),
  regex(),
)

// Need to backtrack on bounded quantifier because if the curly bracket is
// not terminated (e.g. "a{2,3") then all characters are interpreted literally.
// FIXME: However, this breaks something else. E.g. "a*{3}" must still be rejected as
// invalid and not interpreted as "a*" and then literal charactesr "{3}".
const boundedQuantifier: P.Expr.UnaryOperator<RE.ExtRegex> = P.tryElseBacktrack(
  P.between(
    P.string('{'),
    P.string('}'),
    P.optional(P.decimal).andThen(min => {
      if (min === undefined)
        // e.g. a{,5}
        return P.string(',')
          .andThen(_ => P.decimal)
          .map(max => regex => RE.repeat(regex, { max }))
      else
        return P.optional(P.string(',')).andThen(comma => {
          if (comma === undefined)
            // e.g. a{3}
            return P.pure(regex => RE.repeat(regex, min))
          else
            return P.optional(P.decimal).map(max => regex => {
              if (max === undefined)
                // e.g. a{3,}
                return RE.repeat(regex, { min })
              else
                // e.g. a{3,5}
                return RE.repeat(regex, { min, max })
            })
        })
    })
  )
)

function regexTerm() {
  return P.choice([
    wildcard, 
    P.tryElseBacktrack(group),
    escapeSequence.map(RE.literal),
    charSet.map(RE.literal),
  ])
}

function positiveLookAhead(): P.Expr.UnaryOperator<RE.ExtRegex> {
  return P.between(
    P.string('(?='),
    P.string(')'),
    regexWithBounds()    
  ).map(inner => right =>
    RE.intersection(inner, right)
  )
}

function negativeLookAhead(): P.Expr.UnaryOperator<RE.ExtRegex> {
  return P.between(
    P.string('(?!'),
    P.string(')'),
    regexWithBounds()    
  ).map(inner => right =>
    RE.intersection(RE.complement(inner), right)
  )
}

/**
 * We treat lookAheads like a right-associative infix operator
 * even though it only "acts" on the right hand side:
 * 
 *     aaa (?=bbb) ccc
 * 
 * We could treat it as a prefix operator but then it's 
 * unclear what should have higher precedence: concat or 
 * lookAhead? But even when treating lookAheads as infix
 * operators, they need special treatment because the left- and
 * right operand can be optional:
 * 
 *     (?=bbb) fff
 *     aaa (?=bbb) 
 *     aaa (?=bbb) (?!ccc) ddd
 */
function lookAheadOp(): P.Expr.BinaryOperator<RE.ExtRegex | undefined, RE.ExtRegex> {
  return P.choice([
    positiveLookAhead(),
    negativeLookAhead(),
  ]).map(op => (left, right) =>
    RE.concat(
      left ?? RE.string(''),
      op(right ?? RE.string(''))
    )
  )
}

/**
 * Parses expression like `(a|b)`. The left- and right operand are optional,
 * e.g. `(a|)` and `(|)` are also valid expressions.
 */
function unionOp(): P.Expr.BinaryOperator<RE.ExtRegex | undefined, RE.ExtRegex> {
  return P.string('|').map(_ => (left, right) => RE.union(left ?? RE.epsilon, right ?? RE.epsilon))
}
 
function regex(): P.Parser<RE.ExtRegex> {
  return P.lazy(() => P.Expr.makeExprParser<RE.ExtRegex>(
    regexTerm(),
    [
      { type: 'postfix', op: P.string('*').map(_ => RE.star) },
      { type: 'postfix', op: boundedQuantifier },
      { type: 'postfix', op: P.string('+').map(_ => RE.plus) },
      { type: 'postfix', op: P.string('?').map(_ => RE.optional) },
      { type: 'infixRight', op: P.string('').map(_ => RE.concat) },
      { type: 'infixRightOptional', op: lookAheadOp() },
      { type: 'infixRightOptional', op: unionOp() },
    ]
  ))
}

// TODO: start- and end marker are not necessarily at the 
// beginning/end of the regex:
function regexWithBounds() {
  return P.sequence([
    startMarker,
    regex(),
    endMarker,
  ]).map<RE.ExtRegex>(RE.seq)
}

export function parseRegexString(
  regexStr: string,
): RE.ExtRegex {
  const { value, restInput } = regexWithBounds().run(regexStr)
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
export function parseRegExp(regexp: RegExp): RE.ExtRegex {
  for (const flag of regExpFlags) {
    assert(!regexp[flag], `[regex-utils] RegExp flags not supported`)
  }

  return parseRegexString(regexp.source)
}

