import * as RE from "../dist/regex.js"
import { parseRegExp } from "../dist/regex-parser.js"
import { toStdRegex } from "../dist/dfa.js"

console.log("DFA BENCHMARK")

// ^(a(a|(a)*)(a)*faa(dd)*|((f|(b)*))*)b$
// /^(((([a-b]|(a)*))*(d|(af|a)))*|d)(c|(d)*)$/


const startTime = performance.now()
// const re = /^(((([a-b]|(a)*))*(d|(af|a)))*|d)(c|(d)*)$/
const re = /^(((([a-b]|(a)))(d|(af|a)))*|d)(c|(d)*)$/
const input = parseRegExp(re)
const output = toStdRegex(input)
console.log('time: ', performance.now() - startTime)
