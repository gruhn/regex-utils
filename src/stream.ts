
type Stream<T> =
  | undefined  
  | { value: T, thunk: () => Stream<T> }

function cons<T>(head: T, tail: Stream<T>): Stream<T> {
  return { value: head, thunk: () => tail }
}

function singleton<T>(value: T): Stream<T> {
  return cons(value, undefined)
}

/**
 * Takes two streams and combines them element-wise using the given function.
 * The result is an stream that yields the combined elements.
 * If one stream is longer than the other, the remaining elements are ignored.
 */
function zipWith<A,B,C>(
  combine: (a: A, b: B) => C,
  streamA: Stream<A>,
  streamB: Stream<B>,
): Stream<C> {
  if (streamA === undefined || streamB === undefined)
    return undefined
  else
    return {
      value: combine(streamA.value, streamB.value),
      thunk: () => zipWith(combine, streamA.thunk(), streamB.thunk()),
    }
}

function map<A,B>(fn: (a: A) => B, stream: Stream<A>): Stream<B> {
  if (stream === undefined) 
    return undefined
  else
    return {
      value: fn(stream.value),
      thunk: () => map(fn, stream.thunk()),
    }
}

/**
 * Interleaves the elements of two streams. If one stream is longer than the other,
 * the remaining elements are appended to the end.
 */
export function interleave<A>(stream1: Stream<A>, stream2: Stream<A>): Stream<A> {
  if (stream1 === undefined)
    return stream2
  else
    return {
      value: stream1.value,
      thunk: () => interleave(stream2, stream1.thunk())
    }
}

export function concat<A>(streams: Stream<Stream<A>>): Stream<A> {
  if (streams === undefined)
    return undefined
  else if (streams.value === undefined)
    return concat(streams.thunk())
  else {
    const stream = streams.value
    return {
      value: stream.value,
      thunk: () => concat({ value: stream.thunk(), thunk: streams.thunk })
    }
  }
}

// diagonalPairs :: forall a b c. (a -> b -> c) -> [a] -> [b] -> [c]
// diagonalPairs f left right = concat $ stripe left right
//   where
//     stripe :: [a] -> [b] -> [[c]]
//     stripe []     _      = []
//     stripe _      []     = []
//     stripe (a:as) (b:bs) = [f a b] : zipWith (:) (map (f a) bs) (stripe as (b:bs))

/**
 * TODO
 */
export function diagonalize<A,B,C>(
  pair: (a: A, b: B) => C,
  streamA: Stream<A>,
  streamB: Stream<B>
): Stream<C> {
  return concat(stripe(pair, streamA, streamB))
}

export function stripe<A,B,C>(
  pair: (a: A, b: B) => C,
  streamA: Stream<A>,
  streamB: Stream<B>,
): Stream<Stream<C>> {
  if (streamA === undefined || streamB === undefined) {
    return undefined
  } else {
    return {
      value: singleton(pair(streamA.value, streamB.value)),
      thunk: () => {
        return zipWith(
          cons,
          map(b => pair(streamA.value, b), streamB.thunk()),
          stripe(pair, streamA.thunk(), streamB)
        )
      }
    }
  }
}

export function fromArray<T>(
  array: Array<T>
): Stream<T> {
  if (array.length === 0)
    return undefined
  else
    return {
      value: array[0],
      thunk: () => fromArray(array.slice(1))
    }
}

export function* toIterable<T>(stream: Stream<T>): Iterable<T> {
  while (stream !== undefined) {
    yield stream.value
    stream = stream.thunk()
  }
}
