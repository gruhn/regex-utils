import { intersection, enumerate } from '../dist/index.js'
import * as DFA from '../dist/dfa.js'
import * as RE from '../dist/regex.js'
import { parseRegExp } from '../dist/regex-parser.js'

console.log("DFA BENCHMARK")

// ^(a(a|(a)*)(a)*faa(dd)*|((f|(b)*))*)b$
// /^(((([a-b]|(a)*))*(d|(af|a)))*|d)(c|(d)*)$/

const startTime = performance.now()

// const re = /^(((([a-b]|(a)*))*(d|(af|a)))*|d)(c|(d)*)$/
// const re = /^(((([a-b]|(a)))(d|(af|a)))*|d)(c|(d)*)$/
// const input = parseRegExp(re)
// const output = toStdRegex(input)

// const regex = intersection(
//   /^[\w\-\.]+@([\w-]+\.)+[\w-]{2,}$/,
//   /^.{10}$/
// )

const regex = intersection(
  /.{12,}/, // 12 letters or more
  /[0-9]/,  // at least one number
  // /[A-Z]/,  // at least one upper case letter   
  // /[a-z]/,  // at least one lower case letter
)

// const test = parseRegExp(/^(((((((Σ)*|((Σ)*|((Σ)*|((.)*(Σ)*|(Σ)*)))))))))$/)
// console.debug(JSON.stringify(test, null, 2))
console.debug(regex)

// const regex = parseRegExp(/[a-z]/)
// DFA.toStdRegex(regex)

console.log('time: ', performance.now() - startTime)
