import fs from 'fs'
import { parseRegexString } from '../dist/regex-parser.js'
import { RB } from '../dist/index.js'

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

let hasError = 0
let noError = 0
let totalParseTime = 0

for (const { regex, flags } of readDataset()) {
  try {
    // parseRegexString(regex)
    const regexp = new RegExp(regex, flags)
    console.log('====', regexp, '====')

    const timeStart = performance.now()
    const parsed = RB(regexp)
    const timeEnd = performance.now()

    console.log(`time: ${Math.round(timeEnd - timeStart)}ms`)
    totalParseTime += timeEnd - timeStart
    noError++
  } catch (e) {
    // console.error(new RegExp(regex, flags))
    hasError++
  }
}

console.log('error ratio:', hasError, '/', hasError + noError)
console.log('total parse time:', Math.round(totalParseTime), 'ms')

