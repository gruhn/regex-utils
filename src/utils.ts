
declare global {
  interface ErrorConstructor {
    // Non-standard v8-specific function. Since it is not guaranteed to be 
    // available, we make it optional.
    captureStackTrace?: (target: any, func: any) => void
  }
}

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
  throw new Error('This function should never be called')
}

/**
 * TODO
 */
export function* diagonalize<A,B,C>(pair: (a: A, b: B) => C, itemsA: Iterable<A>, itemsB: Iterable<B>): Iterable<C> {
  for (const stripe of diagonalStripes(pair, itemsA, itemsB)) {
    yield* stripe
  }
}
export function* diagonalStripes<A,B,C>(pair: (a: A, b: B) => C, itemsA: Iterable<A>, itemsB: Iterable<B>): Iterable<Iterable<C>> {
  const resultA = uncons(itemsA)
  const resultB = uncons(itemsB)

  if (resultA === undefined || resultB === undefined) {
    return
  }

  const [headA, tailA] = resultA
  const [headB, tailB] = resultB

  yield [pair(headA, headB)]

  const firstRow = map(b => pair(headA, b), tailB)
  const restRows = diagonalStripes(pair, tailA, cons(headB, tailB))
  yield* zipWith(cons, firstRow, restRows)
}
/**
 * Interleaves the elements of two iterables. If one iterable is longer than the other, the
 * remaining elements are appended to the end of the result.
 */
export function* interleave<A>(itemsA: Iterable<A>, itemsB: Iterable<A>): Iterable<A> {
  const itA = itemsA[Symbol.iterator]()
  const itB = itemsB[Symbol.iterator]()
  while (true) {
    const resultA = itA.next()
    const resultB = itB.next()

    if (!resultA.done) {
      yield resultA.value
    }

    if (!resultB.done) {
      yield resultB.value
    }
  }
}

/**
 * Takes two iterables and combines them element-wise using the given function. The result is an iterable
 * that yields the combined elements. If one iterable is longer than the other, the remaining elements are
 * ignored.
 */
export function* zipWith<A,B,C>(combine: (a: A, b: B) => C, itemsA: Iterable<A>, itemsB: Iterable<B>): Iterable<C> {
  const itA = itemsA[Symbol.iterator]()
  const itB = itemsB[Symbol.iterator]()
  while (true) {
    const resultA = itA.next()
    const resultB = itB.next()

    if (resultA.done || resultB.done) {
      return
    } else {
      yield combine(resultA.value, resultB.value)
    }
  }
}

function* cons<T>(head: T, tail: Iterable<T>): Iterable<T> {
  yield head
  yield* tail
}

function uncons<T>(items: Iterable<T>): [T, Iterable<T>] | undefined {
  const it = items[Symbol.iterator]()
  const {value, done} = it.next()
  if (done) {
    return undefined
  } else {
    return [value, { [Symbol.iterator]() { return it }}]
  }
}

function* map<A,B>(f: (a: A) => B, items: Iterable<A>): Iterable<B> {
  for (const item of items) {
    yield f(item)
  }
}

export function identity<T>(x: T): T {
  return x
}

export function todo(message: string = ""): never {
  const err = new Error(`TODO: ${message}`)
  Error.captureStackTrace?.(err, todo)
  throw err
}
