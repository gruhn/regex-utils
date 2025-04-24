import { checkedAllCases } from './utils'
import * as CharSet from './char-set';

/**
 * TODO
 */
export type StdRegex = Readonly<
  | { type: "epsilon" }
  | { type: "literal", charset: CharSet.CharSet }
  | { type: "concat", left: StdRegex, right: StdRegex }
  | { type: "union", left: StdRegex, right: StdRegex }
  | { type: "star", inner: StdRegex }
>

// TODO: make this more compact by using fewer parenthesis and
// recognizing patterns like "a+" instead of "aa*" etc.
export function toString(regex: StdRegex): string {
  switch (regex.type) {
    case 'epsilon':
      return ''
    case 'literal':
      return CharSet.toString(regex.charset)
    case 'concat':
      return toString(regex.left) + toString(regex.right)
    case 'union':
      return `(${toString(regex.left)}|${toString(regex.right)})`
    case 'star':
      return `(${toString(regex.inner)})*`
  }
  checkedAllCases(regex)
}
