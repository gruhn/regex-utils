import { hashStr, checkedAllCases, assert, uniqWith, hashNums } from './utils'
import * as CharSet from './char-set'
import * as Stream from './stream'
import * as Table from './table'
import * as AST from './ast'
import { PRNG } from './prng'

/**
 * TODO
 */
type StdRegexWithoutMetaInfo = (
  | { type: "epsilon" }
  | { type: "literal", charset: CharSet.CharSet }
  | { type: "concat", left: StdRegex, right: StdRegex }
  | { type: "union", left: StdRegex, right: StdRegex }
  | { type: "star", inner: StdRegex }
)

/**
 * TODO
 */
type ExtRegexWithoutMetaInfo = (
  | { type: "epsilon" }
  | { type: "literal", charset: CharSet.CharSet }
  | { type: "concat", left: ExtRegex, right: ExtRegex }
  | { type: "union", left: ExtRegex, right: ExtRegex }
  | { type: "star", inner: ExtRegex  }
  // Extended with intersection and complement operator:
  | { type: "intersection", left: ExtRegex, right: ExtRegex }
  | { type: "complement", inner: ExtRegex }
)

/**
 * TODO: docs
 */
export type StdRegex = StdRegexWithoutMetaInfo & { hash: number, isStdRegex: true }

/**
 * TODO: docs
 */
export type ExtRegex = ExtRegexWithoutMetaInfo & { hash: number, isStdRegex: boolean }

export function withMetaInfo(regex: StdRegexWithoutMetaInfo): StdRegex
export function withMetaInfo(regex: ExtRegexWithoutMetaInfo): ExtRegex 
export function withMetaInfo(regex: ExtRegexWithoutMetaInfo): ExtRegex {
  if (regex.type === 'epsilon')
    return {
      ...regex,
      hash: hashStr(regex.type),
      isStdRegex: true,
    }
  else if (regex.type === 'literal')
    return {
      ...regex,
      hash: hashNums([hashStr(regex.type), regex.charset.hash]),
      isStdRegex: true,
    }
  else if (regex.type === 'concat' || regex.type === 'union')
    return {
      ...regex,
      hash: hashNums([
        hashStr(regex.type),
        // Need non-commutative hash operator for `concat`, otherwise "ac" and "ca" are the same:
        regex.left.hash,
        regex.right.hash,
      ]),
      isStdRegex: regex.left.isStdRegex && regex.right.isStdRegex,
    }
  else if (regex.type === 'intersection')
    return {
      ...regex,
      hash: hashNums([
        hashStr(regex.type),
        regex.left.hash,
        regex.right.hash,
      ]),
      isStdRegex: false,
    }
  else if (regex.type === 'star')
    return {
      ...regex,
      hash: hashNums([hashStr(regex.type), regex.inner.hash]),
      isStdRegex: regex.inner.isStdRegex,
    }
  else if (regex.type === 'complement')
    return {
      ...regex,
      hash: hashNums([hashStr(regex.type), regex.inner.hash]),
      isStdRegex: false
    }
  checkedAllCases(regex)  
}

/**
 * TODO
 */
export function isStdRegex(regex: ExtRegex): regex is StdRegex {
  return regex.isStdRegex
}

//////////////////////////////////////////////
///// primitive composite constructors ///////
//////////////////////////////////////////////

export const epsilon: StdRegex = withMetaInfo({ type: 'epsilon'  })

export function literal(charset: CharSet.CharSet): StdRegex {
  return withMetaInfo({ type: 'literal', charset })
}

export const empty: StdRegex = literal(CharSet.empty)

