import { hashAssoc, hashStr, checkedAllCases, assert, uniqWith, hashAssocNotComm } from './utils'
import * as CharSet from './char-set'
import * as Stream from './stream';

/**
 * TODO
 */
type StdRegexWithoutHash = (
  | { type: "epsilon" }
  | { type: "literal", charset: CharSet.CharSet }
  | { type: "concat", left: StdRegex, right: StdRegex }
  | { type: "union", left: StdRegex, right: StdRegex }
  | { type: "star", inner: StdRegex }
)

/**
 * TODO
 */
type ExtRegexWithoutHash = (
  | { type: "epsilon" }
  | { type: "literal", charset: CharSet.CharSet }
  | { type: "concat", left: ExtRegex, right: ExtRegex }
  | { type: "union", left: ExtRegex, right: ExtRegex }
  | { type: "star", inner: ExtRegex  }
  // Extended with intersection and complement operator:
  | { type: "intersection", left: ExtRegex, right: ExtRegex }
  | { type: "complement", inner: ExtRegex }
)

export type StdRegex = StdRegexWithoutHash & { hash: number }

export type ExtRegex = ExtRegexWithoutHash & { hash: number }

export function withHash(regex: StdRegexWithoutHash): StdRegex
export function withHash(regex: ExtRegexWithoutHash): ExtRegex 
export function withHash(regex: ExtRegexWithoutHash): ExtRegex {
  if (regex.type === 'epsilon')
    return { ...regex, hash: hashStr(regex.type) }
  else if (regex.type === 'literal')
    return { ...regex, hash: hashAssoc(hashStr(regex.type), regex.charset.hash) }
  else if (regex.type === 'concat' || regex.type === 'union' || regex.type === 'intersection')
    return { ...regex, hash: hashAssoc(
      hashStr(regex.type),
      // Need non-commutative hash operator for `concat`, otherwise "ac" and "ca" are the same:
      hashAssocNotComm(regex.left.hash, regex.right.hash))
    }
  else if (regex.type === 'star' || regex.type === 'complement')
    return { ...regex, hash: hashAssoc(hashStr(regex.type), regex.inner.hash) }
  checkedAllCases(regex)  
}

//////////////////////////////////////////////
///// primitive composite constructors ///////
//////////////////////////////////////////////

export const epsilon: StdRegex = withHash({ type: 'epsilon'  })

export function literal(charset: CharSet.CharSet): StdRegex {
  return withHash({ type: 'literal', charset })
}

export const empty: StdRegex = literal(CharSet.empty)

export function concat(left: StdRegex, right: StdRegex): StdRegex
export function concat(left: ExtRegex, right: ExtRegex): ExtRegex
export function concat(left: ExtRegex, right: ExtRegex): ExtRegex {
  if (equal(empty, left))
    // ∅ · r ≈ ∅
    return empty
  else if (equal(empty, right))
    // r · ∅ ≈ ∅
    return empty
  else if (left.type === "concat")
    // (r · s) · t ≈ r · (s · t)
    return concat(left.left, concat(left.right, right))
  else if (left.type === "epsilon")
    // ε · r ≈ r
    return right
  else if (right.type === "epsilon")
    // r · ε ≈ r
    return left

  // Try to eliminate as many `star`s as possible,
  // e.g. "a+a+" --> "aa*aa*" --> "aaa*a*" --> "aaa*"
  if (left.type === "star") {
    if (equal(left.inner, right))
      // r* · r ≈ r · r*
      return concat(right, left)
    else if (right.type === 'concat' && equal(left.inner, right.left))
      // r* · (r · s)  ≈ r · (r* · s)
      return concat(left.inner, concat(left, right.right))
    else if (right.type === 'star' && equal(left.inner, right.inner))
      // r* · r*  ≈ r*
      return left
    else if (right.type === 'concat' && right.left.type === 'star' && equal(left, right.left))
      // r* · (r* · s) ≈ r* · s
      return concat(left, right.right)
  }

  return withHash({ type: 'concat', left, right })
}

