import * as CharSet from "./char-set"
import * as RE from "./regex"
import { assert } from "./utils"
import * as Table from './table'

export type DFA = Readonly<{
  allStates: Map<number, RE.ExtRegex>
  startState: number
  finalStates: Set<number>
  transitions: Table.Table<RE.StdRegex>
}>

function pickChar(set: CharSet.CharSet): number {
  assert(set.type !== 'empty')
  return set.range.start
}

function regexToDFA(regex: RE.ExtRegex): DFA {
  // console.debug(RE.toString(regex))
  const allStates = new Map([[regex.hash, regex]])
  const transitions: Table.Table<RE.StdRegex> = new Map()

  const extraFinalState = RE.epsilon
  allStates.set(extraFinalState.hash, extraFinalState)

  const worklist = [regex]
  const derivClassCache: Table.Table<CharSet.CharSet[]> = new Map()

  while (true) {
    const sourceState = worklist.shift()
    if (sourceState === undefined) {
      break
    } else if (RE.isStdRegex(sourceState)) {
      Table.set(
        sourceState.hash,
        extraFinalState.hash,
        sourceState,
        transitions,
      )
      continue
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
          RE.literal(charSet),
          transitions,
        )
        worklist.push(targetState)
      } else {
        Table.setWith(
          sourceState.hash,
          knownState.hash,
          RE.literal(charSet),
          transitions,
          RE.union
        )
      }  
    }
  }

  const finalStates = new Set([extraFinalState.hash])
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

type RipStateResult = {
  predecessors: [number, RE.StdRegex][]
  selfLoop: RE.StdRegex
  successors: [number, RE.StdRegex][]
}

function ripState(state: number, transitions: Table.Table<RE.StdRegex>): RipStateResult {
  const selfLoop = Table.get(state, state, transitions) ?? RE.epsilon

  const successorsMap = transitions.get(state) ?? new Map<number, RE.StdRegex>()
  // handle self loops separately:
  successorsMap.delete(state)
  const successors = [...successorsMap.entries()]
  transitions.delete(state)

  const predecessors: [number, RE.StdRegex][] = []
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
  const transitionsWithRegexLabels = Table.map(dfa.transitions, x => x)

  const newStartState = -1
  Table.set(
    newStartState,
    dfa.startState,
    RE.epsilon,
    transitionsWithRegexLabels,
  )

  const newFinalState = -2
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

function printTrans(trans: Table.Table<RE.StdRegex>) {
  console.debug('=========trans===========')
  for (const [source, succs] of trans.entries()) {
    for (const [target, label] of succs) {
      console.debug(source, target, RE.toRegExp(label))
      // console.debug(source, target, RE.toString(label))
    }
  }
}
