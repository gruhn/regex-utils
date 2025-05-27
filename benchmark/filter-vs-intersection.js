import fc from 'fast-check'
import { intersection } from '../dist/index.js'

const emailRegex = /^[\w\-\.]+@([\w-]+\.)+[\w-]{2,}$/

function runIntersection(sampleCount) {
  const startTime = performance.now()
  fc.sample(fc.stringMatching(intersection(/^.{3,10}$/, emailRegex)), sampleCount)
  return performance.now() - startTime
}

function runFilter(count) {
  const startTime = performance.now()
  fc.sample(fc.stringMatching(emailRegex).filter(
    str => 3 <= str.length && str.length <= 10
  ), count)
  return performance.now() - startTime
}

for (const sampleCount of [10,50,100,500,1000,2000]) {
  const filterTime = runFilter(sampleCount)
  const interTime = runIntersection(sampleCount)

  console.debug('\nsample count:', sampleCount)
  console.debug('time (post-hoc filter)    : ', filterTime)
  console.debug('time (regex intersection) : ', interTime)
}

for (const sampleCount of [10_000,20_000,50_000,100_000,1_000_000]) {
  const interTime = runIntersection(sampleCount)

  console.debug('\nsample count:', sampleCount)
  console.debug('time (regex intersection) : ', interTime)
}
