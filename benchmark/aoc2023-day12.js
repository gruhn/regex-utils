import fs from 'fs'
import { RB } from '../dist/index.js'
import { assert } from '../dist/utils.js'

const input = fs.readFileSync('./benchmark/aoc2023-day12_input.txt', 'utf-8')
  .trim()
  .split('\n')
  .map(line => line.split(' '))

/**
 * Maps pattern like "#?...##?#" to regex like /^#(o|#)ooo##(o|#)#$/
 */
function leftToRegex(pattern) {
  const inner = [...pattern].map(char => {
    switch (char) {
      case '.': return RB('o')
      case '#': return RB('#')
      case '?': return RB('o').or('#')
    }
    throw 'unknown symbol: ' + char
  })
  return inner.reduce((acc, re) => acc.concat(re))
}

/**
 * Maps pattern like "2,4,3" to regex like /^o*##o+####o+###o*$/
 */
function rightToRegex(pattern) { 
  const [first, ...rest] = pattern.split(',')
    .map(digit => parseInt(digit))
    .map(count => RB('#').repeat(count))

  const start = RB('o').repeat() // o*
  const end = RB('o').repeat() // o*
  const separator = RB('o').repeat({ min: 1 }) // o+

  let result = start.concat(first)
  for (const item of rest) {
    result = result.concat(separator).concat(item)
  }
  result = result.concat(end)

  return result
}

function solve(patternPairs) {
  const startTime = performance.now()
  let totalCount = 0n

  patternPairs.forEach(([left, right], i) => {
    const leftRegex = leftToRegex(left)
    const rightRegex = rightToRegex(right)

    // Compute intersection of the two regex and
    // count the number of matching strings using `size`:
    const count = RB(leftRegex).and(rightRegex).size()

    console.log(i, ':', count)
    totalCount += count
  })

  const time = performance.now() - startTime
  return { totalCount, time }
}

const part1 = solve(input) 
const part2 = solve(input.map(([left, right]) => [
  Array(5).fill(left).join('?'),
  Array(5).fill(right).join(',')
]))

// best time: 992ms
console.log('Part 1:', part1.totalCount, `(time: ${Math.ceil(part1.time)}ms)`)

// best time: 11950ms
console.log('Part 2:', part2.totalCount, `(time: ${Math.ceil(part2.time)}ms)`)

assert(part1.totalCount === 7191n)
assert(part2.totalCount === 6512849198636n)
