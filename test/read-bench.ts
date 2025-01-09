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

