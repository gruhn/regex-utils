import fc from "fast-check"
import { describe, it, expect, test } from "vitest"
import * as Arb from './arbitrary-regex'
import * as CharSet from '../src/char-set'
import { intersection } from '../src/index'

test('...', () => {
  const regex = intersection(
    /^[\w\-\.]+@([\w-]+\.)+[\w-]{2,}$/,
    /^.{5,10}$/
  )
  console.debug(regex)
})

