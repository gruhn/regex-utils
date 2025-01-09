import { assert, todo } from "./utils"

export type CodePointRange = { start: number, end: number }

// TODO: could make this a tree for more efficient lookup
export type CharSet = CodePointRange[]

export function fullAlphabet(): CharSet {
  // Full unicode range. TODO: Whether regex dot "." matches all unicode characters
  // depends on the regex flags. Should later take that into account.
  return [{ start: 0, end: 0x10FFFF }]
}

export function singleton(char: string): CharSet {
  const codePoint = char.codePointAt(0) 
  assert(codePoint !== undefined && char.length <= 1, `Invalid character: ${char}`)
  return [{ start: codePoint, end: codePoint }]
}

export function isEmpty(set: CharSet): boolean {
  return set.length === 0
}

export function includes(set: CharSet, codePoint: number): boolean {
  return set.some(({ start, end }) => codePoint >= start && codePoint <= end)
}

function mergeRanges(rangeA: CodePointRange, rangeB: CodePointRange): CharSet {
  if (rangeA.end < rangeB.start) 
    return [rangeA, rangeB]
  else if (rangeB.end < rangeA.start) 
    return [rangeB, rangeA]
  else 
    return [{
      start: Math.min(rangeA.start, rangeB.start),
      end: Math.max(rangeA.end, rangeB.end),
    }]
}

function insertRange(set: CharSet, range: CodePointRange): CharSet {
  if (set.length === 0) {
    return [range]
  } else {
    const [first, ...rest] = set
    
    if (range.end < first.start) {
      // |---| range
      //        |---| first
      //               |------------| rest
      return [range, first, ...rest]
    } else if (first.end < range.start) {
      //       |------| range
      // |---| first
      //          |------------| rest
      return [first, ...insertRange(rest, range)]
    } else {
      //   |------| range
      // |---| first
      //       |------------| rest
      const merged = mergeRanges(first, range)
      return union(merged, rest)
    }
  }
}

export function union(setA: CharSet, setB: CharSet): CharSet {
  return setA.reduce(insertRange, setB)
}

export function compare(setA: CharSet, setB: CharSet): number {
  if (isEmpty(setA) && isEmpty(setB)) {
    return 0
  } else if (isEmpty(setA)) {
    return -1
  } else if (isEmpty(setB)) {
    return 1
  } else {
    const [ firstA, ...restA ] = setA
    const [ firstB, ...restB ] = setB
    return firstA.start - firstB.start || firstA.end - firstB.end || compare(restA, restB)    
  }
}