export function union(left: StdRegex, right: StdRegex): StdRegex
export function union(left: ExtRegex, right: ExtRegex): ExtRegex
export function union(left: ExtRegex, right: ExtRegex): ExtRegex {
  // if (left.type === 'union')
  //   // (r + s) + t ≈ r + (s + t)
  //   return union(left.left, union(left.right, right))
  if (equal(left, right)) 
    // r + r ≈ r
    return left
  else if (equal(left, empty))
    // ∅ + r ≈ r
    return right
  else if (equal(empty, right))
    // r + ∅ ≈ r
    return left
  else if (equal(left, complement(empty)))
    // ¬∅ + r ≈ ¬∅
    return complement(empty)
  else if (equal(complement(empty), right))
    // r + ¬∅ ≈ ¬∅
    return complement(empty)
  else if (left.hash > right.hash)
    // r + s ≈ s + r
    return union(right, left)
  else if (left.type === 'literal' && right.type === 'literal')
    // R + S ≈ R ∪ S
    return literal(CharSet.union(left.charset, right.charset))

  // else if (left.type === 'concat') {
  //   if (right.type === 'concat')
  //     if (equal(left.left, right.left))
  //       // TODO
  //       return concat(left.left, union(left.right, right.right))
  //     else if (left.right.hash === right.right.hash)
  //       // TODO
  //       return concat(union(left.left, right.left), left.right)
  //   else if (equal(right, left.left))
  //     // TODO
  //     return concat(left.left, optional(left.right))
  //   else if (equal(right, left.right))
  //     // TODO
  //     return concat(optional(left.left), left.right)
  // } else if (right.type === 'concat') {
  //   if (right.left.hash === left.hash)
  //     // TODO
  //     return concat(right.left, optional(right.right))
  //   else if (right.right.hash === left.hash)
  //     // TODO
  //     return concat(optional(right.left), right.right)
  // }

  return withHash({ type: 'union', left, right })
}

export function star(inner: StdRegex): StdRegex
export function star(inner: ExtRegex): ExtRegex
export function star(inner: ExtRegex): ExtRegex {
  if (inner.type === "epsilon")
    // ε∗ ≈ ε
    return epsilon
  else if (inner.type === "star")
    // (r∗)∗ ≈ r∗
    return inner
  else if (equal(empty, inner))
    // ∅∗ ≈ ε
    return epsilon
  else
    return withHash({ type: "star", inner })
}

export function intersection(left: ExtRegex, right: ExtRegex): ExtRegex {
  // if (left.type === "intersection")
  //   // (r & s) & t ≈ r & (s & t)
  //   return intersection(left.left, intersection(left.right, right))
  if (equal(left, empty))
    // ∅ & r ≈ ∅
    return empty 
  if (equal(right, empty))
    // r & ∅ ≈ ∅
    return empty 
  else if (equal(left, complement(empty)))
    // ¬∅ & r ≈ r
    return right 
  else if (equal(right, complement(empty)))
    //  r & ¬∅ ≈ r
    return left 
  else if (equal(left, right)) 
    // r & r ≈ r
    return left 
  else if (left.hash > right.hash)
    // r & s ≈ s & r
    return intersection(right, left) 
  else
    return withHash({ type: "intersection", left, right })
}

export function complement(inner: ExtRegex): ExtRegex {
  if (inner.type === "complement")
    // ¬(¬r) ≈ r
    return inner
  else if (inner.type === 'literal')
    // ¬S ≈ Σ\S
    return literal(CharSet.difference(CharSet.fullUnicode, inner.charset))
  else
    return withHash({ type: "complement", inner })
}

//////////////////////////////////////////////
// some additional composite constructors ////
//////////////////////////////////////////////

export const anySingleChar: StdRegex = literal(CharSet.fullUnicode)

export function singleChar(char: string) {
  return literal(CharSet.singleton(char))
}

export function string(str: string) {
  return concatAll([...str].map(singleChar))
}

export function optional(regex: StdRegex): StdRegex
export function optional(regex: ExtRegex): ExtRegex
export function optional(regex: ExtRegex): ExtRegex {
  return union(epsilon, regex)
}

export function plus(regex: StdRegex): StdRegex
export function plus(regex: ExtRegex): ExtRegex 
export function plus(regex: ExtRegex): ExtRegex {
  return concat(regex, star(regex))
}

export function concatAll(res: StdRegex[]): StdRegex
export function concatAll(res: ExtRegex[]): ExtRegex
export function concatAll(res: ExtRegex[]): ExtRegex {
  // Reducing right-to-left should trigger fewer normalization steps in `concat`:
  return res.reduceRight((right, left) => concat(left, right), epsilon)
}

