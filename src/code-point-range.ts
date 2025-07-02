import { assert } from './utils'

export type CodePointRange = { start: number, end: number }

export const empty: CodePointRange = { start: +Infinity, end: -Infinity }

export function range(start: number, end: number = start): CodePointRange {
  if (start > end) 
    return empty
  else
    return { start, end }
}

export function includes(range: CodePointRange, codePoint: number): boolean {
  return range.start <= codePoint && codePoint <= range.end
}

export function isSubRangeOf(rangeA: CodePointRange, rangeB: CodePointRange): boolean {
  return rangeA.start >= rangeB.start && rangeA.end <= rangeB.end
}

export function isStrictlyBefore(rangeA: CodePointRange, rangeB: CodePointRange): boolean {
  // TODO: how to handle empty case?
  assert(!isEmpty(rangeA) && !isEmpty(rangeB))
  return rangeA.end + 1 < rangeB.start
}

export function isStrictlyAfter(rangeA: CodePointRange, rangeB: CodePointRange): boolean {
  return isStrictlyBefore(rangeB, rangeA)
}

export function disjoint(rangeA: CodePointRange, rangeB: CodePointRange): boolean {
  return (
    isEmpty(rangeA)
    || isEmpty(rangeB)
    || rangeA.end < rangeB.start
    || rangeB.end < rangeA.start
  )
}

export function strictlyDisjoint(rangeA: CodePointRange, rangeB: CodePointRange): boolean {
  return isStrictlyBefore(rangeA, rangeB) || isStrictlyAfter(rangeA, rangeB)
}

export function singleton(char: string | number): CodePointRange {
  if (typeof char === 'number') {
    return { start: char, end: char }
  } else {
    const codePoint = char.codePointAt(0) 
    assert(codePoint !== undefined && char.length <= 1, `Invalid character: ${char}`)
    return { start: codePoint, end: codePoint }
  }
}

export function size(range: CodePointRange): number {
  return range.end + 1 - range.start
}

export function isEmpty(range: CodePointRange): boolean {
  return range.start > range.end
}

/**
 *      rangeA      rangeB
 *     |-------|  |--------|
 *     |-------------------| 
 *        leastUpperBound
 */
export function leastUpperBound(rangeA: CodePointRange, rangeB: CodePointRange): CodePointRange {
  if (isEmpty(rangeA))
    return rangeB
  else if (isEmpty(rangeB))
    return rangeA
  else
    return {
      start: Math.min(rangeA.start, rangeB.start),
      end: Math.max(rangeA.end, rangeB.end),
    }
}

export function union(rangeA: CodePointRange, rangeB: CodePointRange): [] | [CodePointRange] | [CodePointRange, CodePointRange] {
  if (isEmpty(rangeA) && isEmpty(rangeB))
    return []
  else if (isEmpty(rangeA))
    return [rangeB]
  else if (isEmpty(rangeB))
    return [rangeA]
  else if (rangeA.end + 1 < rangeB.start) 
    return [rangeA, rangeB]
  else if (rangeB.end + 1 < rangeA.start) 
    return [rangeB, rangeA]
  else 
    return [{
      start: Math.min(rangeA.start, rangeB.start),
      end: Math.max(rangeA.end, rangeB.end),
    }]
}

export function splitAt(point: number, range: CodePointRange): [CodePointRange, CodePointRange] {
  return [
    { start: range.start, end: Math.min(range.end, point) },
    { start: Math.max(range.start, point+1), end: range.end },
  ]
}

export function difference(rangeA: CodePointRange, rangeB: CodePointRange): [] | [CodePointRange] | [CodePointRange, CodePointRange] {
  const [before, restRangeA] = splitAt(rangeB.start-1, rangeA)
  const [_deleted, after] = splitAt(rangeB.end, restRangeA)
  return union(before, after)
}

/**
 * Returns true iff the given char must always be escaped to occur literally
 * in a regular expression. Some special chars like `$` don't need to be 
 * escaped when inside brackets (e.g. `/[$]/`). But `\` and `]` must 
 * even be escaped when inside brackets. 
 */
export function mustAlwaysBeEscaped(char: string) {
  return '\\\]/'.includes(char)
}

/**
 * Returns true iff the given char must be escaped to occur literally
 * in a regular expression, unless within square brackets. That's true
 * for special chars like `$`. Outside brackets we have to write `\$`. 
 * Inside brackets `[$]` is allowed.
 */
export function mustBeEscapedOrInBrackets(char: string) {
  return '.^$*+?()[|/'.includes(char)
}

export function neverMustBeEscaped(char: string) {
  return !mustAlwaysBeEscaped(char) && !mustBeEscapedOrInBrackets(char)
}

function codePointToString(codePoint: number): string {
  const char = String.fromCharCode(codePoint)

  if (mustAlwaysBeEscaped(char) || mustBeEscapedOrInBrackets(char)) 
    // e.g. \$ \+ \. 
    return '\\' + char
  else if (codePoint > 126)
    // char is outside ASCII range --> need \uXXXX encoding:
    return '\\u' + codePoint.toString(16).padStart(4, '0')
  else
    return char 
}

export function toString(range: CodePointRange): string {
  const rangeSize = size(range)
  assert(rangeSize > 0)

  if (rangeSize === 1) 
    return codePointToString(range.start) 
  else if (rangeSize === 2) 
    return codePointToString(range.start) + codePointToString(range.end) 
  else 
    // rangeSize >= 3
    return `${codePointToString(range.start)}-${codePointToString(range.end)}`
}
