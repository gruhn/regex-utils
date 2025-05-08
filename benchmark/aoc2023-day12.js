import fs from 'fs'
import * as RE from '../dist/regex.js'
import * as DFA from '../dist/dfa.js'
// import { intersection, size } from '../dist/index.js'

const input = fs.readFileSync('./benchmark/aoc2023-day12_input.txt', 'utf-8')
  .trim()
  .split('\n')
  .map(line => line.split(' '))

// e.g. "???.###" --> /^(a|b)(a|b)(a|b)abbb$/
function leftToRegex(pattern) {
  // const inner = [...pattern].map(char => {
  //   switch (char) {
  //     case '.': return 'a'
  //     case '#': return 'b'
  //     case '?': return '(a|b)'   
  //   }
  //   throw 'unknown symbol: ' + char
  // })
  // return new RegExp('^' + inner.join('') + '$')

  const inner = [...pattern].map(char => {
    switch (char) {
      case '.': return RE.singleChar('a')
      case '#': return RE.singleChar('b')
      case '?': return RE.union(RE.singleChar('a'), RE.singleChar('b'))
    }
    throw 'unknown symbol: ' + char
  })
  return RE.concatAll(inner)
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
  // const inner = pattern.split(',').map(count => `b{${count}}`)
  // return new RegExp('^a*' + inner.join('a+') + 'a*$')
  
  const inner = pattern.split(',')
    .map(digit => parseInt(digit))
    .map(count => RE.replicate(count, count, RE.singleChar('b')))

  return RE.concatAll([
    RE.star(RE.singleChar('a')),
    ...interleave(inner, RE.plus(RE.singleChar('a'))),
    RE.star(RE.singleChar('a')),
  ])
}

function part1() {
  const startTime = performance.now()
  let totalCount = 0n

  input.forEach(([left, right], i) => {
    const leftRegex = leftToRegex(left)
    const rightRegex = rightToRegex(right)

    const count = RE.size(DFA.toStdRegex(
      RE.intersection(leftRegex, rightRegex)
    ), new Map())
    // const count = size(intersection(leftRegex, rightRegex))

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

    const count = RE.size(DFA.toStdRegex(
      RE.intersection(leftRegex, rightRegex)
    ), new Map()) 
    // const count = size(intersection(leftRegex, rightRegex))

    console.log(i, ':', count)
    totalCount += count
  })

  const time = performance.now() - startTime
  console.log('Part 2:', totalCount, `(time: ${Math.ceil(time)}ms)`)
}

part1() // best time:  2_039ms
part2() // best time: 54_954ms
