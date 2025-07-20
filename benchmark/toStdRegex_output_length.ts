import fc from 'fast-check'
import * as RE from '../src/regex'
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

function run(inputRegExp: RegExp, index: number) {
  console.log('#' + index, inputRegExp)
  const startTime = performance.now()

  const inputRegex = RE.fromRegExpAST(parseRegExp(inputRegExp))
  const outputRegex = toStdRegex(inputRegex)
  const outputRegExp = RE.toRegExp(outputRegex)

  const inp = inputRegExp.source.length
  const out = outputRegExp.source.length
  const mult = out/inp
  mults.push(mult)

  console.log(`
    regex input length  : ${inp}
    regex output length : ${out}
    multiplier          : ${mult}
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

console.debug('failed instances: ', {
  parseError,
  cacheOverflow,
  veryLargeSyntaTree,
  stackOverflow,
  regexSyntaxError
})

const mean = mults.reduce((a,b) => a+b, 0) / mults.length
const median = mults[Math.ceil(mults.length / 2)]
const worst = mults.reduce((a,b) => Math.max(a,b), -Infinity)

console.log(`
multipliers:
  mean   : ${mean}
  median : ${median}
  max    : ${worst}
`) 

