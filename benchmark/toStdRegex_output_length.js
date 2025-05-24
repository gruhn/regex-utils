import fc from 'fast-check'
import * as RE from '../dist/regex.js'
import { parse, toStdRegex } from '../dist/low-level-api.js'
import regexDataset from './regex_random_unique_no-nested-star_1000.js'

let avgMult = 0
let maxMult = -Infinity

const hardInstances = new Set([
  883, // ???
  964, // ???
])

function run(inputRegExp, index) {
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

    console.log('#' + index, outputRegExp)
  } catch (err) {
    console.log('too many captures')
  }
}

const timeStart = performance.now()

// do short (likely easier) instances first and see how far we get:
const regexDatasetSorted = regexDataset.sort(
  (a,b) => a.source.length - b.source.length
)

run(regexDatasetSorted[689], 0)

// regexDatasetSorted
//   .filter((inst, i) => !hardInstances.has(i))
//   .forEach(run)

console.log('time:', performance.now() - timeStart)
