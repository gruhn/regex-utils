import { checkedAllCases, assert } from "./utils"
import * as CharSet from "./char-set"

/**
 * TODO
 */
export type ExtRegex = Readonly<
  | { type: "epsilon" }
  | { type: "literal", charset: CharSet.CharSet }
  | { type: "concat", left: ExtRegex, right: ExtRegex }
  | { type: "union", left: ExtRegex, right: ExtRegex }
  | { type: "star", inner: ExtRegex }
  | { type: "intersection", left: ExtRegex, right: ExtRegex }
  | { type: "complement", inner: ExtRegex }
>

//////////////////////////////////////////////
///// primitive composite constructors ///////
//////////////////////////////////////////////

export const empty: ExtRegex = { type: 'literal', charset: [] }

export const epsilon: ExtRegex = { type: "epsilon" }

export function literal(charset: CharSet.CharSet): ExtRegex {
  return { type: 'literal', charset }
}

export function concat(left: ExtRegex, right: ExtRegex): ExtRegex {
  if (left.type === "concat")
    // (r · s) · t ≈ r · (s · t)
    return concat(left.left, concat(left.right, right))
  else if (similar(empty, left))
    // ∅ · r ≈ ∅
    return empty
  else if (similar(empty, right))
    // r · ∅ ≈ ∅
    return empty
  else if (left.type === "epsilon")
    // ε · r ≈ r
    return right
  else if (right.type === "epsilon")
    // r · ε ≈ r
    return left
  else 
    return { type: "concat", left, right }
}

export function union(left: ExtRegex, right: ExtRegex): ExtRegex {
  if (similar(left, right)) 
    // r + r ≈ r
    return left
  else if (isGreaterThan(left, right)) // TODO: this check is re-computed in the recursive call
    // r + s ≈ s + r
    return union(right, left)
  else if (left.type === "union")
    // (r + s) + t ≈ r + (s + t)
    return union(left.left, union(left.right, right))
  else if (similar(left, complement(empty)))
    // ¬∅ + r ≈ ¬∅
    return complement(empty)
  else if (similar(empty, left))
    // ∅ + r ≈ r
    return right
  else if (left.type === 'literal' && right.type === 'literal')
    // R + S ≈ R ∪ S
    return literal(CharSet.union(left.charset, right.charset))
  else 
    return { type: "union", left, right }
}

export function star(inner: ExtRegex): ExtRegex {
  if (similar(empty, inner))
    // ∅∗ ≈ ε
    return epsilon
  else if (inner.type === "epsilon")
    // ε∗ ≈ ε
    return epsilon
  else if (inner.type === "star")
    // (r∗)∗ ≈ r∗
    return inner
  else
    return { type: "star", inner }
}

export function intersection(left: ExtRegex, right: ExtRegex): ExtRegex {
  if (similar(left, right)) 
    // r & r ≈ r
    return left 
  else if (isGreaterThan(left, right)) // TODO: this check is re-computed in the recursive call
    // r & s ≈ s & r
    return intersection(right, left) 
  else if (left.type === "intersection")
    // (r & s) & t ≈ r & (s & t)
    return intersection(left.left, intersection(left.right, right))
  else if (similar(empty, left))
    // ∅ & r ≈ ∅
    return empty 
  else if (similar(left, complement(empty)))
    // ¬∅ & r ≈ r
    return right 
  else
    return { type: "intersection", left, right }
}

export function complement(inner: ExtRegex): ExtRegex {
  if (inner.type === "complement")
    // ¬(¬r) ≈ r
    return inner
  else
    return { type: "complement", inner }
}

//////////////////////////////////////////////
// some additional composite constructors ////
//////////////////////////////////////////////

export const anySingleChar: ExtRegex = literal(CharSet.fullAlphabet())

export function singleChar(char: string) {
  return literal(CharSet.singleton(char))
}

export function string(str: string) {
  return concatAll([...str].map(singleChar))
}

export function optional(regex: ExtRegex): ExtRegex {
  return union(epsilon, regex)
}

export function plus(regex: ExtRegex): ExtRegex {
  return concat(regex, star(regex))
}

export function concatAll(res: ExtRegex[]): ExtRegex {
  // Reducing right-to-left should trigger fewer normalization steps in `concat`:
  return res.reduceRight((right, left) => {
    const result = concat(left, right)
    // console.debug('left: ', left)
    // console.debug('right: ', right)
    // console.debug('result: ', result)
    return result
  }, epsilon)
}

//////////////////////////////////////////////
/////    derivatives & predicates        /////
//////////////////////////////////////////////

export function isEmpty(regex: ExtRegex): boolean {
  return regex.type === 'literal' && CharSet.isEmpty(regex.charset)
}

function codePointDerivative(codePoint: number, regex: ExtRegex): ExtRegex {
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

export function derivative(str: string, regex: ExtRegex): ExtRegex {
  const firstCodePoint = str.codePointAt(0)
  if (firstCodePoint === undefined) {
    return regex
  } else {
    const restStr = str.slice(1) 
    const restRegex = codePointDerivative(firstCodePoint, regex)

    if (similar(empty, restRegex)) 
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
export function similar(regexA: ExtRegex, regexB: ExtRegex): boolean {
  return compare(regexA, regexB) === 0
}

function compare(regexA: ExtRegex, regexB: ExtRegex): number {
  if (regexA === regexB) { // not necessary but can't hurt to check cheap referential equality first.
    return 0
  } else if (regexA.type !== regexB.type) {
    return regexA.type.localeCompare(regexB.type)
  } else if (regexA.type === 'epsilon') {
    return 0
  } else if (regexA.type === 'literal') {
    assert(regexB.type === regexA.type) // TODO: why not inferred?
    return CharSet.compare(regexA.charset, regexB.charset)
  } else if (regexA.type === 'star' || regexA.type === 'complement') {
    assert(regexB.type === regexA.type) // TODO: why not inferred?
    return compare(regexA.inner, regexB.inner)
  } else if (regexA.type === 'concat' || regexA.type === 'union' || regexA.type === 'intersection') {
    assert(regexB.type === regexA.type) // TODO: why not inferred?
    return compare(regexA.left, regexB.left) || compare(regexA.right, regexB.right)
  }
  checkedAllCases(regexA)
}

function isGreaterThan(regexA: ExtRegex, regexB: ExtRegex): boolean {
  return compare(regexA, regexB) > 0
}
