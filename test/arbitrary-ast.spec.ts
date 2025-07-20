import fc from "fast-check"
import { it, describe } from "node:test"
import assert from "node:assert"
import * as Arbitrary from './arbitrary-ast'
import * as AST from '../src/ast'

describe('regexpAST', () => {
  it('only generates valid regexp', () => {
    fc.assert(
      fc.property(
        Arbitrary.regexpAST(),
        (ast) => {
          const regexpStr = AST.toString(ast, { useNonCapturingGroups: true })
          assert.doesNotThrow(() => new RegExp(regexpStr))
        }
      ),
    )
  })
})
