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

type RegExpFlag = typeof regExpFlags[number]

// TODO:
// - parse \uXXXX notation
// - allow empty strings, e.g. regex like "(|)"
//   const emptyString = P.string('').map(() => RE.epsilon)

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

const singleChar = P.satisfy(char => !Range.isMetaChar(char))

const codePoint = singleChar.map(char => {
  const result = char.codePointAt(0)!
  assert(result !== undefined)
  return result
})

export class UnsupportedSyntaxError extends Error {}

const escapeSequence = P.string('\\').andThen(_ => P.anyChar).map(escapedChar => {
  switch (escapedChar) {
    case 'w': return CharSet.wordChars
    case 'W': return CharSet.nonWordChars
    case 's': return CharSet.whiteSpaceChars
    case 'S': return CharSet.nonWhiteSpaceChars
    case 'd': return CharSet.digitChars
    case 'D': return CharSet.nonDigitChars
    case 't': return CharSet.singleton('\t') // horizontal tab
    case 'r': return CharSet.singleton('\r') // carriage return
    case 'n': return CharSet.singleton('\n') // line feed
    case 'v': return CharSet.singleton('\v') // vertical tab
    case 'f': return CharSet.singleton('\f') // form feed
    case '0': return CharSet.singleton('\0') // NUL character
    case 'b': throw new UnsupportedSyntaxError('\b word-boundary assertion not supported')
    case 'c': throw new UnsupportedSyntaxError('\cX control characters not supported')
    case 'x': throw new UnsupportedSyntaxError('\\x not supported')
    case 'u': throw new UnsupportedSyntaxError('\\u not supported')
    case 'p': throw new UnsupportedSyntaxError('\\p not supported')
    case 'P': throw new UnsupportedSyntaxError('\\P not supported')
    default: return CharSet.singleton(escapedChar) // match character literally
  }
})

const codePointRange: P.Parser<CharSet.CharSet> =
  codePoint.andThen(start =>
    P.optional(P.string('-').andThen(_ => codePoint))
     .map(end => CharSet.fromRange({ start, end: end ?? start }))
  )

const charSet = P.choice([
  P.between(
    // QUESTION: can brackets be nested?
    P.string('['),
    P.string(']'),
    P.optional(P.string('^')).andThen(negated =>
      P.many(P.choice([escapeSequence, codePointRange])).map(
        sets => {
          if (negated === undefined)
            return sets.reduce(CharSet.union, CharSet.empty)
          else
            return sets.reduce(CharSet.difference, CharSet.alphabet)
        }
      )
    )
  ),
  singleChar.map(CharSet.singleton),
])

const group = P.between(
  P.string('('),
  P.string(')'),
  regex(),
)

const boundedQuantifier: P.Parser<(inner: RE.StdRegex) => RE.StdRegex> = P.between(
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

function regexTerm() {
  return P.choice([
    wildcard, 
    group,
    escapeSequence.map(RE.literal),
    charSet.map(RE.literal),
  ])
}
 
function regex(): P.Parser<RE.StdRegex> {
  return P.lazy(() => P.Expr.makeExprParser<RE.StdRegex>(
    regexTerm(),
    [
      { type: 'postfix', op: P.string('*').map(_ => RE.star) },
      { type: 'postfix', op: boundedQuantifier },
      { type: 'postfix', op: P.string('+').map(_ => RE.plus) },
      { type: 'postfix', op: P.string('?').map(_ => RE.optional) },
      { type: 'infixRight', op: P.string('').map(_ => RE.concat) },
      { type: 'infixRight', op: P.string('|').map(_ => RE.union) },
    ]
  ))
}

// TODO: start- and end marker are not necessarily at the 
// beginning/end of the regex:
const regexWithBounds = P.sequence([
  startMarker,
  regex(),
  endMarker,
]).map<RE.StdRegex>(RE.seq)

export function parseRegexString(
  regexStr: string,
): RE.StdRegex {
  const { value, restInput } = regexWithBounds.run(regexStr)
  if (restInput === '') {
    // TODO: parsing should always return stdandard regex instances:
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
export function parseRegExp(regexp: RegExp): RE.StdRegex {
  for (const flag of regExpFlags) {
    assert(!regexp[flag], `[regex-utils] RegExp flags not supported`)
  }

  return parseRegexString(regexp.source)
}

