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

  const codePointDerivCache: Table.Table<RE.ExtRegex> = new Map()
  const derivClassesCache: RE.DerivativeClassesCache = {
    classes: new Map(),
    intersections: new Map()
  }

  while (true) {
    const sourceState = worklist.shift()
    if (sourceState === undefined) {
      break
    }

    for (const charSet of RE.derivativeClasses(sourceState, derivClassesCache)) {
      const char = pickChar(charSet)
      const targetState = RE.codePointDerivative(char, sourceState, codePointDerivCache)
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
        // if (allStates.size % 100 === 0) {
        //   console.debug({ stateCount: allStates.size })
        // }
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
 
  // All states except `newStartState` and `newFinalState` need to be eliminated.
  // After that, the only remaining transition is between `newStartState` and
  // `newFinalState` and is labeled with the result regex.
  // Thus, we put all these states in worklist to be iteratively eliminated. 
  // Ripping out states with small in/out-degree earlier can result in smaller expressions.
  // For example:
  //                                 b            d
  //                            +---------(s2)---------+
  //                 a         /                        \
  //      (s0) ------------- (s1)                      (s4)
  //                           \     c            e     /
  //                            +---------(s3)---------+
  //                         
  // Ripping states in the order s2, s3, s1 produces:
  // 
  //                           a(bd|ce)
  //      (s0) --------------------------------------- (s4)
  // 
  // Ripping states in the order s1, s2, s3 produces:
  // 
  //                           (abd)|(ace)
  //      (s0) --------------------------------------- (s4)
  // 
  // Thus, we sort the worklist by degree. Note, that the degree of nodes changes during
  // the later iteration so it can still be that nodes with higher degree are sometimes
  // ripped out first. However, keeping the worklist sorted at the same time also has a  
  // cost. Maybe this can be improved by choosing some heap structure:
  const worklist = [...dfa.allStates.keys()]
    // Avoid constantly re-computing degree during sorting by computing it once in a first pass:
    .map(state => ({ state, degree: Graph.degree(state, graph)}))
    // Sort states by degree:
    .sort((a,b) => a.degree - b.degree)
    // Throw degree away again after sorting:
    .map(({ state }) => state)

  while (true) {
    const state = worklist.shift()
    if (state === undefined) {
      break
    } else {
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
            // Flipping the arguments avoids that the associativity rewrite rule of `union`
            // keeps getting triggered. This makes a segnificant performance difference:
            (oldValue, newValue) => RE.union(newValue, oldValue),
          )
        }
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
export function toStdRegex(inputRegex: RE.ExtRegex): RE.StdRegex {
  const dfa = regexToDFA(inputRegex)
  // printTrans(dfa)
  const outputRegex = dfaToRegex(dfa)
  return outputRegex
}

// function printTrans(dfa: DFA) {
//   console.debug({ start: dfa.startState })
//   console.debug({ final: dfa.finalStates })
//   console.debug('=========trans===========')
//   for (const [source, succs] of dfa.transitions.entries()) {
//     for (const [target, label] of succs) {
//       console.debug(source, target, new RegExp(CharSet.toString(label)))
//       // console.debug(source, target, RE.toString(label))
//     }
//   }
// }

/**
 * Tests if two regular expressions are semantically equivalent, i.e.
 * they match the exact same set of strings.
 *
 * TODO: maybe expose `equal` as dedicated function.
 */
export function isEquivalent(regexA: RE.ExtRegex, regexB: RE.ExtRegex): boolean {
  if (RE.equal(regexA, regexB)) { // First check hash based equality: cheap but weak.
    return true
  } else {
    // Otherwise: A = B iff (A \ B) ∪ (B \ A) = ∅
    
    // A \ B = A ∩ ¬B 
    const diffAB = RE.and([regexA, RE.complement(regexB)])

    // B \ A = B ∩ ¬A
    const diffBA = RE.and([regexB, RE.complement(regexA)])
    
    const result = toStdRegex(RE.or([ diffAB, diffBA ]))

    // QUESTION: This seems too simple. Does this really always work?
    // If yes, there is probably a cheaper way to do this.
    return RE.isEmpty(result)
  }
}
