import fc from 'fast-check'
import { intersection } from '../dist/index.js'

const emailRegex = /^[\w\-\.]+@([\w-]+\.)+[\w-]{2,}$/

function runIntersection(sampleCount) {
  return fc.sample(fc.stringMatching(intersection(/^.{3,10}$/, emailRegex)), sampleCount)
}

function runFilter(count) {
  return fc.sample(fc.stringMatching(emailRegex).filter(
    str => 3 <= str.length && str.length <= 10
  ), count)
}


for (const sampleCount of [10,50,100,500,1000,2000/* ,10_000,20_000,50_000,100_000 */]) {
  const filterStart = performance.now()
  runFilter(sampleCount)
  const filterTime = performance.now() - filterStart

  const interStart = performance.now()
  runIntersection(sampleCount)
  const interTime = performance.now() - interStart

  console.debug('\nsample count:', sampleCount)
  console.debug('time (post-hoc filter)    : ', filterTime)
  console.debug('time (regex intersection) : ', interTime)
}
