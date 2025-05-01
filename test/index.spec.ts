import fc from "fast-check"
import { describe, it, expect, test } from "vitest"
import * as Arb from './arbitrary-regex'
import * as RE from '../src/regex'
import { intersection } from '../src/index'

test('...', () => {
  const regex = intersection(
    // /^[\w\-\.]+@([\w-]+\.)+[\w-]{2,}$/,
    // /^\w+\w+\.\w{2,}$/,
    /^a+a+$/,
    // /^.{5,10}$/
  )
  console.debug(regex)
})
