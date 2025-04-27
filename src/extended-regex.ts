import { hashNums, hashStr, checkedAllCases, assert, uniqWith } from './utils'
import * as CharSet from './char-set'

/**
 * TODO
 */
export type ExtRegexWithoutHash =
  | { type: "epsilon" }
  | { type: "literal", charset: CharSet.CharSet }
  | { type: "concat", left: ExtRegex, right: ExtRegex }
  | { type: "union", left: ExtRegex, right: ExtRegex }
  | { type: "star", inner: ExtRegex }
  | { type: "intersection", left: ExtRegex, right: ExtRegex }
  | { type: "complement", inner: ExtRegex }

export type ExtRegex = Readonly<{ hash: number } & ExtRegexWithoutHash>

function withHash(regex: ExtRegexWithoutHash): ExtRegex {
  if (regex.type === 'epsilon')
    return { ...regex, hash: hashStr(regex.type) }
  else if (regex.type === 'literal')
    return { ...regex, hash: hashNums([hashStr(regex.type), CharSet.hash(regex.charset)]) }
  else if (regex.type === 'concat' || regex.type === 'union' || regex.type === 'intersection')
    return { ...regex, hash: hashNums([hashStr(regex.type), regex.left.hash, regex.right.hash]) }
  else if (regex.type === 'star' || regex.type === 'complement')
    return { ...regex, hash: hashNums([hashStr(regex.type), regex.inner.hash]) }
  checkedAllCases(regex)  
}

//////////////////////////////////////////////
///// primitive composite constructors ///////
//////////////////////////////////////////////

export const epsilon: ExtRegex = withHash({ type: "epsilon" })

export function literal(charset: CharSet.CharSet): ExtRegex {
  return withHash({ type: 'literal', charset })
}

export const empty: ExtRegex = literal([])

export function concat(left: ExtRegex, right: ExtRegex): ExtRegex {
  if (left.type === "concat")
    // (r · s) · t ≈ r · (s · t)
    return concat(left.left, concat(left.right, right))
  else if (left.type === "epsilon")
    // ε · r ≈ r
    return right
  else if (right.type === "epsilon")
    // r · ε ≈ r
    return left
  else if (equal(empty, left))
    // ∅ · r ≈ ∅
    return empty
  else if (equal(empty, right))
    // r · ∅ ≈ ∅
    return empty
  else 
    return withHash({ type: "concat", left, right })
}

export function union(left: ExtRegex, right: ExtRegex): ExtRegex {
  if (left.type === "union")
    // (r + s) + t ≈ r + (s + t)
    return union(left.left, union(left.right, right))
  else if (left.type === 'literal' && right.type === 'literal')
    // R + S ≈ R ∪ S
    return literal(CharSet.union(left.charset, right.charset))
  else if (equal(complement(empty), left))
    // ¬∅ + r ≈ ¬∅
    return complement(empty)
  else if (equal(empty, left))
    // ∅ + r ≈ r
    return right
  else if (equal(left, right)) 
    // r + r ≈ r
    return left
  else if (left.hash > right.hash) // TODO: this check is re-computed in the recursive call
    // r + s ≈ s + r
    return union(right, left)
  else 
    return withHash({ type: "union", left, right })
}

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
  if (left.type === "intersection")
    // (r & s) & t ≈ r & (s & t)
    return intersection(left.left, intersection(left.right, right))
  else if (equal(empty, left))
    // ∅ & r ≈ ∅
    return empty 
  else if (equal(left, complement(empty)))
    // ¬∅ & r ≈ r
    return right 
  else if (equal(left, right)) 
    // r & r ≈ r
    return left 
  else if (left.hash > right.hash) // TODO: this check is re-computed in the recursive call
    // r & s ≈ s & r
    return intersection(right, left) 
  else
    return withHash({ type: "intersection", left, right })
}

export function complement(inner: ExtRegex): ExtRegex {
  if (inner.type === "complement")
    // ¬(¬r) ≈ r
    return inner
  else
    return withHash({ type: "complement", inner })
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
  return res.reduceRight((right, left) => concat(left, right), epsilon)
}

//////////////////////////////////////////////
/////    derivatives & predicates        /////
//////////////////////////////////////////////

export function isEmpty(regex: ExtRegex): boolean {
  return regex.type === 'literal' && CharSet.isEmpty(regex.charset)
}

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

function allIntersections(classesA: CharSet.CharSet[], classesB: CharSet.CharSet[]): CharSet.CharSet[] {
  const result: CharSet.CharSet[] = []
  for (const classA of classesA) {
    for (const classB of classesB) {
      result.push(CharSet.intersection(classA, classB))
    }
  }
  return uniqWith(result, CharSet.compare)
}

export function derivativeClasses(regex: ExtRegex): CharSet.CharSet[] {
  const alphabet = CharSet.fullAlphabet()

  switch (regex.type) {
    case "epsilon":
      return [alphabet]
    case "literal":
      return [regex.charset, CharSet.difference(alphabet, regex.charset)]
    case "concat": {
      if (isNullable(regex)) 
        return allIntersections(
          derivativeClasses(regex.left),
          derivativeClasses(regex.right)
        )
      else 
        return derivativeClasses(regex.left)     
    }
    case "union":
      return allIntersections(
        derivativeClasses(regex.left),
        derivativeClasses(regex.right)
      )
    case "intersection":
      return allIntersections(
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
