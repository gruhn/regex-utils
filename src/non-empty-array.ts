
export type NonEmptyArray<T> = readonly [T, ...T[]] | readonly [...T[], T]

export function isNonEmpty<T>(array: ReadonlyArray<T>): array is NonEmptyArray<T> {
  return array.length > 0
}

declare global {
  interface ReadonlyArray<T> {
    // If length of array is known to be non-empty then several array functions should preserve that:
    toSorted(this: NonEmptyArray<T>, compareFn?: (a: T, b: T) => number): NonEmptyArray<T>
    map<U>(callbackFn: (value: T, index: number, array: NonEmptyArray<T>) => U): NonEmptyArray<U>
  }
}

