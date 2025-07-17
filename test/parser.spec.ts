import { describe, it } from "node:test"
import assert from "node:assert"
import * as P from '../src/parser'

describe('string', () => {

  it('parses a literal string', () => {
    const { value, restInput } = P.string('abc').run('abc')
    assert.strictEqual(value, 'abc')
    assert.strictEqual(restInput, '')
  })
  
})
