import fs from 'fs'
import { parseRegexString } from '../dist/regex-parser.js'

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

for (const { regex } of readDataset()) {
  try {
    parseRegexString(regex)
    noError++
  } catch (e) {
    hasError++
  }
}

console.debug(hasError, '/', noError)
