import * as CharSet from "./char-set"
import * as RE from "./regex"
import { assert } from "./utils"
import * as Table from './table'

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
  const transitions: Map<number, Map<number, CharSet.CharSet>> = new Map()

  const worklist = [regex]

  while (true) {
    const sourceState = worklist.shift()
    if (sourceState === undefined) {
      break
    }

    for (const charSet of RE.derivativeClasses(sourceState)) {
      const char = pickChar(charSet)
      const targetState = RE.codePointDerivative(char, sourceState)
      const knownState = allStates.get(targetState.hash)

      // console.debug(
      //   'derivativeClasses:',
      //   RE.toString(sourceState),
      //   RE.derivativeClasses(sourceState)
      //     .map(CharSet.toString),
      //   String.fromCodePoint(char),
      //   char,
      //   RE.toString(targetState),
      // )

      if (knownState === undefined) {
        allStates.set(targetState.hash, targetState)
        Table.setWith(
          sourceState.hash,
          targetState.hash,
          charSet,
          transitions,
          () => { throw new Error('transition already exists') }
        )
        worklist.push(targetState)
        console.debug('new state: ', RE.toString(targetState))
      } else {
        Table.setWith(
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
  const transitionsWithRegexLabels = Table.map(dfa.transitions, RE.literal)

  const newStartState = -1
  Table.setWith(
    newStartState,
    dfa.startState,
    RE.epsilon,
    transitionsWithRegexLabels,
    () => { throw new Error('transition already exists') }
  )

  const newFinalState = -2
  for (const oldFinalState of dfa.finalStates) {
    Table.setWith(
      oldFinalState,
      newFinalState,
      RE.epsilon,
      transitionsWithRegexLabels,
      () => { throw new Error('transition already exists') }
    )
  }

  for (const state of dfa.allStates.keys()) {
    const result = ripState(state, transitionsWithRegexLabels)

    for (const [pred, predLabel] of result.predecessors) {
      for (const [succ, succLabel] of result.successors) {
        const transitiveLabel = RE.concatAll([
          predLabel,
          RE.star(result.selfLoop),
          succLabel,
        ])

        const existingLabel = transitionsWithRegexLabels.get(pred)?.get(succ) ?? RE.empty
        const combinedLabel = RE.union(transitiveLabel, existingLabel)
        const str = RE.toString(combinedLabel)
        if (str.length > 1000) {
          console.debug('1000+ chars: ', new RegExp(str))
          process.exit()
        }

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
  console.debug('regex -> DFA')
  const dfa = regexToDFA(regex)
  // console.debug('DFA:', dfa.allStates.size)
  printTrans(dfa.transitions)
  return dfaToRegex(dfa)
}

function printTrans(trans: Table.Table<CharSet.CharSet>) {
  console.debug('=========trans===========')
  for (const [source, succs] of trans.entries()) {
    for (const [target, label] of succs) {
      console.debug(source, target, new RegExp(CharSet.toString(label)))
      // console.debug(source, target, RE.toString(label))
    }
  }
}
