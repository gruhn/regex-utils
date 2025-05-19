import fc from 'fast-check'
import { expect, test } from 'vitest'
import * as Hash from '../src/hash'

test('comineAssoc is associative', () => {
  fc.assert(
    fc.property(
      fc.string().map(Hash.fromString),
      fc.string().map(Hash.fromString),
      fc.string().map(Hash.fromString),
      fc.nat().map(BigInt),
      (hashA, hashB, hashC, base) => {
        const leftReduced = Hash.combineAssoc(
          base,
          Hash.combineAssoc(base, hashA, hashB),
          hashC,
        )

        const rightReduced = Hash.combineAssoc(
          base,
          hashA,
          Hash.combineAssoc(base, hashB, hashC),
        )

        expect(leftReduced.length).toBe(rightReduced.length)
        expect(leftReduced.value).toBe(rightReduced.value)
      }
    ),
  )
})

test('comineAssoc is non-commutative', () => {
  fc.assert(
    fc.property(
      fc.string().map(Hash.fromString),
      fc.string().map(Hash.fromString),
      fc.integer({ min: 2 }).map(BigInt),
      (hashA, hashB, base) => {
        fc.pre(hashA.value !== hashB.value)

        const hashAB = Hash.combineAssoc(base, hashA, hashB)
        const hashBA = Hash.combineAssoc(base, hashB, hashA)

        expect(hashAB.length).toBe(hashBA.length)
        expect(hashAB.value).not.toBe(hashBA.value)
      }
    )
  )
})

test('comineAssocComm is commutative', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 2 }).map(BigInt),
      fc.string().map(Hash.fromString),
      fc.string().map(Hash.fromString),
      (base, hashA, hashB) => {
        const hashAB = Hash.combineAssocComm(base, hashA, hashB)
        const hashBA = Hash.combineAssocComm(base, hashB, hashA)

        expect(hashAB.length).toBe(hashBA.length)
        expect(hashAB.value).toBe(hashBA.value)
      }
    )
  )
})

