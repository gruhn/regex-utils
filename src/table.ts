

export type Table<T> = Map<bigint, Map<bigint, T>>

export function get<T>(rowIndex: bigint, colIndex: bigint, table: Table<T>): T | undefined {
  return table.get(rowIndex)?.get(colIndex)
}

export function remove<T>(
  rowIndex: bigint,
  colIndex: bigint,
  table: Table<T>
) {
  return table.get(rowIndex)?.delete(colIndex)
}

export function set<T>(
  rowIndex: bigint,
  colIndex: bigint,
  newValue: T,
  table: Table<T>,
): void {
  return setWith(
    rowIndex,
    colIndex,
    newValue,
    table,
    () => { throw new Error('Table.set cell non-empty') } 
  )
}

export function setWith<T>(
  rowIndex: bigint,
  colIndex: bigint,
  newValue: T,
  table: Table<T>,
  combine: (oldValue: T, newValue: T) => T
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
