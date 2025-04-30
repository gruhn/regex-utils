import * as RE from './regex'
import { parseRegExp } from './regex-parser'

/**
 * Returns a regular expression that matches the union of the languages of the given regular expressions.
 */
export function intersection(...res: RegExp[]): RegExp {
  const parsed = res.map(parseRegExp)   
  const result = RE.toStdRegex(RE.intersectAll(parsed))
  return RE.toRegExp(result)
}

/**
 * TODO
 */
export function complement(re: RegExp): RegExp {
  const parsed = parseRegExp(re)
  const result = RE.toStdRegex(RE.complement(parsed))
  return RE.toRegExp(result)
}

/**
 * Enumerates the strings that are matched by the given regular expression.
 */
export function* enumerate(re: RegExp): Generator<string> {
  let stream = RE.enumerate(parseRegExp(re))

  while (stream !== undefined) {
    yield stream.head 
    stream = stream.tail()
  }
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
