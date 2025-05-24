import fc from 'fast-check'
import * as RE from '../dist/regex.js'
import { parse, toStdRegex } from '../dist/low-level-api.js'
import regexDataset from './regex_random_unique_no-nested-star_1000.js'

let avgMult = 0
let maxMult = -Infinity

const hardInstances = new Set([
  290, // call-stack overflow
  556, // ???
  658, // ???
  689, // call-stack overflow
  724, // ???
  777, // ???
  783, // out of memory
  787, // ??? 
  791, // ???
  831, // ???
  840, // stack overflow
  860, // ???
  871, // ???
  883, // ???
  884, // ???
  894, // ???
  900, // stack overflow
  908, // ???
  940, // ???
  948, // ???
  949, // ???
  954, // ???
  958, // ???
  961, // stack overflow
  964, // ???
  981, // ???
  991, // ???
  994, // ???
  996, // ???
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
  } catch (err) {
    console.log('too many captures')
  }
}

const timeStart = performance.now()

// do short (likely easier) instances first and see how far we get:
const regexDatasetSorted = regexDataset.sort(
  (a,b) => a.source.length - b.source.length
)

run(regexDatasetSorted[689], 689)

// regexDatasetSorted
//   .filter(inst => !hardInstances.includes(inst))
//   .forEach(run)

console.log('time:', performance.now() - timeStart)
