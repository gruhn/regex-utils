import * as RE from "./extended-regex"
import * as P from "./parser"
import * as CharSet from './char-set'

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

const group = P.between(
  P.string('('),
  P.string(')'),
  regex()
)

function regexTerm() {
  return P.choice([
    anySingle, 
    singleCharacter,
    group,
  ])
}
 
function regex(): P.Parser<RE.ExtRegex> {
  return P.lazy(() => P.Expr.makeExprParser(
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

const regexWithBounds = P.sequence([
  startMarker,
  regex(),
  endMarker,
]).map(RE.concatAll)

export function parseRegexString(regexStr: string): RE.ExtRegex {
  const { value, restInput } = regexWithBounds.run(regexStr)
  if (restInput === '') {
    return value
  } else {
    throw new P.ParseError('Expected end of input. Got: ' + restInput)
  }
}

export function parseRegExp(regexp: RegExp): RE.ExtRegex {
  return parseRegexString(regexp.source)
}

export function toRegExp(regex: RE.ExtRegex): RegExp {
  throw 'todo'
}
