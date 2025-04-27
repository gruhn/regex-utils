import { adjacentPairs, assert, checkedAllCases, hashNums, hashStr, zip } from './utils'
import * as Range from './code-point-range'

type WithHash<T> = T & { hash: number }

type EmptyCharSet = WithHash<{ type: 'empty' }>

// TODO: ensure tree is balanced
type NonEmptyCharSetWithoutHash =
  | { type: 'leaf', range: Range.CodePointRange }
  | { type: 'node', range: Range.CodePointRange, left: NonEmptyCharSet, right: NonEmptyCharSet }

type NonEmptyCharSet = WithHash<NonEmptyCharSetWithoutHash>

export type CharSet = Readonly<EmptyCharSet | NonEmptyCharSet>

export const empty: EmptyCharSet = {
  type: 'empty',
  hash: hashStr('empty')
}

function leaf(range: Range.CodePointRange): NonEmptyCharSet {
  return {
    type: 'leaf',
    range,
    hash: hashNums([
      hashStr('leaf'),
      range.start,
      range.end
    ])
  }
}

function node({ left, right }: {
  left: NonEmptyCharSet,
  right: NonEmptyCharSet,
}): NonEmptyCharSet {
  return {
    type: 'node',
    range: {
      start: left.range.start,
      end: right.range.end
    },
    left, 
    right,
    hash: hashNums([ hashStr('node'), left.hash, right.hash ])
  }
}

/**
 * Ranges in a CharSet should always be: non-empty, sorted and strictly disjoint.
 * For example, the following ranges are disjoint, but they could be merged into
 * a single range, so they are not strictly disjoint:
 * 
 *     { start: 0, end: 5 }, { start: 6, end: 7 }
 */
export function checkInvariants(set: CharSet): void {
  if (set.type === 'empty') {
    // assert(set.range.start === +Infinity, 'CharSet empty node with invalid range.start')
    // assert(set.range.end === -Infinity, 'CharSet empty node with invalid range.end')
    return
  } else if (set.type === 'leaf') {
    assert(!Range.isEmpty(set.range), 'NonEmptyCharSet is empty')
  } else if (set.type === 'node') {   
    const { range: parentRange, left, right } = set

    assert(!Range.isEmpty(parentRange), 'Empty range node in NonEmptyCharSet')
    assert(Range.isSubRangeOf(left.range, parentRange), 'left branch not contained in parent range')
    assert(Range.isSubRangeOf(right.range, parentRange), 'right branch not contained in parent range')

    assert(
      left.range.end + 1 < right.range.start,
      `adjacent ranges ${Range.toString(left.range)} and ${Range.toString(right.range)} not strictly disjoint`
    )

    // TODO: This invariant duplicates information. Can probably be eliminated:
    assert(left.range.start === parentRange.start)
    assert(right.range.end === parentRange.end)

    checkInvariants(set.left)
    checkInvariants(set.right)
  } else {
    checkedAllCases(set)
  }
}

export function singleton(char: string): CharSet {
  return fromRange(Range.singleton(char))
}

export function fromArray(chars: string[]): CharSet {
  return chars.map(singleton).reduce(union, empty)
}

export function isEmpty(set: CharSet): boolean {
  return set.type === 'empty'
}

function fromRange(range: Range.CodePointRange): NonEmptyCharSet {
  assert(!Range.isEmpty(range))
  return leaf(range)
}

export function fullAlphabet(): CharSet {
  // Full unicode range. TODO: Whether regex dot "." matches all unicode characters
  // depends on the regex flags. Should later take that into account.
  return fromRange({ start: 0, end: 0x10FFFF })
}

export function isSingleton(set: CharSet): boolean {
  return set.type === 'leaf' && set.range.start === set.range.end
}

export function includes(set: CharSet, codePoint: number): boolean {
  if (set.type === 'empty') {
    return false
  } else if (set.type === 'leaf') {
    return Range.includes(set.range, codePoint)
  } else if (set.type === 'node') {
    if (Range.includes(set.left.range, codePoint))
      return includes(set.left, codePoint)
    else if (Range.includes(set.right.range, codePoint))
      return includes(set.right, codePoint)
    else
      return false
  }
  checkedAllCases(set)
}

