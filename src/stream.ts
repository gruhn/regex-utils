
export type Stream<T> = Iterable<T> & (
  | { type: 'nil' }
  | { type: 'cons', head: T, tail: () => Stream<T> }
)


function iterator<T>(stream: Stream<T>): Iterator<T> {
  return {
    next(): IteratorResult<T> {
      if (stream.type === 'nil') {
        return { done: true, value: undefined }
      } else {
        const { head, tail } = stream
        stream = tail()
        return { done: false, value: head }
      }
    }
  }
}

function nil<T>(): Stream<T> {
  return {
    type: 'nil', 
    [Symbol.iterator]() {
      return iterator(this)
    }
  }
}

export function cons<T>(head: T, tail: () => Stream<T>): Stream<T> {
  return {
    type: 'cons',
    head,
    tail,
    [Symbol.iterator]() {
      return iterator(this)
    }
  }
}

export function singleton<T>(value: T): Stream<T> {
  return cons<T>(value, nil)
}

export function map<A,B>(fn: (a: A) => B, stream: Stream<A>): Stream<B> {
  if (stream.type === 'nil') 
    return nil()
  else
    return cons(
      fn(stream.head),
      () => map(fn, stream.tail()),
    )
}

/**
 * Interleaves the elements of two streams. If one stream is longer than the other,
 * the remaining elements are appended to the end.
 */
export function interleave<A>(stream1: Stream<A>, stream2: Stream<A>): Stream<A> {
  if (stream1.type === 'nil')
    return stream2
  else
    return cons(
      stream1.head,
      () => interleave(stream2, stream1.tail())
    )
}

export function concat<A>(streams: Stream<Stream<A>>): Stream<A> {
  if (streams.type === 'nil')
    return nil()
  else if (streams.head.type === 'nil')
    return concat(streams.tail())
  else {
    const stream = streams.head
    return cons(
      stream.head,
      () => concat(cons(stream.tail(), streams.tail))
    )
  }
}

/**
 * This function is useful to create a fair enumeration of
 * the cartesian product of two infinite streams, i.e., all
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
 * Where each stripe is oriented top-right to bottom-left.
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
  if (streamA.type === 'nil' || streamB.type === 'nil') {
    return nil()
  } else {
    return cons(
      singleton(pair(streamA.head, streamB.head)),
      () => {
        return zipCons(
          map(itemA => pair(itemA, streamB.head), streamA.tail()),
          stripe(pair, streamA, streamB.tail())
        )
      }
    )
  }
}

/**
 * TODO
 */
function zipCons<A>(
  row: Stream<A>,
  stripes: Stream<Stream<A>>,
): Stream<Stream<A>> {
  if (row.type === 'nil')
    return stripes
  else if (stripes.type === 'nil')
    // QUESTION: Can this case happen?
    return map(singleton, row)
  else
    return cons(
      cons(row.head, () => stripes.head),
      () => zipCons(row.tail(), stripes.tail())
    )
}

export function take<A>(n: number, stream: Stream<A>): Stream<A> {
  if (n <= 0 || stream.type === 'nil')
    return nil()
  else
    return cons(stream.head, () => take(n - 1, stream.tail()))
}

export function takeWhile<A>(predicate: (_: A) => boolean, stream: Stream<A>): Stream<A> {
  if (stream.type === 'nil' || !predicate(stream.head))
    return nil()
  else
    return cons(stream.head, () => takeWhile(predicate, stream.tail()))
}

export function fromArray<T>(
  array: Array<T>
): Stream<T> {
  if (array.length === 0)
    return nil()
  else
    return cons(
      array[0],
      () => fromArray(array.slice(1))
    )
}

export function range(
  start: number,
  end: number
): Stream<number> {
  if (start > end)
    return nil()
  else
    return cons(start, () => range(start + 1, end))
}

