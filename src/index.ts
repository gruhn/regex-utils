import { toStdRegex } from './dfa'
import * as RE from './regex'
import { parseRegExp } from './regex-parser'

/**
 * Union of types which can be converted to a `RegexBuilder` instance.
 * 
 * Native JavaScript `RegExp` are interpreted as is. Note, if start/end 
 * markers are missing (i.e. `^`/`$`) then there is an implicit `.*` at 
 * the start and end:
 * 
 * ```typescript
 * RB(/^abc$/) // is like /^abc$/
 * RB(/abc/) // is like /^.*abc.*$/
 * ```
 * 
 * Strings are interpreted as literal characters. For example, `.` is
 * interpreted as the literal dot character and not _any character_ as in
 * regular expression:
 *
 * ```typescript
 * RB('abc') // is like /^abc$/
 * RB('.') // is like /^\.$/
 * ```
 * 
 * If no arguments (or `undefined`) is passed to `RB`, then it returns an
 * that matches no strings at all. This can be useful when constructing `RB`
 * instances programmatically.
 * 
 * ```typescript
 * ['a', 'b', 'c'].reduce((acc, char) => acc.or(RB(char)), RB()) // like /^(a|b|c)$/
 * ```
 * 
 * This is also an example why `RegexBuilder` itself is accepted as input.
 * 
 * The final type `ExtRegex` is an internal representation that's likely not
 * interesting.
 */
export type RegexLike = undefined | string | RegExp | RegexBuilder | RE.ExtRegex 

function fromRegexLike(re: RegexLike): RE.ExtRegex {
  if (re === undefined) 
    return RE.empty
  else if (typeof re === 'string')
    return RE.string(re)
  else if (re instanceof RegExp)
    return parseRegExp(re)
  else if (re instanceof RegexBuilder)
    return re.regex
  else
    return re
}

/**
 * A wrapper class for JavaScript regular expressions that exposes the utility 
 * functions of this library and also provides a DSL for constructing regular
 * expression.
 */
class RegexBuilder {
  private cachedStdRegex?: RE.StdRegex = undefined

  /**
   * @hidden
   */
  constructor(
    /**
     * @hidden
     */
    public readonly regex: RE.ExtRegex
  ) { }

  private getStdRegex(): RE.StdRegex {
    if (RE.isStdRegex(this.regex)) {
      return this.regex
    } else if (this.cachedStdRegex !== undefined) {
      return this.cachedStdRegex
    } else {
      this.cachedStdRegex = toStdRegex(this.regex)
      return this.cachedStdRegex
    }
  }

  /**
   * This is like the regex pipe operator `|` (aka. alternation, aka. union, aka. or).
   *
   * @example
   * ```typescript
   * RB('a').or('b') // like /^(a|b)$/
   * ```
   * 
   * @public
   */
  or(re: RegexLike): RegexBuilder {
    return new RegexBuilder(RE.union(this.regex, fromRegexLike(re)))
  }

  /**
   * Constructs the intersection of two regex.
   * This is useful to combine several constraints into one. 
   * For example, to build a regular expression that can validate a new password:
   * 
   * @example
   * ```typescript
   * const passwordRegex = RB(/.{12,}/) // 12 letters or more
   *   .and(/[0-9]/) // at least one number
   *   .and(/[A-Z]/) // at least one upper case letter   
   *   .and(/[a-z]/) // at least one lower case letter
   *   .toRegExp()
   *
   * function isValidPassword(str: string) {
   *   return passwordRegex.test(str)
   * }
   * ```
   *
   * In most cases it's simpler and more efficient to match each `RegExp` individually:
   * 
   * ```typescript
   * function isValidPassword(str: string) {
   *   return /.{12,}/.test(str) && /[0-9]/.test(str) && /[A-Z]/.test(str) && /[a-z]/.test(str)
   * }
   * ```
   * 
   * However, this is not always possible. 
   * For example, when a third-party interface expect a single `RegExp` as input like:
   * - Express.js - for route parameter matching and path specifications
   * - Yup/Joi/Zod - for string pattern validation
   * - Webpack - in various configuration options like test, include, and exclude patterns
   * - fast-check - for random string generation during fuzzing / property based testing
   * 
   * @public
   */
  and(re: RegexLike): RegexBuilder {
    return new RegexBuilder(RE.intersection(this.regex, fromRegexLike(re)))
  }

  /**
   * Constructs the regex complement, i.e. the regex that matches exactly the strings that the
   * current regex is not matching.
   *
   * TODO: examples.
   */
  not(): RegexBuilder {
    return new RegexBuilder(RE.complement(this.regex))
  }

  /**
   * Concatenates two regex.
   *
   * @example
   * ```typescript
   * RB('aaa').concat('bbb') // like /^aaabbb$/
   * ```
   * 
   * @public
   */
  concat(re: RegexLike): RegexBuilder {
    return new RegexBuilder(RE.concat(this.regex, fromRegexLike(re)))
  }

