import { assert } from "./utils"

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

export function fromArray(chars: string[]): CharSet {
  const ranges = chars.map(singleton)
  return ranges.reduce(union, [])
}

export function isEmpty(set: CharSet): boolean {
  return set.length === 0
}

export namespace Range {

  export function isEmpty(range: CodePointRange): boolean {
    return range.start > range.end
  }

  export function union(rangeA: CodePointRange, rangeB: CodePointRange): CharSet {
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

  export function subtract(rangeA: CodePointRange, rangeB: CodePointRange): [CodePointRange, CodePointRange, CodePointRange] {
    return [
      { start: Math.min(rangeA.start, rangeB.start), end: Math.min(rangeA.end, rangeB.start - 1) },
      { start: Math.max(rangeA.start, rangeB.start), end: Math.min(rangeA.end, rangeB.end) },
      { start: Math.max(rangeA.start, rangeB.end + 1), end: Math.max(rangeA.end, rangeB.end) }
    ]
  }
 
}

export function isSingleton(set: CharSet): boolean {
  return set.length === 1 && set[0].start === set[0].end
}

export function includes(set: CharSet, codePoint: number): boolean {
  return set.some(({ start, end }) => codePoint >= start && codePoint <= end)
}

export function insertRange(set: CharSet, range: CodePointRange): CharSet {
  if (set.length === 0) {
    return [range]
  } else {
    const [first, ...rest] = set
    
    if (range.end + 1 < first.start) {
      // |---| range
      //        |---| first
      //               |------------| rest
      return [range, first, ...rest]
    } else if (first.end + 1 < range.start) {
      //       |------| range
      // |---| first
      //          |------------| rest
      return [first, ...insertRange(rest, range)]
    } else {
      //   |------| range
      // |---| first
      //       |------------| rest
      const merged = Range.union(first, range)
      return union(merged, rest)
    }
  }
}

function deleteRange(set: CharSet, range: CodePointRange): CharSet {
  if (set.length === 0) {
    return []
  } else {
    const [first, ...rest] = set

    //      |----------| range
    // |---------| first
    //           |-----| rangeAfterFirst
    const rangeAfterFirstEnd = {
      start: Math.max(first.end, range.start),
      end: range.end
    }

    //      |----------| range
    // |---------| first
    // |----| firstNotCovered
    const firstNotCovered = {
      start: Math.max(first.start, range.end),
      end: Math.min(first.end, range.start),
    }

    return [
      ...(Range.isEmpty(firstNotCovered) ? [] : [firstNotCovered]),
      ...(Range.isEmpty(rangeAfterFirstEnd) ? rest : deleteRange(rest, rangeAfterFirstEnd))
    ]
  }
}


export function union(setA: CharSet, setB: CharSet): CharSet {
  return setA.reduce(insertRange, setB)
}

export function difference(setA: CharSet, setB: CharSet): CharSet {
  return setB.reduce(deleteRange, setA)
}

export function intersection(setA: CharSet, setB: CharSet): CharSet {
  if (setA.length === 0)
    return []
  else if (setB.length === 0)
    return []
  else {
    const [rangeA, ...restA] = setA
    const [rangeB, ...restB] = setB

    if (rangeA.end < rangeB.start)
      return intersection(restA, setB)
    else if (rangeB.end < rangeA.start)
      return intersection(setA, restB)
    else
      throw 'todo'
  }
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

// TODO: can make this more compact using character classes
// e.g. \d instead of [0-9]
export function toString(set: CharSet): string {
  if (isEmpty(set)) {
    // Contradictory regular expression to encode the empty set:
    return "$.^"
  } else if (isSingleton(set)) {
    return String.fromCodePoint(set[0].start)
  } else {
    const rangesAsString = set.map(({ start, end }) => {
      if (start === end) {
        return String.fromCodePoint(start)
      } else {
        return `${String.fromCodePoint(start)}-${String.fromCodePoint(end)}`
      }
    })

    return `[${rangesAsString.join("")}]`
  }
}
