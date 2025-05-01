

export type Table<T> = Map<number, Map<number, T>>

export function get<T>(rowIndex: number, colIndex: number, table: Table<T>): T | undefined {
  return table.get(rowIndex)?.get(colIndex)
}

export function set<T>(rowIndex: number, colIndex: number, value: T, table: Table<T>): void {
  let row = table.get(rowIndex)
  if (row === undefined) {
    row = new Map()
    table.set(rowIndex, row)   
  }
  row.set(colIndex, value)
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
