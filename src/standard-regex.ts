import { checkedAllCases } from './utils'
import * as CharSet from './char-set';
import { ExtRegex } from './extended-regex';
import * as Stream from './stream';

/**
 * TODO
 */
export type StdRegex = Readonly<{ hash: number } & (
  | { type: "epsilon" }
  | { type: "literal", charset: CharSet.CharSet }
  | { type: "concat", left: StdRegex, right: StdRegex }
  | { type: "union", left: StdRegex, right: StdRegex }
  | { type: "star", inner: StdRegex }
)>

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

export function isStdRegex(regex: ExtRegex): regex is StdRegex {
  if (regex.type === 'epsilon' || regex.type === 'literal') 
    return true
  else if (regex.type === 'concat' || regex.type === 'union')
    return isStdRegex(regex.left) && isStdRegex(regex.right)
  else if (regex.type === 'star')
    return isStdRegex(regex.inner)
  else if (regex.type === 'complement' || regex.type === 'intersection')
    return false
  checkedAllCases(regex)
}


export function enumerate(regex: StdRegex): Stream.Stream<string> {
  switch (regex.type) {
    case 'epsilon':
      return Stream.singleton('')
    case 'literal':
      return CharSet.enumerate(regex.charset)
    case 'concat':
      return Stream.diagonalize(
        (l,r) => l+r,
        enumerate(regex.left),
        enumerate(regex.right),
      )
    case 'union':
      return Stream.interleave(
        enumerate(regex.left),
        enumerate(regex.right)
      )
    case 'star':
      return Stream.cons(
        '',
        () => Stream.diagonalize(
          (l,r) => l+r,
          enumerate(regex.inner),
          enumerate(regex),
        )
      )
  }
}
