import { sum } from "./utils"


export type Table<T> = Map<number, Map<number, T>>

export function get<T>(rowIndex: number, colIndex: number, table: Table<T>): T | undefined {
  return table.get(rowIndex)?.get(colIndex)
}

export function remove<T>(
  rowIndex: number,
  colIndex: number,
  table: Table<T>
) {
  return table.get(rowIndex)?.delete(colIndex)
}

function crashOnConflict<T>(): T {
  throw new Error('Table.set cell non-empty')
}

export function set<T>(
  rowIndex: number,
  colIndex: number,
  newValue: T,
  table: Table<T>,
  combine: (oldValue: T, newValue: T) => T = crashOnConflict
): void {
  let row = table.get(rowIndex)
  if (row === undefined) {
    row = new Map()
    table.set(rowIndex, row)   
  }
  const oldValue = row.get(colIndex)
  if (oldValue === undefined) {
    row.set(colIndex, newValue)
  } else {
    row.set(colIndex, combine(oldValue, newValue))
  }
}

export function map<A,B>(table: Table<A>, fn: (_: A) => B): Table<B> {
  return new Map(
    [...table.entries()].map(
      ([rowIndex, row]) => [rowIndex, new Map(
        [...row.entries()].map(
          ([colIndex, cell]) => [colIndex, fn(cell)]
        )
      )]
    )
  ) 
}

export function* entries<A>(table: Table<A>): Generator<[number, number, A]> {
  for (const [rowIndex, row] of table.entries()) {
    for (const [colIndex, value] of row.entries()) {
      yield [rowIndex, colIndex, value]
    }
  }
}

export function fromEntries<A>(items: Iterable<[number, number, A]>): Table<A> {
  const table: Table<A> = new Map()
  for (const [rowIndex, colIndex, value] of items) {
    set(rowIndex, colIndex, value, table)
  }
  return table
}

export function size<A>(table: Table<A>): number {
  return sum([...table.values()].map(row => row.size))
}
