import { describe, expect, it } from "vitest"
import * as P from '../src/parser'

describe('string', () => {

  it('parses a literal string', () => {
    const { value, restInput } = P.string('abc').run('abc')
    expect(value).toBe('abc')
    expect(restInput).toBe('')
  })
  
})
