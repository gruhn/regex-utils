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
