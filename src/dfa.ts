import { CharSet, isEmpty } from "./char-set"
import { StdRegex, ExtRegex, codePointDerivative, derivativeClasses, equal, isNullable } from "./regex"
import { assert } from "./utils"

type Transition<Label> = [ExtRegex, Label, ExtRegex]

// TODO: more efficient representation:
type TransitionMap<Label> = readonly Transition<Label>[]

function addTransition<Label>(
  transitionMap: TransitionMap<Label>,
  transition: Transition<Label>
): TransitionMap<Label> {
   // TODO: avoid duplicates
  return [...transitionMap, transition]
}

export type DFA = Readonly<{
  startState: ExtRegex
  finalStates: ExtRegex[]
  transitions: TransitionMap<CharSet>
}>

export function fromExtRegex(regex: StdRegex): DFA {
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

type PartialDFA = Readonly<{
  allStates: ExtRegex[]
  transitions: TransitionMap<CharSet>
}>

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
      transitions: addTransition(
        transitions,
        [sourceState, charSet, targetState]
      ),
    }
  else 
    return explore(
      targetState,
      {
        allStates: [targetState, ...allStates],
        transitions: addTransition(
          transitions,
          [sourceState, charSet, knownState],
        ),
      }
    )
}

function pickChar(set: CharSet): number {
  assert(set.type !== 'empty')
  return set.range.start
}

// export function toStdRegex(dfa: DFA): StdRegex {
//   const regexLabeledTransitions: TransitionMap<StdRegex> = dfa.transitions.map(
//     ([source, charset, target]) => [source, { type: 'literal', charset }, target]
//   )

//   // TODO: normalize DFA by eliminating self-loop on initial state and introducing
//   // a single final state.

//   throw 'todo'
// }
