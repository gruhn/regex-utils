import { hashNums, assert } from './utils'

export type CodePointRange = { start: number, end: number }

export const empty: CodePointRange = { start: +Infinity, end: -Infinity }

export function toString(range: CodePointRange): string {
  return `${String.fromCodePoint(range.start)}-${String.fromCodePoint(range.end)}`
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

export function singleton(char: string): CodePointRange {
  const codePoint = char.codePointAt(0) 
  assert(codePoint !== undefined && char.length <= 1, `Invalid character: ${char}`)
  return { start: codePoint, end: codePoint }
}

export function isEmpty(range: CodePointRange): boolean {
  return range.start > range.end
}

export function union(rangeA: CodePointRange, rangeB: CodePointRange): CodePointRange[] {
  if (isEmpty(rangeA) || isEmpty(rangeB))
    return [rangeA, rangeB].filter(r => !isEmpty(r))
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

export function difference(rangeA: CodePointRange, rangeB: CodePointRange): CodePointRange {
  if (isEmpty(rangeB)) 
    return rangeA
  else if (rangeA.start < rangeB.start)
    // |-------------| rangeA
    //      |-----------------| rangeB
    return {
      start: rangeA.start,
      end: Math.min(rangeA.end, rangeB.start)
    }
  else if (rangeA.end > rangeB.end)
    //        |-------------| rangeA
    // |---------------| rangeB
    return {
      start: Math.max(rangeA.end, rangeB.end),
      end: rangeA.end,
    }
  else
    //     |--------| rangeA
    // |------------------| rangeB
    return empty
}

export function subtract(rangeA: CodePointRange, rangeB: CodePointRange): [CodePointRange, CodePointRange, CodePointRange] {
  return [
    { start: Math.min(rangeA.start, rangeB.start), end: Math.min(rangeA.end, rangeB.start - 1) },
    { start: Math.max(rangeA.start, rangeB.start), end: Math.min(rangeA.end, rangeB.end) },
    { start: Math.max(rangeA.start, rangeB.end + 1), end: Math.max(rangeA.end, rangeB.end) }
  ]
}

