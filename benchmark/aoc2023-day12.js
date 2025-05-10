import fs from 'fs'
import * as RE from '../dist/low-level-api.js'

const input = fs.readFileSync('./benchmark/aoc2023-day12_input.txt', 'utf-8')
  .trim()
  .split('\n')
  .map(line => line.split(' '))

// e.g. "???.###" --> /^(.|#)(.|#)(.|#).###$/
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

// e.g. "1,1,3" --> /^a*b{1}a+b{1}a+b{3}a*$/
function rightToRegex(pattern) { 
  const inner = pattern.split(',')
    .map(digit => parseInt(digit))
    .map(count => RE.repeat(RE.singleChar('#'), count))

  return RE.seq([
    RE.repeat(RE.singleChar('.')),
    ...interleave(inner, RE.repeat(RE.singleChar('.'), { min: 1 })),
    RE.repeat(RE.singleChar('.')),
  ])
}

function part1() {
  const startTime = performance.now()
  let totalCount = 0n

  input.forEach(([left, right], i) => {
    const leftRegex = leftToRegex(left)
    const rightRegex = rightToRegex(right)

    const count = RE.size(RE.toStdRegex(
      RE.and([leftRegex, rightRegex])
    ))

    console.log(i, ':', count)
    totalCount += count
  })

  const time = performance.now() - startTime
  console.log('Part 1:', totalCount, `(time: ${Math.ceil(time)}ms)`)
}

function part2() {
  const startTime = performance.now()
  let totalCount = 0n

  input.forEach(([left, right], i) => {
    const leftRegex = leftToRegex(Array(5).fill(left).join('?'))
    const rightRegex = rightToRegex(Array(5).fill(right).join(','))

    const count = RE.size(RE.toStdRegex(
      RE.and([leftRegex, rightRegex])
    ))

    console.log(i, ':', count)
    totalCount += count
  })

  const time = performance.now() - startTime
  console.log('Part 2:', totalCount, `(time: ${Math.ceil(time)}ms)`)
}

part1() // best time:   992ms
part2() // best time: 28258ms
