import fs from 'fs'
import { parseRegExp } from '../dist/regex-parser.js'

export function* readDataset() {
  const jsonStr = fs.readFileSync('./benchmark/regex-dataset.json', 'utf-8')

  for (const item of JSON.parse(jsonStr)) {
    if (item.flavor === "javascript" && item.flags === "") {
      try {
        new RegExp(item.regex, item.flags)
        yield item
      } catch (e) {
        console.warn('regex dataset: skipping invalid regex')
      }
    }
  }
}

const dataset = [...readDataset()]

let parseErrorCount = 0

for (const { regex, flags } of dataset) {
  try {
    // parseRegexString(regex)
    const regexp = new RegExp(regex, flags)
    console.log('====', regexp, '====')

    performance.mark('parse-start')
    parseRegExp(regexp)
    performance.mark('parse-end')
    performance.measure('parse-duration', 'parse-start', 'parse-end')

  } catch (e) {
    console.error(new RegExp(regex, flags))
    parseErrorCount++
  }
}

const totalParseTime = performance.getEntriesByName('parse-duration')
  .map(entry => entry.duration)
  .reduce((acc,d) => acc + d, 0)

const maxParseTime = performance.getEntriesByName('parse-duration')
  .map(entry => entry.duration)
  .reduce((acc,d) => Math.max(acc, d), -Infinity)

const summary = `
  error ratio      : ${parseErrorCount} / ${dataset.length}
  total parse time : ${Math.round(totalParseTime)}ms
  avg parse time   : ${Math.round(totalParseTime) / (dataset.length - parseErrorCount)}ms
  max parse time   : ${Math.round(maxParseTime)}ms
`

console.log(summary)
fs.writeFileSync('benchmark/parser-bench-result.txt', summary)

