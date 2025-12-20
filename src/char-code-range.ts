import { assert } from './utils'

export type CharCodeRange = { start: number, end: number }

export const empty: CharCodeRange = { start: +Infinity, end: -Infinity }

export function range(start: number, end: number = start): CharCodeRange {
  if (start > end)
    return empty
  else
    return { start, end }
}

export function includes(range: CharCodeRange, charCode: number): boolean {
  return range.start <= charCode && charCode <= range.end
}

export function isSubRangeOf(rangeA: CharCodeRange, rangeB: CharCodeRange): boolean {
  return rangeA.start >= rangeB.start && rangeA.end <= rangeB.end
}

export function isStrictlyBefore(rangeA: CharCodeRange, rangeB: CharCodeRange): boolean {
  // TODO: how to handle empty case?
  assert(!isEmpty(rangeA) && !isEmpty(rangeB))
  return rangeA.end + 1 < rangeB.start
}

export function isStrictlyAfter(rangeA: CharCodeRange, rangeB: CharCodeRange): boolean {
  return isStrictlyBefore(rangeB, rangeA)
}

export function disjoint(rangeA: CharCodeRange, rangeB: CharCodeRange): boolean {
  return (
    isEmpty(rangeA)
    || isEmpty(rangeB)
    || rangeA.end < rangeB.start
    || rangeB.end < rangeA.start
  )
}

export function strictlyDisjoint(rangeA: CharCodeRange, rangeB: CharCodeRange): boolean {
  return isStrictlyBefore(rangeA, rangeB) || isStrictlyAfter(rangeA, rangeB)
}

export function singleton(char: string | number): CharCodeRange {
  if (typeof char === 'number') {
    return { start: char, end: char }
  } else {
    const charCode = char.charCodeAt(0)
    assert(charCode !== undefined && char.length <= 1, `Invalid character: ${char}`)
    return { start: charCode, end: charCode }
  }
}

export function size(range: CharCodeRange): number {
  return range.end + 1 - range.start
}

export function isEmpty(range: CharCodeRange): boolean {
  return range.start > range.end
}

/**
 *      rangeA      rangeB
 *     |-------|  |--------|
 *     |-------------------|
 *        leastUpperBound
 */
export function leastUpperBound(rangeA: CharCodeRange, rangeB: CharCodeRange): CharCodeRange {
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

export function union(rangeA: CharCodeRange, rangeB: CharCodeRange): [] | [CharCodeRange] | [CharCodeRange, CharCodeRange] {
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

export function splitAt(point: number, range: CharCodeRange): [CharCodeRange, CharCodeRange] {
  return [
    { start: range.start, end: Math.min(range.end, point) },
    { start: Math.max(range.start, point+1), end: range.end },
  ]
}

export function difference(rangeA: CharCodeRange, rangeB: CharCodeRange): [] | [CharCodeRange] | [CharCodeRange, CharCodeRange] {
  const [before, restRangeA] = splitAt(rangeB.start-1, rangeA)
  const [_deleted, after] = splitAt(rangeB.end, restRangeA)
  return union(before, after)
}

/**
 * Returns true iff the given char must always be escaped to occur literally
 * in a regular expression. Some special chars like `$` don't need to be
 * escaped when inside brackets (e.g. `/[$]/`). But `\` must even be
 * escaped when inside brackets. And `]` must only be escaped inside brackets.
 */
export function mustBeEscapedInsideBrackets(char: string) {
  // Whether '-' needs to be escaped depends on order. For example,
  // to write a class for the characters 'a', 'b', '-' we could write [-ab]
  // and the '-' does not need to be escaped. But if we write [a-b] it's interpreted
  // as a range, so to write the '-' in the middle it would need to be escaped.
  // To simplify the logic, we always escape '-' inside brackets.
  return char === '\\' || char === ']' || char === '-'
}

/**
 * Returns true iff the given char must be escaped to occur literally
 * in a regular expression, unless within square brackets. That's true
 * for special chars like `$`. Outside brackets we have to write `\$`.
 * Inside brackets `[$]` is allowed.
 */
export function mustBeEscapedOutsideBrackets(char: string) {
  return '.^$*+?()[|/\\'.includes(char)
}

function charCodeToString(charCode: number): string {
  const char = String.fromCharCode(charCode)

  if (mustBeEscapedInsideBrackets(char) || mustBeEscapedOutsideBrackets(char))
    // e.g. \$ \+ \.
    return '\\' + char
  else if (charCode > 126)
    // char is outside ASCII range --> need \uXXXX encoding:
    return '\\u' + charCode.toString(16).padStart(4, '0')
  else
    return char
}

export function toString(range: CharCodeRange): string {
  const rangeSize = size(range)
  assert(rangeSize > 0)

  if (rangeSize === 1)
    return charCodeToString(range.start)
  else if (rangeSize === 2)
    return charCodeToString(range.start) + charCodeToString(range.end)
  else
    // rangeSize >= 3
    return `${charCodeToString(range.start)}-${charCodeToString(range.end)}`
}
