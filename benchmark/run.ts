import * as fs from 'fs'
import { parseRegexString } from '../src/regex-parser'

export function readBenchFile(): [string, string][] {
  return fs.readFileSync('./benchmark/bench.txt', 'utf-8')
    .trim()
    .split('\n')
    .map((line: string) => {
      const [regex1, regex2] = line.split(/\s{3}/)
      return [regex1, regex2]
    })
}

export function* chunks<T>(n: number, array: T[]): Generator<T[]> {
  while (array.length > n) {
    yield array.slice(0, n)
    array = array.slice(n)
  }
}

let worstTime = -Infinity

console.log("PARSER BENCHMARK")

function bench(str: string) {
  const startTime = performance.now()
  parseRegexString(str)
  const duration = performance.now() - startTime

  if (duration > worstTime) {
    worstTime = duration
    console.log('new worst time:', duration)
    console.log('regex:', str)
  }
}

for (const [regex1, regex2] of readBenchFile()) {
  bench(regex1)
  bench(regex2)
}
