import * as Table from "./table"

/**
 * Directed graph where nodes are identified by numbers
 * and edges labels have generic type `A`.
 * For efficient access to both successors and predecessors of nodes,
 * two copies of the edges are stored. `predecessors` should always
 * be the same as `successors`, only that edges are reversed.
 */
export type Graph<A> = {
  successors: Table.Table<A>
  predecessors: Table.Table<A>
}

export function create<A>(): Graph<A> {
  return {
    predecessors: new Map(),
    successors: new Map()
  }
}

/**
 * Number of in-going edges at `node` (not counting self-loop).
 */
export function inDegree<A>(node: number, graph: Graph<A>): number {
  const preds = graph.predecessors.get(node) ?? new Map()
  if (preds.has(node))
    return preds.size - 1
  else
    return preds.size
}

/**
 * Number of out-going edges at `node` (not counting self-loop).
 */
export function outDegree<A>(node: number, graph: Graph<A>): number {
  const succs = graph.successors.get(node) ?? new Map()
  if (succs.has(node))
    return succs.size - 1
  else
    return succs.size
}

export type RipNodeResult<A> = {
  predecessors: [number, A][]
  selfLoop: A | undefined
  successors: [number, A][]
}

/**
 * Removes `node` from `graph` including all in-going and out-going
 * edges of `node`. Returns the removed edges.
 */
export function ripNode<A>(node: number, graph: Graph<A>): RipNodeResult<A> {
  const selfLoop = Table.get(node, node, graph.successors)

  const successorsMap = graph.successors.get(node) ?? new Map<number, A>()
  successorsMap.delete(node) // remove self-loop
  const successors = [...successorsMap.entries()]

  // remove successors from successors Map:
  graph.successors.delete(node)
  // remove successors from predecessor Map:
  for (const [succ,_] of successors) {
    Table.remove(succ, node, graph.predecessors)
  }

  const predecessorMap = graph.predecessors.get(node) ?? new Map<number, A>()
  predecessorMap.delete(node) // remove self-loop
  const predecessors = [...predecessorMap.entries()]

  // remove predecessors from predecessor Map:
  graph.predecessors.delete(node)
  // remove predecessors from successor Map:
  for (const [pred,_] of predecessors) {
    Table.remove(pred, node, graph.successors)
  }

  return { selfLoop, successors, predecessors }
}

/**
 * Adds an edge to `graph` from `sourceNode` to `targetNode` with `edgeLabel`.
 * If there is already an edge between these nodes, `combine` is called to 
 * to combine the two edge labels.
 */
export function setEdge<A>(
  sourceNode: number,
  targetNode: number,
  edgeLabel: A,
  graph: Graph<A>,
  combine?: (oldLabel: A, newLabel: A) => A,
): void {
  Table.set(
    sourceNode,
    targetNode,
    edgeLabel,
    graph.successors,
    combine,
  )
  Table.set(
    targetNode,
    sourceNode,
    edgeLabel,
    graph.predecessors,
    combine,
  ) 
}
