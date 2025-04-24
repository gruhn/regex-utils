
// TODO: make this an Iterable instance:
export type Stream<T> =
  | undefined
  | { head: T, tail: () => Stream<T> }

function cons<T>(head: T, tail: () => Stream<T>): Stream<T> {
  return { head, tail }
}

function singleton<T>(value: T): Stream<T> {
  return cons(value, () => undefined)
}

function map<A,B>(fn: (a: A) => B, stream: Stream<A>): Stream<B> {
  if (stream === undefined) 
    return undefined
  else
    return {
      head: fn(stream.head),
      tail: () => map(fn, stream.tail()),
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
      head: stream1.head,
      tail: () => interleave(stream2, stream1.tail())
    }
}

export function concat<A>(streams: Stream<Stream<A>>): Stream<A> {
  if (streams === undefined)
    return undefined
  else if (streams.head === undefined)
    return concat(streams.tail())
  else {
    const stream = streams.head
    return {
      head: stream.head,
      tail: () => concat({ head: stream.tail(), tail: streams.tail })
    }
  }
}

/**
 * This function is useful to create a fair enumeration of 
 * the cartesian product of two infinite streams, i.e. all 
 * possible ways to pair up items from the two streams.
 *
 * For example, say `streamA` and `streamB` produce all non-
 * negative integers (0,1,2,3,4,...) then one could start 
 * by pairing 0 from `streamA` with everything from `streamB`:
 * 
 *     (0,0) -> (0,1) -> (0,2) -> (0,3) -> ...
 *
 * However, this enumeration is unfair because it never 
 * produces (1,0) or (2,0) etc. A trick to make it fair
 * is to enumerate the pairs in a "diagonal" fashion:
 *
 *     (0,0) (0,1) (0,2) (0,3) (0,4)
 *           /     /     /     /
 *         /     /     /     /
 *     (1,0) (1,1) (1,2) (1,3)
 *           /     /     /
 *         /     /     /
 *     (2,0) (2,1) (2,2)
 *           /     /    
 *         /     /
 *     (3,0) (3,1)
 *
 * Where each stripes is oriented top-right to bottom-left.
 * This guarantees that every possible pair is produced eventually.
 */
export function diagonalize<A,B,C>(
  pair: (a: A, b: B) => C,
  streamA: Stream<A>,
  streamB: Stream<B>
): Stream<C> {
  return concat(stripe(pair, streamA, streamB))
}

/**
 * Creates a stream of streams, where each item-stream
 * is a "diagonal stripe" (see `diagonalize`).
 * The individual item-streams are always finite but the
 * outer stream is infinite (unless the input streams are
 * already finite).
 */
function stripe<A,B,C>(
  pair: (a: A, b: B) => C,
  streamA: Stream<A>,
  streamB: Stream<B>,
): Stream<Stream<C>> {
  if (streamA === undefined || streamB === undefined) {
    return undefined
  } else {
    return {
      head: singleton(pair(streamA.head, streamB.head)),
      tail: () => {
        return zipCons(
          map(itemA => pair(itemA, streamB.head), streamA.tail()),
          stripe(pair, streamA, streamB.tail())
        )
      }
    }
  }
}

/**
 * TODO
 */
function zipCons<A>(
  row: Stream<A>,
  stripes: Stream<Stream<A>>,
): Stream<Stream<A>> {
  if (row === undefined)
    return stripes
  else if (stripes === undefined)
    // QUESTION: Can this case happen?
    return map(singleton, row)
  else
    return {
      head: cons(row.head, () => stripes.head),
      tail: () => zipCons(row.tail(), stripes.tail())
    }
}

export function take<A>(n: number, stream: Stream<A>): Stream<A> {
  if (n <= 0 || stream === undefined)
    return undefined
  else
    return cons(stream.head, () => take(n - 1, stream.tail()))
}

export function fromArray<T>(
  array: Array<T>
): Stream<T> {
  if (array.length === 0)
    return undefined
  else
    return {
      head: array[0],
      tail: () => fromArray(array.slice(1))
    }
}

export function toArray<T>(stream: Stream<T>): Array<T> {
  const array: T[] = []
  while (stream !== undefined) {
    array.push(stream.head)
    stream = stream.tail()
  }
  return array
}

export function range(
  start: number,
  end: number
): Stream<number> {
  if (start >= end)
    return undefined
  else
    return cons(start, () => range(start + 1, end))
}