export function intersectAll(res: ExtRegex[]): ExtRegex {
  if (res.length === 0)
    // TODO: is that correct?
    return star(literal(CharSet.fullUnicode))
  else
    return res.reduceRight(intersection)
}

export function replicate(lowerBound: number, upperBound: number, regex: StdRegex): StdRegex
export function replicate(lowerBound: number, upperBound: number, regex: ExtRegex): ExtRegex
export function replicate(lowerBound: number, upperBound: number, regex: ExtRegex): ExtRegex {
  assert(0 <= lowerBound && lowerBound <= upperBound)

  const requiredPrefix = concatAll(Array(lowerBound).fill(regex))

  if (upperBound === Infinity)
    return concat(requiredPrefix, star(regex))
  else 
    return concat(
      requiredPrefix,
      concatAll(Array(upperBound - lowerBound).fill(optional(regex)))
    )
}

//////////////////////////////////////////////
/////    derivatives & predicates        /////
//////////////////////////////////////////////

export function isEmpty(regex: ExtRegex): boolean {
  return regex.type === 'literal' && CharSet.isEmpty(regex.charset)
}

export function codePointDerivative(codePoint: number, regex: StdRegex): StdRegex
export function codePointDerivative(codePoint: number, regex: ExtRegex): ExtRegex
export function codePointDerivative(codePoint: number, regex: ExtRegex): ExtRegex {
  switch (regex.type) {
    case "epsilon":
      return empty
    case "literal": {
      if (CharSet.includes(regex.charset, codePoint))
        return epsilon
      else
        return empty
    }
    case "concat": {
      if (isNullable(regex.left))
        return union(
          concat(codePointDerivative(codePoint, regex.left), regex.right),
          codePointDerivative(codePoint, regex.right)
        )
      else 
        return concat(
          codePointDerivative(codePoint, regex.left),
          regex.right
        )
    }
    case "union":
      return union(
        codePointDerivative(codePoint, regex.left),
        codePointDerivative(codePoint, regex.right)
      )
    case "intersection":
      return intersection(
        codePointDerivative(codePoint, regex.left),
        codePointDerivative(codePoint, regex.right)
      )
    case "star":
      return concat(
        codePointDerivative(codePoint, regex.inner),
        star(regex.inner)
      )
    case "complement":
      return complement(codePointDerivative(codePoint, regex.inner))
  }  
  checkedAllCases(regex)
}

export function derivative(str: string, regex: StdRegex): StdRegex
export function derivative(str: string, regex: ExtRegex): ExtRegex 
export function derivative(str: string, regex: ExtRegex): ExtRegex {
  const firstCodePoint = str.codePointAt(0)
  if (firstCodePoint === undefined) {
    return regex
  } else {
    const restStr = str.slice(1) 
    const restRegex = codePointDerivative(firstCodePoint, regex)

    if (equal(empty, restRegex)) 
      return empty
    else
      return derivative(restStr, restRegex)
  }
}

/**
 * Checks if `regex` can match the empty string.
 */
export function isNullable(regex: ExtRegex): boolean {
  switch (regex.type) {
    case "epsilon":
      return true
    case "literal":
      return false
    case "concat":
      return isNullable(regex.left) && isNullable(regex.right)
    case "union":
      return isNullable(regex.left) || isNullable(regex.right)
    case "intersection":
      return isNullable(regex.left) && isNullable(regex.right)
    case "star":
      return true
    case "complement":
      return !isNullable(regex.inner)
  }  
  checkedAllCases(regex)
}

export function matches(regex: ExtRegex, string: string): boolean {
  return isNullable(derivative(string, regex))
}

/**
 * Checks if `regexA` and `regexB` are structurally equal. 
 * Since regex instances are always kept in "canonical form", 
 * structural equality approximates regex equivalence quite well.
 * 
 * TODO: write property based test to find more examples where this does
 * not detect regex equivalence.
 */
export function equal(regexA: ExtRegex, regexB: ExtRegex): boolean {
  return regexA.hash === regexB.hash
}

// const cache: Map<number, Map<number, CharSet.CharSet[]>> = new Map()
// let seen: number = 0
// let total: number = 0

