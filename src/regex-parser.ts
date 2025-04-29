import * as RE from "./regex"
import * as P from "./parser"
import * as CharSet from './char-set'
import { assert } from "./utils"

// TODO:
// - "\." (escaped dot), "\s" (all whitespace characters)
// - "[a-zA-Z]"
// - "a{3,5}", "a{3,}", "a{,5}"
// - ...

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

const anySingle = P.string('.').map(() => RE.anySingleChar)

// TODO: there are probably more literal characters:
function isLiteralChar(char: string): boolean {
  return char.match(/^[a-zA-Z0-9]$/) !== null
}

const singleCharacter = P.satisfy(isLiteralChar).map(char => RE.literal(CharSet.singleton(char)))

// TODO: allow empty strings, e.g. regex like "(|)"
// const emptyString = P.string('').map(() => RE.epsilon)

const group = P.between(
  P.string('('),
  P.string(')'),
  regex(),
)

function regexTerm() {
  return P.choice([
    anySingle, 
    group,
    singleCharacter,
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

