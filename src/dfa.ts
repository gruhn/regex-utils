import { CharSet, isEmpty } from "./char-set"
import { codePointDerivative, derivativeClasses, equal, ExtRegex, isNullable } from "./extended-regex"
import { StdRegex } from "./standard-regex"
import { assert } from "./utils"

export type Transition = [ExtRegex, CharSet, ExtRegex]

export type DFA = {
  startState: ExtRegex
  finalStates: ExtRegex[]
  // TODO: more efficient representation:
  transitions: Transition[]
}

export function fromExtRegex(regex: ExtRegex): DFA {
  const { allStates, transitions } = explore(regex, {
    allStates: [regex],
    transitions: []
  })

  return {
    startState: regex,
    finalStates: allStates.filter(isNullable),
    transitions,
  }
}

type PartialDFA = {
  allStates: ExtRegex[]
  transitions: Transition[]
}

function explore(
  sourceState: ExtRegex,
  partialDFA: PartialDFA,
): PartialDFA {
  return derivativeClasses(sourceState).reduce(
    (dfa, charSet) => goto(sourceState, charSet, dfa), partialDFA
  )
}

function goto(
  sourceState: ExtRegex,
  charSet: CharSet,
  { allStates, transitions }: PartialDFA,
): PartialDFA {
  const char = pickChar(charSet)
  const targetState = codePointDerivative(char, sourceState)

  const knownState = allStates.find(s => equal(s, targetState))

  if (knownState === undefined)  
    return {
      allStates,
      transitions: [
        // QUESTION: can there be duplicates?
        [sourceState, charSet, targetState],
        ...transitions
      ]
    }
  else 
    return explore(
      targetState,
      {
        allStates: [targetState, ...allStates],
        transitions: [
          // QUESTION: can there be duplicates?
          [sourceState, charSet, knownState],
          ...transitions
        ],
      }
    )
}

function pickChar(set: CharSet): number {
  assert(!isEmpty(set))
  return set[0].start
}

export function toStdRegex(): StdRegex {
  throw 'todo'
}
