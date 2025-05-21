import * as CharSet from "./char-set"
import * as RE from "./regex"
import { assert } from "./utils"
import * as Table from './table'
import * as Graph from './graph'

export type DFA = Readonly<{
  allStates: Map<number, RE.ExtRegex>
  startState: number
  finalStates: Set<number>
  transitions: Table.Table<CharSet.CharSet>
}>

function pickChar(set: CharSet.CharSet): number {
  assert(set.type !== 'empty')
  return set.range.start
}

function regexToDFA(regex: RE.ExtRegex): DFA {
  const allStates = new Map([[regex.hash, regex]])
  const transitions: Table.Table<CharSet.CharSet> = new Map()

  const worklist = [regex]
  const derivClassCache: Table.Table<CharSet.CharSet[]> = new Map()

  while (true) {
    const sourceState = worklist.shift()
    if (sourceState === undefined) {
      break
    }

    for (const charSet of RE.derivativeClasses(sourceState, derivClassCache)) {
      const char = pickChar(charSet)
      const targetState = RE.codePointDerivative(char, sourceState)
      const knownState = allStates.get(targetState.hash)

      if (knownState === undefined) {
        allStates.set(targetState.hash, targetState)
        Table.set(
          sourceState.hash,
          targetState.hash,
          charSet,
          transitions,
        )
        worklist.push(targetState)
        // console.debug('state count: ', allStates.size)
      } else {
        Table.set(
          sourceState.hash,
          knownState.hash,
          charSet,
          transitions,
          CharSet.union
        )
      }  
    }
  }

  const finalStates = new Set<number>()
  for (const state of allStates.values()) {
    if (RE.isNullable(state)) {
      finalStates.add(state.hash)
    }
  } 

  return {
    allStates,
    startState: regex.hash,
    finalStates,
    transitions,
  }
}

export function dfaToRegex(dfa: DFA): RE.StdRegex {
  const graph = Graph.create<RE.StdRegex>()
  for (const [source, target, charSet] of Table.entries(dfa.transitions)) {
    Graph.setEdge(source, target, RE.literal(charSet), graph)   
  }

  const newStartState = -1
  Graph.setEdge(
    newStartState,
    dfa.startState,
    RE.epsilon,
    graph
  )

  const newFinalState = -2
  for (const oldFinalState of dfa.finalStates) {
    Graph.setEdge(
      oldFinalState,
      newFinalState,
      RE.epsilon,
      graph
    )
  }

  for (const state of dfa.allStates.keys()) {
    const result = Graph.ripNode(state, graph)

    for (const [pred, predLabel] of result.predecessors) {
      for (const [succ, succLabel] of result.successors) {
        const transitiveLabel = RE.seq([
          predLabel,
          RE.star(result.selfLoop ?? RE.epsilon),
          succLabel,
        ])

        Graph.setEdge(
          pred, 
          succ,
          transitiveLabel,
          graph, 
          RE.union,
        )
      }
    }
  }

  assert(graph.successors.size === 1)
  const transitionsFromNewStart = graph.successors.get(newStartState)
  assert(transitionsFromNewStart !== undefined)

  if (transitionsFromNewStart.size === 0) {
    // All connections to final states have been deleted, 
    // thus the DFA matches no strings:
    return RE.empty
  } else {
    assert(transitionsFromNewStart.size === 1)
    const finalRegex = transitionsFromNewStart.get(newFinalState)
    assert(finalRegex !== undefined)
    return finalRegex
  }
}

// TODO: can this round-trip through DFA construction be avoided?
export function toStdRegex(regex: RE.ExtRegex): RE.StdRegex {
  const dfa = regexToDFA(regex)
  // console.debug('dfa done')
  return dfaToRegex(dfa)
}

// function printTrans(trans: Table.Table<CharSet.CharSet>) {
//   console.debug('=========trans===========')
//   for (const [source, succs] of trans.entries()) {
//     for (const [target, label] of succs) {
//       console.debug(source, target, new RegExp(CharSet.toString(label)))
//       // console.debug(source, target, RE.toString(label))
//     }
//   }
// }
