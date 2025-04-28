
// declare global {
//   interface ErrorConstructor {
//     // Non-standard v8-specific function. Since it is not guaranteed to be 
//     // available, we make it optional.
//     captureStackTrace?: (target: any, func: any) => void
//   }
// }

/**
 * Throws an error if the `condition` in the first argument is `false`.
 * This function is useful to make assumptions explicit. NOT JUST IN TEST CODE.
 *
 * For example consider:
 *
 *     document.body.innerHTML = '<div id="foo"></div>'
 *     const foo : HTMLElement | null = document.getElementById('foo')
 *
 * The type of variable `foo` includes `null` but from the context we know
 * that it can actually never be `null`. We can access attributes of `foo` with
 *
 *     foo?.children
 *
 * but if the assumption is actually broken, we get a silent error.
 * In contrast, with
 *
 *     assert(foo !== null, 'Element cant be found although it was just created')
 *     foo.children // no type error!
 *
 * We make the assumption explicit and force a laud error. Also, after the assertion
 * the type-checker can infer that `foo` is never `null` so we don't get a type
 * error when accessing `foo.children`.
 *
 * Additionally, assertions help static analysis tools like SonarQube reason about
 * the code.
 */
export function assert(condition : boolean, failureMessage? : string): asserts condition {
  if (condition === false) {
    const err = new Error(failureMessage ?? 'assertion failure')
    // Preferably omit the `assert` call itself from the stack trace,
    // so the printed error shows the call site of `assert` instead of the throw site.
    Error.captureStackTrace?.(err, assert)
    throw err
  }
}


/**
 * Raises a type error if the argument is not of type `never`. This is useful to ensure that
 * case analysis is exhaustive. For example consider the type:
 *
 *     type Tshirt = { size: 'S' | 'M' | 'L' }
 *
 * And somewhere we have a case analysis like this:
 *
 *     if (tshift.size === 'S') {
 *       ...
 *     } else if (tshift.size === 'M') {
 *       ...
 *     } else if (tshirt.size === 'L') {
 *       ...
 *     } else {
 *       checkedAllCases(tshirt.size)
 *     }
 *
 * The else-branch is technically unreachable, since all options for "size" have been checked.
 * But if we later add the size "XL", then `assertNever` becomes reachable and raises a type error,
 * which is a reminder to complete the case analysis.
 *
 * This function is pure type trickery. It should be impossible to actually call it and during builds it should
 * be detected as dead code. Only in malicious situations the function body can be executed. For example
 * if code is pushed to production despite type errors. Or if the argument is unsafely converted to never:
 *
 *     checkedAllCases("obviously not never" as never)
 *
 */
export function checkedAllCases(_witness: never): never {
  throw new Error('not all cases checked')
}

export function identity<T>(x: T): T {
  return x
}

/**
 * Yields tuples of elements from the two input arrays. Excess elements are ignored., if one
 * of the arrays is longer
 */
export function* zip<A,B>(arrayA: readonly A[], arrayB: readonly B[]): Generator<[A,B]> {
  for (let i = 0; i < Math.min(arrayA.length, arrayB.length); i++) {
    yield [arrayA[i], arrayB[i]]
  }
}

/**
 * Returns an array of tuples containing all adjacent pairs in the input array.
 */
export function* adjacentPairs<T>(array: readonly T[]): Generator<[T,T]> {
  yield* zip(array.slice(0, -1), array.slice(1))
}


/**
 * Removes duplicates from `array` according to `compare`.
 */
export function uniqWith<T>(array: T[], compare: (l: T, r: T) => number): T[] {
  return array.toSorted(compare).filter((item, index) => {
    const prevItem = array[index-1]
    return prevItem === undefined || compare(prevItem, item) !== 0
  })
}

/**
 * https://stackoverflow.com/a/52171480
 */
export function hashStr(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for(let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1  = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2  = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Associatively combines two hashes to one.
 */
export function hashAssoc(hash1: number, hash2: number): number {
  return ((hash1 % 2**32) + (hash2 % 2**32)) % 2**32
}

