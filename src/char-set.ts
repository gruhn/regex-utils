import { assert, checkedAllCases, hashStr, xor } from './utils'
import * as Range from './code-point-range'
import * as Stream from './stream'

type WithHash<T> = T & { hash: number }

// TODO: ensure tree is balanced
type CharSetWithoutHash =
  | { type: 'empty' }
  | { type: 'node', range: Range.CodePointRange, left: CharSet, right: CharSet }

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
    // Could use `hashNums` to combine hashes but it's not associative,
    // which means these two trees would receive different hashes although
    // they contain the same ranges:
    //
    //         xyz        abc
    //         /            \
    //       abc            xyz
    // 
    // We want he hash to identify the ranges contained within,
    // independent of the structure of the tree and how it's balanced,
    // so it's cheap to detect when two `CharSet`s are equal.
    hash: [
      left.hash,
      hashStr("s" + range.start),
      hashStr("e" + range.end),
      right.hash,
    ].reduce(xor)
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

export function fromRange(range: Range.CodePointRange): CharSet {
  if (Range.isEmpty(range))
    return empty
  else
    return node({ range, left: empty, right: empty })
}

export function charRange(startChar: string, endChar: string) {
  const start = startChar.codePointAt(0)
  const end = endChar.codePointAt(0)
  assert(start !== undefined && startChar.length <= 1)
  assert(end !== undefined && endChar.length <= 1)
  return fromRange(Range.range(start, end))
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
    const [rangeBeforeStart, _rangeRest1] = Range.splitAt(set.range.start-1, range)
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

export function complement(set: CharSet): CharSet {
  return difference(alphabet, set)
}

export function compare(setA: CharSet, setB: CharSet): number {
  return setA.hash - setB.hash
}

// TODO: render unicode characters with escape sequences:
export function toString(set: CharSet): string {
  // First check if the set matches any of the 
  // predefined characters classes:
  switch (set.hash) {
    case wordChars.hash:
      return '\\w'
    case nonWordChars.hash:
      return '\\W'
    case whiteSpaceChars.hash:
      return '\\s'
    case nonWhiteSpaceChars.hash:
      return '\\S'
    case wildcard({ dotAll: false }).hash:
      return '.'
    case digitChars.hash:
      return '\\d'
    case nonDigitChars.hash:
      return '\\D'
    case alphabet.hash:
      // TODO: if dotAll flag is set then the "." is enough:
      return '(.|[\n\r\u2028\u2029])'
  }

  if (set.type === 'empty') {
    // Use a contradictory regular expression to encode the empty set:
    return "$.^"
  } else if (isSingleton(set)) {
    // If the set contains only a single char then no brackets are needed:
    return Range.toString(set.range)
  } else if (2*size(set) > size(alphabet)) {
    // If the set contains more than half the characters of the
    // entire alphabet then it's more compact to render the complement. E.g. [^a].
    const ranges = [...getRanges(complement(set))].map(Range.toString).join('')
    return '[^' + ranges + ']'
  } else {
    // Otherwise, render the set using positive range notation,
    // e.g. "[abc0-9]"
    const ranges = [...getRanges(set)].map(Range.toString).join('')
    return '[' + ranges + ']'
  }
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

export function size(set: CharSet): number {
  if (set.type === 'empty') {
    return 0
  } else {
    return Range.size(set.range) + size(set.left) + size(set.right)
  } 
}

////////////////////////////////////////////////////////////
//////////////// Specific Character Classes //////////////// 
////////////////////////////////////////////////////////////

/**
 * Full unicode range.
 */
export const alphabet = // fromRange({ start: 0, end: 0x10FFFF })
  difference(
    fromRange({ start: 0, end: 0x10FFFF }),
    // alphabet,
    fromArray(['\r', '\n', '\u2028', '\u2029'])
  )

/**
 * Equivalent to the dot ".". Whether or not the dot matches
 * line terminators like \n depends on the dotAll-flag attached to 
 * a regular expression. For example, this regex matches
 * line terminators `/./s` but this one doesn't `/./`.
 */
export const wildcard = (options: { dotAll: boolean }) => {
  if (options.dotAll)
    return alphabet
  else
    return difference(
      alphabet,
      fromArray(['\r', '\n', '\u2028', '\u2029'])
    )
}

/**
 * Equivalent to \d
 */
export const digitChars = charRange('0', '9')

/**
 * Equivalent to \D
 */
export const nonDigitChars = complement(digitChars)

/**
 * Equivalent to \w
 */
export const wordChars = [
  charRange('a', 'z'),
  charRange('A', 'Z'),
  charRange('0', '9'),
  singleton('_')
].reduce(union)


/**
 * Equivalent to \W
 */
export const nonWordChars = complement(wordChars)

/**
 * Equivalent to \s
 */
export const whiteSpaceChars = [
  singleton('\f'),
  singleton('\n'),
  singleton('\r'),
  singleton('\t'),
  singleton('\v'),
  singleton('\u0020'),
  singleton('\u00a0'),
  singleton('\u1680'),
  charRange('\u2000', '\u200a'),
  singleton('\u2028'),
  singleton('\u2029'),
  singleton('\u202f'),
  singleton('\u205f'),
  singleton('\u3000'),
  singleton('\ufeff'),
].reduce(union)


/**
 * Equivalent to \S
 */
export const nonWhiteSpaceChars = complement(whiteSpaceChars)

