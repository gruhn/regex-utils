import fs from 'fs'
import * as RE from '../dist/low-level-api.js'

const input = fs.readFileSync('./benchmark/aoc2023-day12_input.txt', 'utf-8')
  .trim()
  .split('\n')
  .map(line => line.split(' '))

/**
 * Maps pattern like "#?...##?#" to regex like `#(.|#)...##(.|#)#`
 */
function leftToRegex(pattern) {
  const inner = [...pattern].map(char => {
    switch (char) {
      case '.': return RE.singleChar('.')
      case '#': return RE.singleChar('#')
      case '?': return RE.or([RE.singleChar('.'), RE.singleChar('#')])
    }
    throw 'unknown symbol: ' + char
  })
  return RE.seq(inner)
}

function interleave(array, sep) {
  if (array.length <= 1) {
    return array
  } else {
    const [ head, ...tail ] = array
    return [head, sep, ...interleave(tail, sep) ]
  }
}

/**
 * Maps pattern like "2,4,3" to regex like `.*##.+####.+###.*`
 */
function rightToRegex(pattern) { 
  const regexStartEnd = RE.repeat(RE.singleChar('.')) // .*
  const regexBetween = RE.repeat(RE.singleChar('.'), { min: 1 }) // .+

  const inner = pattern.split(',')
    .map(digit => parseInt(digit))
    .map(count => RE.repeat(RE.singleChar('#'), count))

  return RE.seq([
    regexStartEnd,
    RE.seq(interleave(inner, regexBetween)),
    regexStartEnd,
  ])
}

function part1() {
  const startTime = performance.now()
  let totalCount = 0n

  input.forEach(([left, right], i) => {
    const leftRegex = leftToRegex(left)
    const rightRegex = rightToRegex(right)

    // Compute intersection of the two regex: 
    const intersection = RE.toStdRegex(RE.and([leftRegex, rightRegex]))
    // And count the number of matching strings using `size`:
    const count = RE.size(intersection)

    console.log(i, ':', count)
    totalCount += count
  })

  const time = performance.now() - startTime
  return { totalCount, time }
}

function part2() {
  const startTime = performance.now()
  let totalCount = 0n

  input.forEach(([left, right], i) => {
    const leftRegex = leftToRegex(Array(5).fill(left).join('?'))
    const rightRegex = rightToRegex(Array(5).fill(right).join(','))

    // Compute intersection of the two regex: 
    const intersection = RE.toStdRegex(RE.and([leftRegex, rightRegex]))
    // And count the number of matching strings using `size`:
    const count = RE.size(intersection)

    console.log(i, ':', count)
    totalCount += count
  })

  const time = performance.now() - startTime
  return { time, totalCount }
}

const sol1 = part1() // best time:   992ms
const sol2 = part2() // best time: 20095ms

console.log('Part 1:', sol1.totalCount, `(time: ${Math.ceil(sol1.time)}ms)`)
console.log('Part 2:', sol2.totalCount, `(time: ${Math.ceil(sol2.time)}ms)`)
