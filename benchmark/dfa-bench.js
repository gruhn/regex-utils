import { intersection, enumerate } from '../dist/index.js'
import * as DFA from '../dist/dfa.js'
import * as RE from '../dist/regex.js'
import { parseRegExp } from '../dist/regex-parser.js'
import * as Stream from '../dist/stream.js'

console.log("DFA BENCHMARK")

const startTime = performance.now()

const re1 = parseRegExp(/^.{20}$/)
const re2 = parseRegExp(/[a-z]/)
const re3 = parseRegExp(/[A-Z]/)
const re4 = parseRegExp(/[0-9]/)

const inter = RE.toRegExp(DFA.toStdRegex(RE.intersectAll([
  re1,
  re2,
  re3,
  // re4,
])))


console.debug(inter)
console.log('time: ', performance.now() - startTime)

// for (const word of Stream.take(100, RE.enumerate(inter))) {
//   console.debug(JSON.stringify(word))
// }

// console.debug('done')
// console.debug(RE.toString(inter))
