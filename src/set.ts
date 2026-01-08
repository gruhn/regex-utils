

declare global {
  // Available in ESNext but not yet supported widely:
  interface Set<T> {
      union?<U>(other: Set<U>): Set<T | U>;
      difference?<U>(other: Set<U>): Set<T>;
      // intersection?<U>(other: Set<U>): Set<T & U>;
      // symmetricDifference?<U>(other: Set<U>): Set<T | U>;
      // isSubsetOf?(other: Set<unknown>): boolean;
      // isSupersetOf?(other: Set<unknown>): boolean;
      // isDisjointFrom?(other: Set<unknown>): boolean;
  }
}

export function union<T,U>(setA: Set<T>, setB: Set<U>): Set<T | U> {
  if (typeof setA.union !== 'function') {
    return new Set([...setA, ...setB])
  } else {
    // use native implementation if available
    return setA.union(setB)
  }
}

export function difference<T, U extends T>(setA: Set<T>, setB: Set<U>): Set<T> {
  if (typeof setA.difference !== 'function') {
    const result = new Set(setA)
    for (const itemB of setB) {
      result.delete(itemB)
    }
    return result
  } else {
    // use native implementation if available
    return setA.difference(setB)
  }
}
