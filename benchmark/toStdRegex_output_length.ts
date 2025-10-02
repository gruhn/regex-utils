import fs from 'fs'
import * as RE from '../src/regex'
import * as AST from '../src/ast'
import { UnsupportedSyntaxError, ParseError } from '../src/index'
import { parseRegExp } from '../src/regex-parser'
import { toStdRegex } from '../src/dfa.js'
import randomRegexDataset from './regex_random_unique_no-nested-star_1000'
import handwrittenRegexDataset from './regex_handwritten'

const fullRegexDataset = [
  ...randomRegexDataset,
  ...handwrittenRegexDataset,
]

const mults: number[] = []

let maxHeapUsed = 0
let maxRSS = 0

function run(inputRegExp: RegExp, index: number) {
  console.log('#' + index, inputRegExp)

  const inputRegex = AST.toExtRegex(parseRegExp(inputRegExp))
  const outputRegex = toStdRegex(inputRegex)
  const outputRegExp = RE.toRegExp(outputRegex)

  const inp = inputRegExp.source.length
  const out = outputRegExp.source.length
  const mult = out/inp
  mults.push(mult)

  const { heapUsed, rss } = process.memoryUsage()
  maxHeapUsed = Math.max(heapUsed, maxHeapUsed)
  maxRSS = Math.max(rss, maxRSS)

  console.log(`
    regex input length  : ${inp}
    regex output length : ${out}
    multiplier          : ${mult}
    heap used           : ${heapUsed/1024**2} MB
    rss                 : ${rss/1024**2} MB
  `) 
}

let parseError = 0
let cacheOverflow = 0
let veryLargeSyntaTree = 0
let stackOverflow = 0
let regexSyntaxError = 0

fullRegexDataset.forEach((regex, i) => {
  try {
    run(regex, i)
  } catch (e) {
    if (e instanceof ParseError || e instanceof UnsupportedSyntaxError) {
      parseError++
    } else if (e instanceof RE.CacheOverflowError) {
      cacheOverflow++
    } else if (e instanceof RE.VeryLargeSyntaxTreeError) {
      veryLargeSyntaTree++
    } else if (e instanceof RangeError) {
      stackOverflow++
    } else if (e instanceof SyntaxError) {
      regexSyntaxError++
    } else {
      throw e
    }
  }
})


const mean = mults.reduce((a,b) => a+b, 0) / mults.length
const median = mults[Math.ceil(mults.length / 2)]
const worst = mults.reduce((a,b) => Math.max(a,b), -Infinity)
const best = mults.reduce((a,b) => Math.min(a,b), Infinity)

const summary = `
failed instances:
- parseError         : ${parseError}
- cacheOverflow      : ${cacheOverflow}
- veryLargeSyntaTree : ${veryLargeSyntaTree}
- stackOverflow      : ${stackOverflow}
- regexSyntaxError   : ${regexSyntaxError}

size multipliers:
- mean   : ${mean}
- median : ${median}
- max    : ${worst}
- min    : ${best}

memory:
- max heap used : ${maxHeapUsed/1024**2} MB
- max rss       : ${maxRSS/1024**2} MB
`

console.log(summary)
fs.writeFileSync('benchmark/toStdRegex_output_length-result.txt', summary)
