import fc from 'fast-check'
import * as RE from '../dist/regex.js'
import { parse, toStdRegex } from '../dist/low-level-api.js'
import regexDataset from './regex_random_unique_no-nested-star_1000.js'

let avgMult = 0
let maxMult = -Infinity

const hardInstances = new Set([
  290, // call-stack overflow
  556, // takes very long
  658, // takes very long
  689, // call-stack overflow
  724, // takes very long
])

function run(inputRegExp, index) {
  // skip some hard early instances:
  if (hardInstances.has(index)) return
  // only consider first 800 instances for now:
  if (index > 750) return

  console.log('#' + index, inputRegExp)

  const outputRegex = toStdRegex(parse(inputRegExp))
  try {
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
  } catch (err) {
    console.log('too many captures')
  }
}

const timeStart = performance.now()

regexDataset
  // do short (likely easier) instances first and see how far we get:
  .sort((a,b) => a.source.length - b.source.length)
  .forEach(run)

console.log('time:', performance.now() - timeStart)
