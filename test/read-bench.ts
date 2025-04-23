import * as fs from 'fs'

export function readBenchFile(): [RegExp, RegExp][] {
  return fs.readFileSync('./bench.txt', 'utf-8')
    .trim()
    .split('\n')
    .map((line: string) => {
      const [regex1, regex2] = line.split(/\s{3}/)
      return [new RegExp(regex1), new RegExp(regex2)]
    })
}

export function* chunks<T>(n: number, array: T[]): Generator<T[]> {
  while (array.length > n) {
    yield array.slice(0, n)
    array = array.slice(n)
  }
}
