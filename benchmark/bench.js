import fs from 'fs'
import { parseRegexString } from '../dist/regex-parser.js'

console.log("PARSER BENCHMARK")

function readBenchFile() {
  return fs.readFileSync('./benchmark/bench.txt', 'utf-8')
    .trim()
    .split('\n')
    .flatMap(line => {
      const [regex1, regex2] = line.split(/\s{3}/)
      return [regex1, regex2]
    })
}

// export function* chunks<T>(n: number, array: T[]): Generator<T[]> {
//   while (array.length > n) {
//     yield array.slice(0, n)
//     array = array.slice(n)
//   }
// }

let worstTime = -Infinity

console.log("PARSER BENCHMARK")

function bench(str) {
  const startTime = performance.now()
  parseRegexString(str)
  const duration = performance.now() - startTime

  if (duration > worstTime) {
    worstTime = duration
    console.log('new worst time:', duration)
    console.log('regex:', str)
  }
}

let count = 0
const startTime = performance.now()
for (const regex of readBenchFile()) {
  if (count > 500) break
  bench(regex)
  // parseRegexString(regex)
  // console.log(new RegExp(regex))
  count++
}
console.log('time: ', performance.now() - startTime)
