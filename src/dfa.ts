import * as CharSet from "./char-set"
import * as RE from "./regex"
import { assert } from "./utils"
import * as Table from './table'

export type DFA = Readonly<{
  allStates: Map<bigint, RE.ExtRegex>
  startState: bigint
  finalStates: Set<bigint>
  transitions: Table.Table<CharSet.CharSet>
}>

function pickChar(set: CharSet.CharSet): number {
  assert(set.type !== 'empty')
  return set.range.start
}


function regexToDFA(regex: RE.ExtRegex): DFA {
  const allStates = new Map([[regex.hash.value, regex]])
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
      const knownState = allStates.get(targetState.hash.value)

      if (knownState === undefined) {
        allStates.set(targetState.hash.value, targetState)
        Table.set(
          sourceState.hash.value,
          targetState.hash.value,
          charSet,
          transitions,
        )
        worklist.push(targetState)
        // console.debug('state count: ', allStates.size)
      } else {
        Table.setWith(
          sourceState.hash.value,
          knownState.hash.value,
          charSet,
          transitions,
          CharSet.union
        )
      }  
    }
  }

  const finalStates = new Set<bigint>()
  for (const state of allStates.values()) {
    if (RE.isNullable(state)) {
      finalStates.add(state.hash.value)
    }
  } 

  return {
    allStates,
    startState: regex.hash.value,
    finalStates,
    transitions,
  }
}

type RipStateResult = {
  predecessors: [bigint, RE.StdRegex][]
  selfLoop: RE.StdRegex
  successors: [bigint, RE.StdRegex][]
}

function ripState(state: bigint, transitions: Table.Table<RE.StdRegex>): RipStateResult {
  const selfLoop = Table.get(state, state, transitions) ?? RE.epsilon

  const successorsMap = transitions.get(state) ?? new Map<bigint, RE.StdRegex>()
  // handle self loops separately:
  successorsMap.delete(state)
  const successors = [...successorsMap.entries()]
  transitions.delete(state)

  const predecessors: [bigint, RE.StdRegex][] = []
  for (const [source, transitionsFromSource] of transitions) {
    // handle self loops separately:
    if (source !== state) {
      const label = transitionsFromSource.get(state)
      if (label !== undefined) {
        predecessors.push([source, label])
        transitionsFromSource.delete(state)
      }
    }
  }

  return { selfLoop, successors, predecessors }
}

export function dfaToRegex(dfa: DFA): RE.StdRegex {
  const transitionsWithRegexLabels = Table.map(dfa.transitions, RE.literal)

  const newStartState = -1n
  Table.set(
    newStartState,
    dfa.startState,
    RE.epsilon,
    transitionsWithRegexLabels,
  )

  const newFinalState = -2n
  for (const oldFinalState of dfa.finalStates) {
    Table.set(
      oldFinalState,
      newFinalState,
      RE.epsilon,
      transitionsWithRegexLabels,
    )
  }

  for (const state of dfa.allStates.keys()) {
    const result = ripState(state, transitionsWithRegexLabels)

    for (const [pred, predLabel] of result.predecessors) {
      for (const [succ, succLabel] of result.successors) {
        const transitiveLabel = RE.seq([
          predLabel,
          RE.star(result.selfLoop),
          succLabel,
        ])

        Table.setWith(
          pred,
          succ,
          transitiveLabel,
          transitionsWithRegexLabels,
          RE.union,
        )
      }
    }
  }

  assert(transitionsWithRegexLabels.size === 1)
  const transitionsFromNewStart = transitionsWithRegexLabels.get(newStartState)
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
