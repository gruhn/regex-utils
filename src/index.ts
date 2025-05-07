import * as RE from './regex'
import * as DFA from './dfa'
import { parseRegExp } from './regex-parser'

/**
 * Returns a regular expression that matches the intersection of the languages of the given regular expressions.
 */
export function intersection(...res: RegExp[]): RegExp {
  if (res.length === 0) {
    // intersection of nothing is the regex that matches everything:
    return RE.toRegExp(RE.star(RE.anySingleChar))
  } else if (res.length === 1) {
    return res[0]
  } else {
    const parsed = res.map(parseRegExp)   
    const result = DFA.toStdRegex(RE.intersectAll(parsed))
    return RE.toRegExp(result)
  }
}

/**
 * TODO
 */
export function complement(re: RegExp): RegExp {
  const parsed = parseRegExp(re)
  const result = DFA.toStdRegex(RE.complement(parsed))
  return RE.toRegExp(result)
}

/**
 * Enumerates the strings that are matched by the given regular expression.
 */
export function* enumerate(re: RegExp): Generator<string> {
  yield* RE.enumerate(parseRegExp(re))
}

/**
 * TODO
 */
export function derivative(prefix: string, re: RegExp): RegExp {
  const parsed = parseRegExp(re)
  const result = RE.derivative(prefix, parsed)
  return RE.toRegExp(result)
}

/**
 * TODO
 */
export function size(re: RegExp): bigint | undefined {
  return RE.size(parseRegExp(re))
}