export function concat(left: StdRegex, right: StdRegex): StdRegex
export function concat(left: ExtRegex, right: ExtRegex): ExtRegex
export function concat(left: ExtRegex, right: ExtRegex): ExtRegex {
  if (equal(empty, left))
    // ∅ · r ≈ ∅
    return empty
  if (equal(empty, right))
    // r · ∅ ≈ ∅
    return empty
  if (left.type === "concat")
    // (r · s) · t ≈ r · (s · t)
    return concat(left.left, concat(left.right, right))
  if (left.type === "epsilon")
    // ε · r ≈ r
    return right
  if (right.type === "epsilon")
    // r · ε ≈ r
    return left
  if (left.type === 'union' && equal(left.right, epsilon)) {
    if (equal(left.left, right))
      // (r + ε) · r ≈ r · (r + ε)
      return concat(right, left)
    if (right.type === 'concat' && equal(left.left, right.left)) 
      // (r + ε) · (r · s) ≈ r · ((r + ε) · s)
      return concat(right.left, concat(left, right.right)) 
  }

  // Try to eliminate as many `star`s as possible,
  // e.g. "a+a+" --> "aa*aa*" --> "aaa*a*" --> "aaa*"
  if (left.type === "star") {
    if (equal(left.inner, right))
      // r* · r ≈ r · r*
      return concat(right, left)
    if (right.type === 'concat' && equal(left.inner, right.left))
      // r* · (r · s)  ≈ r · (r* · s)
      return concat(left.inner, concat(left, right.right))
    if (right.type === 'star' && equal(left.inner, right.inner))
      // r* · r*  ≈ r*
      return left
    if (right.type === 'concat' && right.left.type === 'star' && equal(left, right.left))
      // r* · (r* · s) ≈ r* · s
      return concat(left, right.right)
  }

  return withMetaInfo({ type: 'concat', left, right })
}

function extractFront(regex: StdRegex): [StdRegex, StdRegex]
function extractFront(regex: ExtRegex): [ExtRegex, ExtRegex]
function extractFront(regex: ExtRegex): [ExtRegex, ExtRegex] {
  switch (regex.type) {
    case 'epsilon': return [regex, epsilon]
    case 'literal': return [regex, epsilon]
    case 'concat': return [regex.left, regex.right]
    case 'union': return [regex, epsilon]
    case 'star': return [regex, epsilon]
    case 'intersection': return [regex, epsilon]
    case 'complement': return [regex, epsilon]
  }
  checkedAllCases(regex)
}

function extractBack(regex: StdRegex): [StdRegex, StdRegex]
function extractBack(regex: ExtRegex): [ExtRegex, ExtRegex]
function extractBack(regex: ExtRegex): [ExtRegex, ExtRegex] {
  switch (regex.type) {
    case 'epsilon': return [epsilon, epsilon]
    case 'literal': return [epsilon, regex]
    case 'concat': return [regex.left, regex.right]
    case 'union': return [epsilon, regex]
    case 'star': return [epsilon, regex]
    case 'intersection': return [epsilon, regex]
    case 'complement': return [epsilon, regex]
  }
  checkedAllCases(regex)
}

