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

for (const { regex, flags } of readDataset()) {
  try {
    const time = performance.now()
    // parseRegexString(regex)
    const regexp = RB(new RegExp(regex, flags))
    console.log('====', regexp, '====')
    for (const word of RB(regexp).enumerate().take(10)) {
      console.log(JSON.stringify(word))
    }
    console.log(`time: ${Math.round(performance.now() - time)}ms`)
    noError++
  } catch (e) {
    // console.error(new RegExp(regex, flags))
    hasError++
  }
}

console.debug(hasError, '/', hasError + noError)
