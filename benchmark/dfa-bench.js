import { intersection, enumerate } from '../dist/index.js'

console.log("DFA BENCHMARK")

// ^(a(a|(a)*)(a)*faa(dd)*|((f|(b)*))*)b$
// /^(((([a-b]|(a)*))*(d|(af|a)))*|d)(c|(d)*)$/

const startTime = performance.now()

// const re = /^(((([a-b]|(a)*))*(d|(af|a)))*|d)(c|(d)*)$/
// const re = /^(((([a-b]|(a)))(d|(af|a)))*|d)(c|(d)*)$/
// const input = parseRegExp(re)
// const output = toStdRegex(input)

const regex = intersection(
  /^[\w\-\.]+@([\w-]+\.)+[\w-]{2,}$/,
  /^.{10}$/
)
console.debug(regex)

console.log('time: ', performance.now() - startTime)