export function union(left: StdRegex, right: StdRegex): StdRegex
export function union(left: ExtRegex, right: ExtRegex): ExtRegex
export function union(left: ExtRegex, right: ExtRegex): ExtRegex {
  if (left.type === 'union')
    // (r + s) + t ≈ r + (s + t)
    return union(left.left, union(left.right, right))
  if (equal(left, right))
    // r + r ≈ r
    return left
  if (equal(left, empty))
    // ∅ + r ≈ r
    return right
  if (left.type === 'epsilon')
    // ε + r ≈ r + ε 
    return union(right, left)
  if (equal(empty, right))
    // r + ∅ ≈ r
    return left
  if (equal(left, complement(empty)))
    // ¬∅ + r ≈ ¬∅
    return complement(empty)
  if (equal(complement(empty), right))
    // r + ¬∅ ≈ ¬∅
    return complement(empty)
  if (left.type === 'literal' && right.type === 'literal')
    // R + S ≈ R ∪ S
    return literal(CharSet.union(left.charset, right.charset))
  if (left.type === 'star' && right.type === 'epsilon')
    // r* + ε = r*
    return left

  if (right.type == 'union') {
    if (equal(left, right.left))
      // r + (r + s) = r + s
      return union(left, right.right)
    if (equal(left, right.right))
      // r + (s + r) = r + s
      return union(left, right.left)

    // const [leftHead, leftTail] = extractFront(left)
    // const [rightHead, rightTail] = extractFront(right.left)
    // if (equal(leftHead, rightHead))
    //   // (r · s) + ((r · t) + u) = (r · (s + t)) + u
    //   return union(concat(left, union(leftTail, rightTail)), right.right)
    //   // return concat(left, optional(union(leftTail, right.right)))
  }

  const [leftHead, leftTail] = extractFront(left)
  const [rightHead, rightTail] = extractFront(right)

  if (equal(leftHead, rightHead))
    // (r · s) + (r · t) = r · (s + t)
    // (r · s) + r       = r · (s + ε)
    // r       + (r · s) = r · (ε + s)
    // r       + r*      = r · (ε + r*)
    return concat(leftHead, union(leftTail, rightTail))

  const [leftInit, leftLast] = extractBack(left)
  const [rightInit, rightLast] = extractBack(right)

  if (equal(leftLast, rightLast))
    // (s · r) + (t · r) = (s + t) · r
    // (s · r) + r       = (s + ε) · r
    // r       + (s · r) = (s + ε) · r
    return concat(union(leftInit, rightInit), leftLast)

  return withMetaInfo({ type: 'union', left, right })
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
  else if (inner.type === 'concat' && inner.left.type === 'star' && inner.right.type === 'star')
    // (r∗ · s∗)∗ = (r + s)∗
    return star(union(inner.left.inner, inner.right.inner))
  else
    return withMetaInfo({ type: "star", inner })
}

export function intersection(left: ExtRegex, right: ExtRegex): ExtRegex {
  if (left.type === "intersection")
    // (r & s) & t ≈ r & (s & t)
    return intersection(left.left, intersection(left.right, right))
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
    // r & ¬∅ ≈ r
    return left 
  else if (equal(left, right)) 
    // r & r ≈ r
    return left 
  else if (left.type === 'literal' && right.type === 'literal') 
    // R & S ≈ R∩S
    return literal(CharSet.intersection(left.charset, right.charset))

  return withMetaInfo({ type: "intersection", left, right })
}

/**
 * TODO: docs
 * 
 * @public
 */
export function complement(inner: ExtRegex): ExtRegex {
  if (inner.type === "complement")
    // ¬(¬r) ≈ r
    return inner
  // FIXME: actually wrong. Rather: ¬S ≈ ε + (Σ\S) + Σ{2,}
  // else if (inner.type === 'literal')
  //   // ¬S ≈ (Σ\S
  //   return literal(CharSet.complement(inner.charset))
  else
    return withMetaInfo({ type: "complement", inner })
}

//////////////////////////////////////////////
// some additional composite constructors ////
//////////////////////////////////////////////

/**
 * Regex that matches any single character. 
 * Equivalent to the dot: `.`.
 * 
 * @public
 */
export const anySingleChar: StdRegex = literal(CharSet.alphabet)

/**
 * Regex that matches the single given character.
 * E.g. `singleChar('a')` is equivalent to `/^a$/`.
 * Meta characters like "$", ".", etc don't need to 
 * be escaped, i.e. `singleChar('.')` will match "."
 * literally and not any-single-character.
 *
 * @throws if `char` is not exactly one character.
 * @public
 */
export function singleChar(char: string): StdRegex {
  return literal(CharSet.singleton(char))
}

/**
 * Creates a regex that matches a string of literal characters.
 * A shorthand for `seq([singleChar(...), singleChar(...), ...])`.
 *
 * @example
 * ```typescript
 * string('abc') // like /abc/
 * ```
 */
export function string(str: string): StdRegex {
  return seq([...str].map(singleChar))
}

/**
 * This is like the `?` postfix operator.
 *
 * @example
 * ```typescript
 * optional(singleChar('a')) // like /a?/
 * ```
 */
