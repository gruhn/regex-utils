import * as RE from './regex'
import { parseRegExp } from './regex-parser'

/**
 * Returns a regular expression that matches the union of the languages of the given regular expressions.
 */
export function intersection(re1: RegExp, re2: RegExp): RegExp {
  const parsed1 = parseRegExp(re1)
  const parsed2 = parseRegExp(re2)
  const result = RE.toStdRegex(RE.intersection(parsed1, parsed2))
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
 * Checks whether the two given regex are equivalent, i.e. whether they match the same strings.
 */
export function equivalent(re1: RegExp, re2: RegExp): boolean {
  throw 'todo'
  // return RegexTree.equivalent(
  //   RegexTree.fromRegExp(re1),
  //   RegexTree.fromRegExp(re2)
  // )
}
