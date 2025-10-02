import fc from 'fast-check'
import { RB } from '../src/index'

const emailRegex = /^[\w\-\.]+@([\w-]+\.)+[\w-]{2,}$/

function runIntersection(sampleCount: number) {
  const startTime = performance.now()
  const intersection = RB(emailRegex).and(/^.{3,10}$/).toRegExp()
  fc.sample(fc.stringMatching(intersection), sampleCount)
  return performance.now() - startTime
}

function runFilter(count: number) {
  const startTime = performance.now()
  fc.sample(fc.stringMatching(emailRegex).filter(
    str => 3 <= str.length && str.length <= 10
  ), count)
  return performance.now() - startTime
}

function runOwnSample(sampleCount: number) {
  const startTime = performance.now()
  RB(emailRegex).and(/^.{3,10}$/).sample().take(sampleCount).toArray()
  return performance.now() - startTime
}

for (const sampleCount of [10,50,100,500,1000,2000]) {
  const filterTime = runFilter(sampleCount)
  const interTime = runIntersection(sampleCount)
  const ownSampleTime = runOwnSample(sampleCount)

  console.debug('\nsample count:', sampleCount)
  console.debug('time (post-hoc filter)    : ', filterTime)
  console.debug('time (regex intersection) : ', interTime)
  console.debug('time (own sample)         : ', ownSampleTime)
}

for (const sampleCount of [10_000,20_000,50_000,100_000,1_000_000, 2_000_000, 5_000_000]) {
  const interTime = runIntersection(sampleCount)
  const ownSampleTime = runOwnSample(sampleCount)

  console.debug('\nsample count:', sampleCount)
  console.debug('time (regex intersection) : ', interTime)
  console.debug('time (own sample)         : ', ownSampleTime)
}