export function optional(regex: StdRegex): StdRegex
export function optional(regex: ExtRegex): ExtRegex
export function optional(regex: ExtRegex): ExtRegex {
  return union(epsilon, regex)
}

/**
 * This is like regex concatenation (aka. juxtaposition).
 *
 * @example
 * ```typescript
 * seq([ singleChar('a'), anySingleChar ]) // like /a./
 * ```
 * 
 * @public
 */
export function seq(res: StdRegex[]): StdRegex
export function seq(res: ExtRegex[]): ExtRegex
export function seq(res: ExtRegex[]): ExtRegex {
  // Reducing right-to-left should trigger fewer normalization steps in `concat`:
  return res.reduceRight((right, left) => concat(left, right), epsilon)
}

/**
 * Constructs quantified regular expressions, subsuming all these
 * regex operators: `*`, `+`, `{n,m}`, `?`.
 */
export function repeat(regex: StdRegex, bounds?: AST.RepeatBounds): StdRegex
export function repeat(regex: ExtRegex, bounds?: AST.RepeatBounds): ExtRegex
export function repeat(regex: ExtRegex, bounds?: AST.RepeatBounds): ExtRegex {
  if (bounds === undefined) {
    return repeatAux(regex, 0, Infinity)
  } else if (typeof bounds === 'number') {
    return repeatAux(regex, bounds, bounds)
  } else {
    const { min = 0, max = Infinity } = bounds
    assert(0 <= min && min <= max)
    return repeatAux(regex, min, max)   
  }
}

function repeatAux(regex: StdRegex, min: number, max: number): StdRegex
function repeatAux(regex: ExtRegex, min: number, max: number): ExtRegex
function repeatAux(regex: ExtRegex, min: number, max: number): ExtRegex {
  const requiredPrefix = seq(Array(min).fill(regex))

  if (max === Infinity)
    return concat(requiredPrefix, star(regex))
  else 
    return concat(
      requiredPrefix,
      seq(Array(max - min).fill(optional(regex)))
    )
}

//////////////////////////////////////////////
/////    derivatives & predicates        /////
//////////////////////////////////////////////

export function isEmpty(regex: ExtRegex): boolean {
  return regex.type === 'literal' && CharSet.isEmpty(regex.charset)
}

export class CacheOverflowError extends Error {}

export function codePointDerivative(codePoint: number, regex: StdRegex, cache: Table.Table<StdRegex>): StdRegex
export function codePointDerivative(codePoint: number, regex: ExtRegex, cache: Table.Table<ExtRegex>): ExtRegex
export function codePointDerivative(codePoint: number, regex: ExtRegex, cache: Table.Table<ExtRegex>): ExtRegex {
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
          concat(codePointDerivativeAux(codePoint, regex.left, cache), regex.right),
          codePointDerivativeAux(codePoint, regex.right, cache)
        )
      else 
        return concat(
          codePointDerivativeAux(codePoint, regex.left, cache),
          regex.right
        )
    }
    case "union":
      return union(
        codePointDerivativeAux(codePoint, regex.left, cache),
        codePointDerivativeAux(codePoint, regex.right, cache)
      )
    case "intersection":
      return intersection(
        codePointDerivativeAux(codePoint, regex.left, cache),
        codePointDerivativeAux(codePoint, regex.right, cache)
      )
    case "star":
      return concat(
        codePointDerivativeAux(codePoint, regex.inner, cache),
        star(regex.inner)
      )
    case "complement":
      return complement(codePointDerivativeAux(codePoint, regex.inner, cache))
  }  
  checkedAllCases(regex)
}

