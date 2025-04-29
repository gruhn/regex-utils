import { adjacentPairs, assert, checkedAllCases, hashAssoc, hashStr, zip } from './utils'
import * as Range from './code-point-range'
import * as Stream from './stream'

type WithHash<T> = T & { hash: number }

type EmptyCharSet = WithHash<{ type: 'empty' }>

// TODO: ensure tree is balanced
type CharSetWithoutHash =
  | { type: 'empty' }
  | { type: 'node', range: Range.CodePointRange, left: CharSet, right: CharSet }

// TODO: make sure hash identifies all contained ranges and is not dependent on the 
// structure of the tree! Check if hash function is associative.
export type CharSet = Readonly<WithHash<CharSetWithoutHash>>

export const empty: CharSet = {
  type: 'empty',
  hash: hashStr('empty')
}

function node({ left, right, range }: {
  range: Range.CodePointRange,
  left: CharSet,
  right: CharSet,
}): CharSet {
  return {
    type: 'node',
    range,
    left, 
    right,
    // If we include the `type` in the hash then the hash
    // on the structure of tree and how it's balanced. 
    // We only want the hash to identify the ranges stored inside, 
    // so it's cheap to detect when two `CharSet`s are equal.
    hash: [left.hash, range.start, range.end, right.hash].reduce(hashAssoc)
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
  if (set.type === 'node') {   
    const { range: parentRange, left, right } = set

    assert(!Range.isEmpty(parentRange), 'CharSet node with empty range')
    if (left.type === 'node')
      assert(Range.isStrictlyBefore(left.range, parentRange), `left range [${Range.toString(left.range)}] not strictly before parent range`)
    if (right.type === 'node')
      assert(Range.isStrictlyAfter(right.range, parentRange), `right range [${Range.toString(right.range)}] not strictly after parent range`)

    checkInvariants(set.left)
    checkInvariants(set.right)
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

function fromRange(range: Range.CodePointRange): CharSet {
  if (Range.isEmpty(range))
    return empty
  else
    return node({ range, left: empty, right: empty })
}

export function fullUnicode(): CharSet {
  // Full unicode range. TODO: Whether regex dot "." matches all unicode characters
  // depends on the regex flags. Should later take that into account.
  return fromRange({ start: 0, end: 0x10FFFF })
}

export function isSingleton(set: CharSet): boolean {
  return (
    set.type === 'node'
    && set.range.start === set.range.end
    && isEmpty(set.left)
    && isEmpty(set.right)
  )
}

export function includes(set: CharSet, codePoint: number): boolean {
  if (set.type === 'empty') {
    return false
  } else if (set.type === 'node') {
    if (codePoint < set.range.start - 1)
      return includes(set.left, codePoint)
    else if (codePoint > set.range.end + 1)
      return includes(set.right, codePoint)
    else
      return Range.includes(set.range, codePoint)
  }
  checkedAllCases(set)
}

type ExtractedOverlap = {
  restCharSet: CharSet
  extendedRange: Range.CodePointRange
}

function extractOverlap(set: CharSet, range: Range.CodePointRange): ExtractedOverlap {
  if (set.type === 'empty') {
    return { restCharSet: set, extendedRange: range }
  } else if (set.type === 'node') {
    let extendedRange = range
    let newLeft = set.left
    let newRight = set.right

    if (range.start < set.range.start) {
      const resultLeft = extractOverlap(set.left, range)
      extendedRange = Range.leastUpperBound(extendedRange, resultLeft.extendedRange)
      newLeft = resultLeft.restCharSet
    }

    if (range.end > set.range.end) {
      const resultRight = extractOverlap(set.right, range)
      extendedRange = Range.leastUpperBound(extendedRange, resultRight.extendedRange)
      newRight = resultRight.restCharSet
    }

    if (Range.strictlyDisjoint(range, set.range)) 
      return {
        extendedRange,
        restCharSet: node({
          range: set.range,
          left: newLeft,
          right: newRight,
        })
      }
    else
      // `set.range` itself overlaps and needs to get extracted:
      return {
        extendedRange: Range.leastUpperBound(set.range, extendedRange),
        restCharSet: union(newLeft, newRight), 
      }
  }
  checkedAllCases(set)
}

export function insertRange(set: CharSet, range: Range.CodePointRange): CharSet {
  if (Range.isEmpty(range)) {
    return set
  } else if (set.type === 'empty') {
    return fromRange(range)
  } else if (Range.isStrictlyBefore(range, set.range)) {
    return node({
      range: set.range,
      left: insertRange(set.left, range),
      right: set.right,
    })
  } else if (Range.isStrictlyAfter(range, set.range)) {
    return node({
      range: set.range,
      left: set.left,
      right: insertRange(set.right, range),
    })
  } else {
    const resultLeft = extractOverlap(set.left, range)
    const resultRight = extractOverlap(set.right, range)
    const resultRange = [set.range, resultLeft.extendedRange, resultRight.extendedRange].reduce(Range.leastUpperBound)
    if (Range.isEmpty(resultRange))
      return empty
    else 
      return node({
        range: resultRange,
        left: resultLeft.restCharSet,
        right: resultRight.restCharSet,
      })
  } 
}

export function deleteRange(set: CharSet, range: Range.CodePointRange): CharSet {
  if (Range.isEmpty(range)) {
    return set
  } else if (set.type === 'empty') {
    return empty
  } else if (set.type === 'node') {
    const [rangeBeforeStart, rangeRest1] = Range.splitAt(set.range.start-1, range)
    const [rangeRest2, rangeAfterEnd] = Range.splitAt(set.range.end, range)

    const newLeft = deleteRange(set.left, rangeBeforeStart)
    const newRight = deleteRange(set.right, rangeAfterEnd)

    const setRangeRest = Range.difference(set.range, rangeRest2)

    if (setRangeRest.length === 0) 
      return union(newLeft, newRight)
    else if (setRangeRest.length === 1) 
      return node({
        range: setRangeRest[0],
        left: newLeft,
        right: newRight
      })
    else if (setRangeRest.length === 2) 
      return union(
        insertRange(newLeft, setRangeRest[0]),
        insertRange(newRight, setRangeRest[1])
      )

    checkedAllCases(setRangeRest)
  } 
  checkedAllCases(set)
}

export function intersectRange(set: CharSet, range: Range.CodePointRange): Range.CodePointRange[] {
  if (set.type === 'empty' || Range.isEmpty(range)) {
    return []
  } else if (set.type === 'node') {
    const [rangeBeforeStart, rangeRest1] = Range.splitAt(set.range.start-1, range)
    const [rangeRest2, rangeAfterEnd] = Range.splitAt(set.range.end, rangeRest1)
    return [
      ...intersectRange(set.left, rangeBeforeStart),
      ...(Range.isEmpty(rangeRest2) ? [] : [rangeRest2]),
      ...intersectRange(set.right, rangeAfterEnd),
    ]
  }
  checkedAllCases(set)
}

export function* getRanges(set: CharSet): Generator<Range.CodePointRange> {
  if (set.type === 'node') {
    yield* getRanges(set.left)
    yield set.range
    yield* getRanges(set.right)
  }
}

export function union(setA: CharSet, setB: CharSet): CharSet {
  return [...getRanges(setB)].reduce(insertRange, setA)
}


export function difference(setA: CharSet, setB: CharSet): CharSet {
  return [...getRanges(setB)].reduce(deleteRange, setA)
}

export function intersection(setA: CharSet, setB: CharSet): CharSet {
  return [...getRanges(setB)]
    .flatMap(rangeB => intersectRange(setA, rangeB))
    .reduce(insertRange, empty)
}

export function compare(setA: CharSet, setB: CharSet): number {
  return setA.hash - setB.hash
}

// TODO: can make this more compact using character classes
// e.g. \d instead of [0-9]
export function toString(set: CharSet): string {
  const str = [...getRanges(set)].map(Range.toString).join('')

  if (str.length === 0) 
    // Contradictory regular expression to encode the empty set:
    return "$.^"
  else if (str.length === 1)
    // single char doesn't need brackets:
    return str
  else
    // output e.g. "[abc0-9]"
    return '[' + str  + ']'
}

export function enumerate(set: CharSet): Stream.Stream<string> {
  return Stream.concat(Stream.fromArray(
    [...getRanges(set)].map(
      range => Stream.map(
        codePoint => String.fromCodePoint(codePoint),
        Stream.range(range.start, range.end)
      )
    )
  ))
}
