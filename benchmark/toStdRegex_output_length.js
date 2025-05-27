import fc from 'fast-check'
import * as RE from '../dist/regex.js'
import { ParseError } from '../dist/parser.js'
import { UnsupportedSyntaxError } from '../dist/regex-parser.js'
import { parse, toStdRegex } from '../dist/low-level-api.js'
import { regexToDFA } from '../dist/dfa.js'
import randomRegexDataset from './regex_random_unique_no-nested-star_1000.js'
import handwrittenRegexDataset from './regex_handwritten.js'

const fullRegexDataset = [
  ...randomRegexDataset,
  ...handwrittenRegexDataset,
] 


let avgMult = 0
let maxMult = -Infinity

function run(inputRegExp, index) {
  console.log('#' + index, inputRegExp)
  const startTime = performance.now()

  const inputRegex = parse(inputRegExp)
  const outputRegex = toStdRegex(inputRegex)
  const outputRegExp = RE.toRegExp(outputRegex)

  const inp = inputRegExp.source.length
  const out = outputRegExp.source.length
  const mult = out/inp

  avgMult = (avgMult*index + mult)/(index+1)
  if (mult > maxMult) {
    maxMult = mult
  }

  console.log(`
    regex input length  : ${inp}
    regex ouptut length : ${out}
    multiplier          : ${mult}
    avg. multiplier     : ${avgMult}
    worst multiplier    : ${maxMult}
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
