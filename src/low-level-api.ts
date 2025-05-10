/**
 * The high-level API operates directly on native JavaScript `RegExp` instances.
 * The low-level API provides the same functions but operates on the custom data
 * types `StdRegex` (standard regex) and `ExtRegex` (extended regex).
 * Most of the additional functions are just a
 * [DSL](https://en.wikipedia.org/wiki/Domain-specific_language)
 * for constructing instances of these types.
 * 
 * `ExtRegex` is a super-type of `StdRegex` and extends it with complement and 
 * intersection operators which have no direct representation in standard regular 
 * expressions. Some operations like `size` and `enumerate` only work on `StdRegex`.
 * `ExtRegex` can always be "compiled down" to `StdRegex` using `toStdRegex`.
 * But note that most computational cost is concentrated in this transformation.
 *
 * @module Low-Level API
 */

export {
  parseRegExp as parse
} from './regex-parser'

export {
  // types:
  type StdRegex,
  type ExtRegex,
  type RepeatBounds,
  // constructors:
  and,
  or,
  seq,
  complement as not,
  optional,
  repeat,
  anySingleChar,
  singleChar,
  string,
  // operations:
  toRegExp,
  derivative,
  size,
  enumerate,
} from './regex'

export { toStdRegex } from './dfa'
