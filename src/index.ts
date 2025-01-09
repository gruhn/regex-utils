import * as RE from './extended-regex'
import { parseRegExp, toRegExp } from './regex-parser'

/**
 * Returns a regular expression that matches the union of the languages of the given regular expressions.
 */
export function intersection(regex1: RegExp, regex2: RegExp): RegExp {
  return toRegExp(RE.intersection(parseRegExp(regex1), parseRegExp(regex2)))
}

/**
 * TODO
 */
export function complement(regex: RegExp): RegExp {
  return toRegExp(RE.complement(parseRegExp(regex)))
}

/**
 * Enumerates the strings that are matched by the given regular expression.
 */
export function* enumerate(regex: RegExp): Generator<string> {
  throw 'todo'
  // return RegexTree.enumerate(RegexTree.fromRegExp(re))
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