function allNonEmptyIntersections(classesA: CharSet.CharSet[], classesB: CharSet.CharSet[]): CharSet.CharSet[] {
  // const hashA = classesA.map(cls => cls.hash).reduce(hashAssoc)
  // const hashB = classesB.map(cls => cls.hash).reduce(hashAssoc)
  // let cacheA = cache.get(hashA)
  // const cachedResult = cacheA?.get(hashB)
  // if (cachedResult !== undefined) {
  //   return cachedResult
  // }

  const result: CharSet.CharSet[] = []
  for (const classA of classesA) {
    for (const classB of classesB) {
      const inter = CharSet.intersection(classA, classB)
      if (!CharSet.isEmpty(inter)) {
        result.push(inter)
      }
    }
  }
  const finalResult = uniqWith(result, CharSet.compare) 

  // console.debug({
  //   classesA: classesA.map(CharSet.toString),
  //   classesB: classesB.map(CharSet.toString),
  //   result: result.map(CharSet.toString),
  //   result2: result.toSorted(CharSet.compare).map(CharSet.toString),
  //   finalResult: finalResult.map(CharSet.toString),
  // })

  // if (cacheA === undefined) {
  //   cacheA = new Map()
  //   cache.set(hashA, cacheA)
  // }
  // cacheA.set(hashB, finalResult)

  return finalResult
}

export function derivativeClasses(regex: ExtRegex): CharSet.CharSet[] {
  const alphabet = CharSet.fullUnicode

  switch (regex.type) {
    case "epsilon":
      return [alphabet]
    case "literal": 
      return [regex.charset, CharSet.difference(alphabet, regex.charset)]
        .filter(charset => !CharSet.isEmpty(charset))   
    case "concat": {
      if (isNullable(regex.left))
        return allNonEmptyIntersections(
          derivativeClasses(regex.left),
          derivativeClasses(regex.right)
        )
      else 
        return derivativeClasses(regex.left)     
    }
    case "union":
      return allNonEmptyIntersections(
        derivativeClasses(regex.left),
        derivativeClasses(regex.right)
      )
    case "intersection":
      return allNonEmptyIntersections(
        derivativeClasses(regex.left),
        derivativeClasses(regex.right)
      )
    case "star":
      return derivativeClasses(regex.inner)
    case "complement":
      return derivativeClasses(regex.inner)
  }  
  checkedAllCases(regex)
}


//////////////////////////////////////////////
///// exclusive standard regex utils     /////
//////////////////////////////////////////////

export function toRegExp(regex: StdRegex): RegExp {
  return new RegExp(toString(regex))
}

export function toString(regex: StdRegex): string {
  return '^' + toStringRec(regex) + '$'
}

// TODO: make this more compact by using fewer parenthesis and
// recognizing patterns like "a+" instead of "aa*" etc.
function toStringRec(regex: StdRegex): string {
  switch (regex.type) {
    case 'epsilon':
      return ''
    case 'literal':
      return CharSet.toString(regex.charset)
    case 'concat':
      return toStringRec(regex.left) + toStringRec(regex.right)
    case 'union':
      return `(${toStringRec(regex.left)}|${toStringRec(regex.right)})`
    case 'star':
      return `(${toStringRec(regex.inner)})*`
  }
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
        enumerate(regex.right),
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

export function size(regex: StdRegex): bigint | undefined {
  switch (regex.type) {
    case 'epsilon':
      return 1n
    case 'literal':
      return BigInt(CharSet.size(regex.charset))
    case 'concat': {
      const leftSize = size(regex.left)
      const rightSize = size(regex.right)
      if (leftSize !== undefined && rightSize !== undefined)
        return leftSize * rightSize
      else
        return undefined
    }
    case 'union': {
      const leftSize = size(regex.left)
      const rightSize = size(regex.right)
      if (leftSize !== undefined && rightSize !== undefined)
        return leftSize + rightSize
      else
        return undefined
    }
    case 'star': {
      const innerSize = size(regex.inner)
      if (innerSize === 0n) 
        // `inner` is empty so `star(inner)` the only match is the empty string:
        return 1n
      else
        // If `inner` is `epsilon` then `star(inner)` still only matches the empty string,
        // so the return value should only be 1. However, this case should not occur
        // since we normalize that away in the smart constructors.
        return undefined
    }
  }
}
