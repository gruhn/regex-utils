import * as RE from "./regex"
import * as P from "./parser"
import * as CharSet from './char-set'
import * as Range from './code-point-range'
import { assert } from "./utils"

// TODO:
// - "\." (escaped dot), "\s" (all whitespace characters)
// - "[a-zA-Z]"
// - "a{3,5}", "a{3,}", "a{,5}"
// - ...
// TODO: allow empty strings, e.g. regex like "(|)"
// const emptyString = P.string('').map(() => RE.epsilon)

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

const wildcard = P.string('.').map(() => RE.anySingleChar)

// TODO: there are probably more literal characters:
function isLiteralChar(char: string): boolean {
  return char.match(/^[a-zA-Z0-9]$/) !== null
}

const singleChar = P.satisfy(isLiteralChar)

const codePoint = singleChar.map(char => {
  const result = char.codePointAt(0)!
  assert(result !== undefined)
  return result
})

const codePointRange: P.Parser<Range.CodePointRange> =
  codePoint.andThen(start =>
    P.optional(P.string('-').andThen(_ => codePoint))
     .map(end => Range.range(start, end))
  )

const charSet = P.choice([
  P.between(
    // QUESTION: can brackets be nested?
    P.string('['),
    P.string(']'),
    P.many(codePointRange).map(
      ranges => ranges.reduce(CharSet.insertRange, CharSet.empty)
    )
  ),
  singleChar.map(CharSet.singleton),
])

const group = P.between(
  P.string('('),
  P.string(')'),
  regex(),
)

function regexTerm() {
  return P.choice([
    wildcard, 
    group,
    charSet.map(RE.literal),
  ])
}
 
function regex(): P.Parser<RE.StdRegex> {
  return P.lazy(() => P.Expr.makeExprParser<RE.StdRegex>(
    regexTerm(),
    [
      { type: 'postfix', op: P.string('*').map(_ => RE.star) },
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
]).map<RE.StdRegex>(RE.concatAll)

export function parseRegexString(regexStr: string): RE.StdRegex {
  const { value, restInput } = regexWithBounds.run(regexStr)
  if (restInput === '') {
    // TODO: parsing should always return stdandard regex instances:
    return value
  } else {
    throw new P.ParseError('Expected end of input.', restInput)
  }
}

export function parseRegExp(regexp: RegExp): RE.StdRegex {
  // TODO: reject other unsupported flags
  assert(!regexp.unicode, '[regex-utils] unicode mode not supported')
  assert(!regexp.unicodeSets, '[regex-utils] unicodeSets mode not supported')
  return parseRegexString(regexp.source)
}