  /**
   * Constructs quantified regular expressions, subsuming all these
   * regex operators: `*`, `+`, `{n,m}`, `?`.
   *
   * @example
   * ```typescript
   * RB('a').repeat(4) // a{4}
   * RB('a').repeat({ min: 3, max: 5 }) // a{3,5}
   * RB('a').repeat({ max: 5 }) // a{,5}
   * RB('a').repeat({ min: 3 }) // a{3,}
   * RB('a').repeat({ min: 0, max: 1 }) // a?
   * RB('a').repeat({ min: 0 }) // a*
   * RB('a').repeat() // a*
   * ```
   * 
   * @public
   */
  repeat(bounds: RE.RepeatBounds = { min: 0 }): RegexBuilder {
    return new RegexBuilder(
      RE.repeat(this.regex, bounds)
    )
  }

  /**
   * This is like the `?` postfix operator.
   *
   * @example
   * ```typescript
   * RB('a').optional() // like /^a?$/
   * ```
   * 
   * @public
   */
  optional(): RegexBuilder {
    return new RegexBuilder(RE.optional(this.regex))
  }

  /**
   * Compute a [Brzozowski derivative](https://en.wikipedia.org/wiki/Brzozowski_derivative) of the given `RegExp`.
   *
   * TODO: examples.
   * 
   * @public
   */
  derivative(prefix: string): RegexBuilder {
    return new RegexBuilder(RE.derivative(prefix, this.regex))
  }

  /**
   * Returns the number of strings that match the regex or `undefined` if there are infinitely many matches.
   * 
   * @example
   * ```typescript
   * RB(/^[a-z]$/).size() === 26n
   * 
   * RB(/^[a-z][0-9]$/).size() === 260n
   * 
   * // this one has infinitely many matches:
   * RB(/^[a-z]*$/).size() === undefined
   * 
   * // that's why the return type is `bigint`;
   * RB(/^[a-z]{60}/).size() === 7914088058189701615326255069116716194962212229317838559326167922356251403772678373376n 
   * ```
   * 
   * > [!NOTE]
   * > Double counting is often avoided. 
   * > For example, `RB(/^(hello|hello)$/).size()` is only `1n` and not `2n`.
   * > But it probably still happens.
   * > The value should always be an upper bound though.
   * 
   * @public
   */
  size() {
    return RE.size(this.getStdRegex())
  }

  /**
   * A [generator function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*)
   * that returns a (potentially infinite) stream of strings that match the given `RegExp`.
   * This can be useful for testing regular expressions.
   * 
   * @example
   * ```typescript
   * const emailRegex = /^[a-z]+@[a-z]+\.[a-z]{2,}$/
   * 
   * for (const matchedStr of RB(emailRegex).enumerate()) {
   *   console.log(matchedStr)
   * }
   * ```
   * ```
   * a@a.aa
   * b@a.aa
   * aa@a.aa
   * c@a.aa
   * ba@a.aa
   * a@b.aa
   * d@a.aa
   * ca@a.aa
   * b@b.aa
   * ab@a.aa
   * e@a.aa
   * da@a.aa
   * c@b.aa
   * bb@a.aa
   * aa@b.aa
   * f@a.aa
   * ea@a.aa
   * d@b.aa
   * cb@a.aa
   * ba@b.aa
   * a@aa.aa
   * g@a.aa
   * ...
   * ```
   * 
   * > [!WARNING]
   * > If the regular expression matches infinitely many strings then a loop like above won't terminate.
   * 
   * > [!TIP]
   * > Use the new [Iterator helpers](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator/take)
   * > to only get the first N matches, e.g `RB(emailRegex).enumerate().take(100)`.
   * 
   * The generator produces a _fair enumeration_.
   * That means every string that matches the regular expression is _eventually_ enumerated.
   * To illustrate, an unfair enumeration of `/^(a+|b+)$/` would be:
   * ```
   * "a", "aa", "aaa", "aaaa", "aaaaa", ...
   * ```
   * because it never produces any strings of b's.
   * A possible fair enumeration is:
   * ```
   * "a", "b", "aa", "bb", "aaa", "bbb", "aaaa", "bbbb", ...
   * ```
   */
  enumerate() {
    return RE.enumerate(this.getStdRegex())
  }

  /**
   * Converts back to a native JavaScript `RegExp`. 
   * 
   * @warning
   * The generated `RegExp` can be very large if it was constructed with
   * `.and(...)` or `.not(...)`.
   */
  toRegExp(): RegExp {
    return RE.toRegExp(this.getStdRegex())
  }

  /**
   * Checks if the regex matches no strings at all.
   * 
   * @example
   * ```typescript
   * RB('a').isEmpty() // false
   * RB('').isEmpty() // false
   * RB('a').and('b').isEmpty() // true
   * RB(/$.^/).isEmpty() // true
   * ```
   *
   * @public
   */
  isEmpty(): boolean {
    return RE.isEmpty(this.getStdRegex())
  }

}

/**
 * The main entry point of this library. It creates a `RegexBuilder` instance from
 * various sources (see `RegexLike`).
 * 
 * @public
 */
export function RB(re: RegexLike) {
  return new RegexBuilder(fromRegexLike(re))
}

export { type RegexBuilder }

