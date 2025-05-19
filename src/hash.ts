import { NonEmptyArray } from "./non-empty-array"

export type WithHash<T> = T & { hash: Hash }

export type Hash = {
  value: bigint
  length: bigint
}

// const PRIME_MODULUS = 2n**256n - 189n
const PRIME_MODULUS = 9007199254740881n // === Number.MAX_SAFE_INTEGER - 110

/**
 * https://stackoverflow.com/a/52171480
 */
export function fromString(str: string, seed = 0): Hash { 
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed
  for (let i=0; i < str.length; i++) {
    const ch = str[i].charCodeAt(0)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1  = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2  = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)

  const value = BigInt(4294967296 * (2097151 & h2) + (h1 >>> 0))
  return { value, length: 1n }
}

export function fromNumber(num: number): Hash {
  return { value: BigInt(num), length: 1n }
}

/**
 * Combines two hashes to one. The operation is associative but non-commutative. 
 */
export function combineAssoc(base: bigint, hashA: Hash, hashB: Hash): Hash {
  return {
    value: ((hashA.value * (base**hashB.length % PRIME_MODULUS) % PRIME_MODULUS) + hashB.value) % PRIME_MODULUS,
    length: hashA.length + hashB.length
  }
}

export function combineAssocMany(base: bigint, hashes: NonEmptyArray<Hash>): Hash {
  return hashes.reduce((hashA, hashB) => combineAssoc(base, hashA, hashB))
}

/**
 * Combines two hashes to one. The operation is associative and commutative. 
 */
export function combineAssocComm(base: bigint, hashA: Hash, hashB: Hash): Hash {
  if (hashA.value <= hashB.value)
    return combineAssoc(base, hashA, hashB)
  else
    return combineAssoc(base, hashB, hashA)
}
