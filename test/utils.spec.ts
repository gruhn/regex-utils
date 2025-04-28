import fc from "fast-check"
import { describe, expect, it, test } from "vitest"
import { hashAssoc, hashStr } from "../src/utils"


describe('hashAssoc', () => {

  it('is associative', () => {
    fc.assert(
      fc.property(
        fc.string().map(hashStr),
        fc.string().map(hashStr),
        fc.string().map(hashStr),
        (hash1, hash2, hash3) => {
          const result1 = hashAssoc(hashAssoc(hash1, hash2), hash3)
          const result2 = hashAssoc(hash1, hashAssoc(hash2, hash3))
          expect(result1).toBe(result2)
        }
      ),
    ) 
  })
 
  it('is unlikely to produce collisions', () => {
    fc.assert(
      fc.property(
        fc.string().map(hashStr),
        fc.string().map(hashStr),
        fc.string().map(hashStr),
        (hash1, hash2, hash3) => {
          fc.pre(hash1 !== hash3)
          const result1 = hashAssoc(hash1, hash2)
          const result2 = hashAssoc(hash2, hash3)
          expect(result1).not.toBe(result2)
        }
      ),
    ) 
  })

})
 