export function insertRange(set: CharSet, range: Range.CodePointRange): NonEmptyCharSet {
  if (set.type === 'empty') {
    return fromRange(range)
  } else if (set.type === 'leaf') {
    if (Range.isStrictlyBefore(set.range, range))
      return node({ left: set, right: leaf(range) })
    else if (Range.isStrictlyAfter(set.range, range))
      return node({ left: leaf(range), right: set })
    else 
      return leaf({
        start: Math.min(set.range.start, range.start),
        end: Math.max(set.range.end, range.end)
      })
  } else if (set.type === 'node') {
    const { left, right } = set

    if (Range.isStrictlyBefore(range, right.range))
      return node({ left: insertRange(left, range), right })
    else if (Range.isStrictlyAfter(range, left.range))
      return node({ left, right: insertRange(right, range) })
    else
      // TODO: is this efficient? 
      return union(
        insertRange(left, range),
        insertRange(right, range)
      )
  } 
  checkedAllCases(set)
}

export function deleteRange(set: CharSet, range: Range.CodePointRange): CharSet {
  if (set.type === 'empty') {
    return empty
  } else if (Range.disjoint(set.range, range)) {
    // Also covers the case where `range` is empty:
    return set
  } else if (set.type === 'leaf') {
    const restRange = Range.difference(set.range, range)
    if (Range.isEmpty(restRange))
      return empty
    else
      return leaf(restRange)
  } else if (set.type === 'node') {
    const newLeft = deleteRange(set.left, range)
    const newRight = deleteRange(set.right, range)

    if (newLeft.type === 'empty' && newRight.type === 'empty') 
      return empty
    else if (newLeft.type === 'empty')
      return newRight
    else if (newRight.type === 'empty')
      return newLeft
    else
      return node({ left: newLeft, right: newRight })
  } 
  checkedAllCases(set)
}

export function union(setA: CharSet, setB: CharSet): CharSet {
  if (setA.type === 'empty')
    return setB
  else if (setB.type === 'empty')
    return setB
  else if (Range.isStrictlyBefore(setA.range, setB.range))
    return node({ left: setA, right: setB })
  else if (Range.isStrictlyBefore(setB.range, setA.range))
    return node({ left: setB, right: setA })
  else
    throw 'todo'
}

export function difference(setA: CharSet, setB: CharSet): CharSet {
  return setB.reduce(deleteRange, setA)
}

export function intersection(setA: CharSet, setB: CharSet): CharSet {
  const result: CodePointRange[] = []

  while (setA.length > 0 && setB.length > 0) {
    const [rangeA, ...restA] = setA
    const [rangeB, ...restB] = setB

    const interAB = {
      start: Math.max(rangeA.start, rangeB.start),
      end: Math.min(rangeA.end, rangeB.end)
    }
    const afterA = {
      start: Math.max(rangeA.start, rangeB.end + 1),
      end: Math.max(rangeA.end, rangeB.end)
    }
    const afterB = {
      start: Math.max(rangeB.start, rangeA.end + 1),
      end: Math.max(rangeB.end, rangeA.end)
    }

    if (!Range.isEmpty(interAB)) 
      result.push(interAB)   

    if (Range.isEmpty(afterA))
      setA = restA
    else
      setA = [afterA, ...restA]
    
    if (Range.isEmpty(afterB))
      setB = restB
    else
      setB = [afterB, ...restB]
  }

  return result
}

export function compare(setA: CharSet, setB: CharSet): number {
  if (isEmpty(setA) && isEmpty(setB)) {
    return 0
  } else if (isEmpty(setA)) {
    return -1
  } else if (isEmpty(setB)) {
    return 1
  } else {
    for (const [rangeA, rangeB] of zip(setA, setB)) {
      if (rangeA.start !== rangeB.start) {
        return rangeA.start - rangeB.start
      } else if (rangeA.end !== rangeB.end) {
        return rangeA.end - rangeB.end
      }
    }
    return 0
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

export function hash(set: CharSet): number {
  return hashNums(set.flatMap(range => [range.start, range.end]))
}