function codePointDerivativeAux(codePoint: number, regex: StdRegex, cache: Table.Table<StdRegex>): StdRegex
function codePointDerivativeAux(codePoint: number, regex: ExtRegex, cache: Table.Table<ExtRegex>): ExtRegex
function codePointDerivativeAux(codePoint: number, regex: ExtRegex, cache: Table.Table<ExtRegex>): ExtRegex {
  const cachedResult = Table.get(codePoint, regex.hash, cache)
  if (cachedResult === undefined) {
    // Rather throw an error when cache grows too large than getting OOM killed.
    // At least errors can be caught and handled. The limit is somewhat arbitrary.
    // TODO: maybe make this user configurable:
    if (Table.size(cache) >= 10_000) {
      throw new CacheOverflowError('Cache overflow while computing DFA transitions.')
    }

    const result = codePointDerivative(codePoint, regex, cache)
    Table.set(codePoint, regex.hash, result, cache)
    return result
  } else {
    return cachedResult
  }
}



/**
 * TODO: docs
 * 
 * @public
 */
export function derivative(str: string, regex: StdRegex): StdRegex
export function derivative(str: string, regex: ExtRegex): ExtRegex 
export function derivative(str: string, regex: ExtRegex): ExtRegex {
  const firstCodePoint = str.codePointAt(0)
  if (firstCodePoint === undefined) {
    return regex
  } else {
    const restStr = str.slice(1) 
    const restRegex = codePointDerivative(firstCodePoint, regex, new Map())

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

function allNonEmptyIntersections(
  classesA: CharSet.CharSet[],
  classesB: CharSet.CharSet[],
  cache: Table.Table<CharSet.CharSet[]>
): CharSet.CharSet[] {
  const hashA = hashNums(classesA.map(classA => classA.hash))
  const hashB = hashNums(classesB.map(classB => classB.hash))
  // Function is symmetric so no need to memoize both hash pairs (1,2) and (2,1):
  const hashMin = hashA <= hashB ? hashA : hashB
  const hashMax = hashA <= hashB ? hashB : hashA

  const resultCached = Table.get(hashMin, hashMax, cache)
  if (resultCached !== undefined) {
    return resultCached
  }

  // Rather throw an error when cache grows too large than getting OOM killed.
  // At least errors can be caught and handled. The limit is somewhat arbitrary.
  // TODO: maybe make this user configurable:
  if (Table.size(cache) >= 10_000) {
    throw new CacheOverflowError()
  }

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
  Table.set(hashMin, hashMax, finalResult, cache)   
  return finalResult
}

export type DerivativeClassesCache = {
  classes: Map<number, CharSet.CharSet[]>
  intersections: Table.Table<CharSet.CharSet[]>
}

export function derivativeClasses(
  regex: ExtRegex,
  cache: DerivativeClassesCache
): CharSet.CharSet[] {
  switch (regex.type) {
    case "epsilon":
      return [CharSet.alphabet]
    case "literal": 
      return [regex.charset, CharSet.complement(regex.charset)]
        .filter(charset => !CharSet.isEmpty(charset))   
        .toSorted(CharSet.compare)
    case "concat": {
      if (isNullable(regex.left))
        return allNonEmptyIntersections(
          derivativeClassesAux(regex.left, cache),
          derivativeClassesAux(regex.right, cache),
          cache.intersections,
        )
      else 
        return derivativeClassesAux(regex.left, cache)
    }
    case "union":
      return allNonEmptyIntersections(
        derivativeClassesAux(regex.left, cache),
        derivativeClassesAux(regex.right, cache),
        cache.intersections,
      )
    case "intersection":
      return allNonEmptyIntersections(
        derivativeClassesAux(regex.left, cache),
        derivativeClassesAux(regex.right, cache),
        cache.intersections
      )
    case "star":
      return derivativeClassesAux(regex.inner, cache)
    case "complement":
      return derivativeClassesAux(regex.inner, cache)
  }  
  checkedAllCases(regex)
}

function derivativeClassesAux(
  regex: ExtRegex,
  cache: DerivativeClassesCache
) {
  const cachedResult = cache.classes.get(regex.hash)
  if (cachedResult === undefined) {
    // Rather throw an error when cache grows too large than getting OOM killed.
    // At least errors can be caught and handled. The limit is somewhat arbitrary.
    // TODO: maybe make this user configurable:
    if (cache.classes.size >= 10_000) {
      throw new CacheOverflowError()
    }

    const result = derivativeClasses(regex, cache)
    cache.classes.set(regex.hash, result)
    return result
  } else {
    return cachedResult
  }
}


//////////////////////////////////////////////
///// exclusive standard regex utils     /////
//////////////////////////////////////////////

export class VeryLargeSyntaxTreeError extends Error {}

/**
 * TODO: docs
 * 
 * @public
 */
export function toRegExp(regex: StdRegex): RegExp {
  return new RegExp(toString(regex))
}

export function toString(regex: StdRegex): string {
  const size = nodeCount(regex)
  if (size > 1_000_000) {
    throw new VeryLargeSyntaxTreeError(
      "Won't try to convert to RegExp. Syntax tree has over 1_000_000 nodes."
    )
  }

  // Render parenthesis as non-capturing groups if there is a large number of them,
  // i.e. `/(?:abc)` instead of `/(abc)/`. `new RegExp(...)` throws an error if there
  // is a large number of capturing groups. Non-capturing groups are a bit more verbose
  // but at large sizes like this it hardly hurts readability anymore:
  const useNonCapturingGroups = size > 10_000

  return '^(' + AST.toString(toRegExpAST(regex), { useNonCapturingGroups }) + ')$'
}

// TODO:
// - "a+" instead of "aa*".
// - "a{3,}" instead of "a{3}a*".
// - "a{,3}" instead of "a?a?a?".
function toRegExpAST(regex: StdRegex): AST.RegExpAST {
  switch (regex.type) {
    case 'epsilon':
      return regex
    case 'literal':
      return regex
    case 'concat': {
      const [len, rest] = extractConcatChain(regex.left, regex.right)
      if (len === 0) {
        return AST.concat(
          toRegExpAST(regex.left),
          toRegExpAST(regex.right),
        )
      } else {
        const left = AST.repeat(toRegExpAST(regex.left), len+1)

        if (rest === undefined)
          return left
        else 
          return AST.concat(left, toRegExpAST(rest))
      }
    }
    case 'union': {
      // The `union` smart constructor should guarantee that there is only 
      // ever a right epsilon (never only on the left or on both sides):
      if (regex.right.type === 'epsilon')
        return AST.optional(toRegExpAST(regex.left))
      else
        return AST.union(
          toRegExpAST(regex.left),
          toRegExpAST(regex.right),
        )
    }
    case 'star':
      return AST.star(toRegExpAST(regex.inner))
  }
  checkedAllCases(regex)
}

/**
 * Rather ad-hoc way to find chains of same regexes, e.g. `[a-z][a-z][a-z]`,
 * to produce more compact representation when converting to string,
 * e.g. `[a-z]{3}`
 */
function extractConcatChain(left: StdRegex, right: StdRegex): [number, StdRegex | undefined] {
  if (right.type === 'concat' && equal(left, right.left)) {
    const [len, rest] = extractConcatChain(left, right.right)
    return [len+1, rest]
  } else if (equal(left, right)) {
    return [1, undefined]
  } else {
    return [0, right]
  }
}

export function enumerate(regex: StdRegex): Stream.Stream<string> {
  return enumerateMemoized(regex, new Map())
}

function enumerateMemoized(
  regex: StdRegex,
  cache: Map<number, Stream.Stream<string> | undefined>
): Stream.Stream<string> {
  const cached = cache.get(regex.hash)
  if (cached !== undefined) {
    return cached
  } else {
    const result = enumerateMemoizedAux(regex, cache)
    cache.set(regex.hash, result)
    return result
  }
}
function enumerateMemoizedAux(
  regex: StdRegex,
  cache: Map<number, Stream.Stream<string> | undefined>
): Stream.Stream<string> {
  switch (regex.type) {
    case 'epsilon':
      return Stream.singleton('')
    case 'literal':
      return CharSet.enumerate(regex.charset)
    case 'concat':
      return Stream.diagonalize(
        (l,r) => l+r,
        enumerateMemoized(regex.left, cache),
        enumerateMemoized(regex.right, cache),
      )
    case 'union':
      return Stream.interleave(
        enumerateMemoized(regex.left, cache),
        enumerateMemoized(regex.right, cache),
      )
    case 'star':
      return Stream.cons(
        '',
        () => Stream.diagonalize(
          (l,r) => l+r,
          enumerateMemoized(regex.inner, cache),
          enumerateMemoized(regex, cache),
        )
      )
  }
}

/**
 * Generates random strings that match the given regex using a deterministic seed.
 * Unlike enumerate(), this produces a stream of random samples rather than
 * a fair enumeration of all possible matches.
 * 
 * @param re - The regex to sample from
 * @param seed - Deterministic seed for random generation (default: 42)
 * @param maxDepth - Maximum recursion depth to prevent infinite loops (default: 100)
 * @returns Generator yielding random matching strings
 * 
 * @public
 */
export function* sample(re: StdRegex, seed: number = 42, maxDepth: number = 10**9): Generator<string> {
  const rng = new PRNG(seed)

  // To reduce sampling bias, we weight probabilities by number of nodes in a sub-expression.
  // To not re-compute these counts, we traverse the tree once and populate a cache of node
  // counts at every node:
  const cachedNodeCount = new Map<number, number>()
  nodeCountAux(re, cachedNodeCount)
  const lookupNodeCount = (subExpr: StdRegex): number => {
    const count = cachedNodeCount.get(subExpr.hash)
    assert(count !== undefined, 'logic error: node count cache should be populated for all subexpressions')
    return count
  }
  
  while (true) {
    try {
      const result = sampleAux(re, rng, maxDepth, lookupNodeCount)
      if (result !== null) {
        yield result
      }
    } catch {
      // If we hit max depth or other issues, skip this sample
      continue
    }
  }
}
function sampleAux(
  regex: StdRegex,
  rng: PRNG,
  maxDepth: number,
  lookupNodeCount: (subExpr: StdRegex) => number
): string | null {
  if (maxDepth <= 0) {
    throw new Error('Max depth exceeded')
  }

  switch (regex.type) {
    case 'epsilon':
      return ''
    
    case 'literal': {
      return CharSet.sampleChar(regex.charset, (max) => rng.nextInt(max))
    }
    
    case 'concat': {
      const leftSample = sampleAux(regex.left, rng, maxDepth / 2, lookupNodeCount)
      if (leftSample === null) return null
      const rightSample = sampleAux(regex.right, rng, maxDepth / 2, lookupNodeCount)
      if (rightSample === null) return null
      return leftSample + rightSample
    }
    
    case 'union': {
      // For unions we randomly sample from the left- or right subtree.
      // The probability is weighted by the number of nodes in the subtree.
      // Consider the expression /^(aa|(bb|cc))$/ which matches the three strings: "aa", "bb", "cc".
      // If we give equal probability to all branches, we sample 50% "aa", 25% "bb" and 25% "cc".
      // Weighting by node count does not eliminate this problem completely. 
      // We could also weight by the number of strings matched by the subtrees (computed using `size`).
      // But what to we do if one of the subtrees matches infinitely many strings (e.g. /^(a|b*)$/)?
      const leftCount = lookupNodeCount(regex.left)
      const rightCount = lookupNodeCount(regex.right)
      const chooseLeft = rng.next() < leftCount / (leftCount + rightCount)

      if (chooseLeft) {
        return sampleAux(regex.left, rng, maxDepth - 1, lookupNodeCount)
      } else {
        return sampleAux(regex.right, rng, maxDepth - 1, lookupNodeCount)
      }
    }
    
    case 'star': {
      // Randomly choose whether to stop repetition or to continue:
      const chooseStop = rng.next() < 0.5
      if (chooseStop) {
        return ""
      } else {
        const innerSample = sampleAux(regex.inner, rng, maxDepth / 2, lookupNodeCount)
        if (innerSample === null) return null
        const restSample = sampleAux(regex, rng, maxDepth / 2, lookupNodeCount)
        if (restSample === null) return null
        return innerSample + restSample
      }

    }
  }
  
  checkedAllCases(regex)
}

/**
 * TODO
 */
export function size(regex: StdRegex): bigint | undefined {
  return sizeMemoized(regex, new Map())
}

// For handwritten regex, memoizing the size of sub-expressions
// is probably irrelevant but output regex from `intersection`
// can often have a lot of duplicate sub-expressions. There
// memoization can speed up `size` a lot:
function sizeMemoized(
  regex: StdRegex,
  cache: Map<number, bigint | undefined>
): bigint | undefined {
  const cached = cache.get(regex.hash)
  if (cached !== undefined) {
    return cached
  } else {
    const result = sizeMemoizedAux(regex, cache)
    cache.set(regex.hash, result)
    return result
  }
}
function sizeMemoizedAux(
  regex: StdRegex,
  cache: Map<number, bigint | undefined>
): bigint | undefined {
  switch (regex.type) {
    case 'epsilon':
      return 1n
    case 'literal':
      return BigInt(CharSet.size(regex.charset))
    case 'concat': {
      const leftSize = sizeMemoized(regex.left, cache)
      const rightSize = sizeMemoized(regex.right, cache)
      if (leftSize !== undefined && rightSize !== undefined)
        return leftSize * rightSize
      else
        return undefined
    }
    case 'union': {
      const leftSize = sizeMemoized(regex.left, cache)
      const rightSize = sizeMemoized(regex.right, cache)
      if (leftSize !== undefined && rightSize !== undefined)
        return leftSize + rightSize
      else
        return undefined
    }
    case 'star': {
      const innerSize = sizeMemoized(regex.inner, cache)
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

export function nodeCount(
  regex: ExtRegex,
  cache: Map<number, number> = new Map()
): number {
  switch (regex.type) {
    case 'epsilon':
      return 1
    case 'literal':
      return 1
    case 'concat':
      return nodeCountAux(regex.left, cache) + nodeCountAux(regex.right, cache) + 1
    case 'union':
      return nodeCountAux(regex.left, cache) + nodeCountAux(regex.right, cache) + 1
    case 'star':
      return nodeCountAux(regex.inner, cache) + 1
    case 'intersection':
      return nodeCountAux(regex.left, cache) + nodeCountAux(regex.right, cache) + 1
    case 'complement':
      return nodeCountAux(regex.inner, cache) + 1
  }
  checkedAllCases(regex)
}

function nodeCountAux(
  regex: ExtRegex,
  cache: Map<number, number>
): number {
  const cachedResult = cache.get(regex.hash)
  if (cachedResult === undefined) {
    const result = nodeCount(regex, cache)   
    cache.set(regex.hash, result)
    return result
  } else {
    return cachedResult
  }
}

export function debugShow(regex: ExtRegex): any {
  return JSON.stringify(debugShowAux(regex), null, 2)
}
export function debugPrint(regex: ExtRegex): any {
  return console.debug(JSON.stringify(debugShowAux(regex), null, 2))
}

function debugShowAux(regex: ExtRegex): any {
  switch (regex.type) {
    case 'epsilon':
      return 'ε'
    case 'literal':
      return CharSet.toString(regex.charset)
    case 'concat':
      return { type: 'concat', left: debugShowAux(regex.left), right: debugShowAux(regex.right) }
    case 'union':
      return { type: 'union', left: debugShowAux(regex.left), right: debugShowAux(regex.right) }
    case 'star':
      return { type: 'star', inner: debugShowAux(regex.inner) }
    case 'intersection':
      return { type: 'intersection', left: debugShowAux(regex.left), right: debugShowAux(regex.right) }
    case 'complement':
      return { type: 'complement', inner: debugShowAux(regex.inner) }
  }
  checkedAllCases(regex)
}
