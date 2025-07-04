import { identity, checkedAllCases, assert } from './utils'

export type ParseResult<T> = { value: T, restInput: string }

export class ParseError extends Error {

  constructor(
    message: string,
    public readonly restInput: string
  ) {
    super(`${message}\nInput: "${restInput.slice(0, 20).padEnd(25, '.')}"`)
  }
  
}

export class Parser<T> {

  constructor(public readonly run: (input: string) => ParseResult<T>) {}

  andThen<U>(restParser: (result: T) => Parser<U>): Parser<U> {
    return new Parser(input => {
      const result = this.run(input)
      return restParser(result.value).run(result.restInput)
    })
  }

  map<U>(fn: (value: T) => U): Parser<U> {
    return this.andThen(value => pure(fn(value)))
  }

}

export function failure(message: string) {
  return new Parser(input => {
    throw new ParseError(message, input)
  })
}

// FIXME: try avoid type assertions in here:
export function sequence<Ts extends unknown[]>(
  parsers: { [K in keyof Ts]: Parser<Ts[K]> }
): Parser<Ts> {
  return new Parser(input => {
    let restInput = input
    const output = []
    for (const parser of parsers) {
      const result = parser.run(restInput)
      restInput = result.restInput
      output.push(result.value)
    }
    return { value: output as Ts, restInput }
  })
}

export function pure<T>(value: T): Parser<T> {
  return new Parser(input => ({ value, restInput: input }))
}

export function string(str: string): Parser<string> {
  return new Parser(input => {
    if (!input.startsWith(str)) {
      throw new ParseError(`Expected "${str}".`, input)
    }

    return { value: str, restInput: input.slice(str.length) }
  })
}

export function char(char: string): Parser<string> {
  return new Parser(input => {
    if (input[0] === char) 
      return { value: char, restInput: input.slice(1) }
    else 
      throw new ParseError(`Expected "${char}".`, input)
  })
}

export function between<T>(open: Parser<unknown>, close: Parser<unknown>, middle: Parser<T>): Parser<T> {
  return sequence([ open, middle, close ])
    .map(([_open, value, _close]) => value)
}

export function choice<T>(parserOptions: Parser<T>[]): Parser<T> {
  return new Parser(input => {
    for (const parser of parserOptions) {
      try {
        return parser.run(input)
      } catch (error) {
        if (error instanceof ParseError) {
          if (error.restInput === input) {
            // parser failed but did not consume any characters,
            // => try next parser
            continue
          } else {
            // parser failed and consumed characters. Don't try next parser
            // to avoid backtracking by default:
            throw error
          }
        } else {
          // Only catch ParseErrors, otherwise we silence true logic errors parsers.
          throw error
        }
      }
    }

    // NOTE: also happens if all `parserOptions` is empty.
    throw new ParseError('All choices failed.', input)
  })
}

export function many<T>(parser: Parser<T>): Parser<T[]> {
  return new Parser(input => {
    const items: T[] = []
    let restInput = input
    while (true) {
      try {
        const result = parser.run(restInput)
        restInput = result.restInput
        items.push(result.value)
      } catch (error) {
        if (error instanceof ParseError) {
          if (error.restInput === restInput) {
            // parser failed but did not consume any characters,
            // => applied parser maximum number of times
            break
          } else {
            // parser failed and consumed characters: 
            throw error
          }
        } else {
          // Only catch ParseErrors, otherwise we silence true logic errors parsers.
          throw error
        }
      }
    }
    return { value: items, restInput }
  })
}

export function some<T>(parser: Parser<T>): Parser<[T, ...T[]]> {
  return parser
    .andThen(first => many(parser)
      .andThen(rest => pure([first, ...rest]))
    )
}

export function count<T>(n: number, parser: Parser<T>): Parser<T[]> {
  assert(Number.isInteger(n) && n >= 0)

  if (n === 0) 
    return pure([])
  else // n > 0
    return parser.andThen(first => count(n-1, parser)
      .map(rest => [first, ...rest])
    )
}

export function optional<T>(parser: Parser<T>): Parser<T | undefined> {
  return new Parser(input => {
    try {
      return parser.run(input)
    } catch (error) {
      if (error instanceof ParseError) {
        if (error.restInput === input) {
          // parser failed but did not consume any characters
          // ==> return `undefined` and consume no characters:
          return { value: undefined, restInput: input }
        } else {
          // parser failed and consumed characters. 
          // ==> don't backtrack by default:
          throw error
        }
      } else {
        // Only catch parse errors, otherwise we silence logic errors:
        throw error
      }
    }
  })
}

export function satisfy(predicate: (char: string) => boolean): Parser<string> {
  return new Parser(input => {
    if (input === '') {
      throw new ParseError('Unexpected end of input', input)
    } else if (!predicate(input[0])) {
      throw new ParseError('Character does not satisfy predicate', input)
    } else {
      return { value: input[0], restInput: input.slice(1) }
    }
  })
}

export const digitChar: Parser<string> = satisfy(char => /^[0-9]$/.test(char))

export const hexChar: Parser<string> = satisfy(char => /^[0-9a-fA-F]$/.test(char))

export const anyChar: Parser<string> = satisfy(_ => true)

export const decimal: Parser<number> = some(digitChar).map(
  digits => parseInt(digits.join(''), 10)
)

/**
 * Needed for recursive parsers. TODO: explain why.
 */
export function lazy<T>(createParser: () => Parser<T>): Parser<T> {
  return pure(null).andThen(createParser)
}

export function tryElseBacktrack<T>(parser: Parser<T>): Parser<T> {
  return new Parser(input => {
    try {
      return parser.run(input)
    } catch (error) {
      if (error instanceof ParseError) {
        // restore original `input` and pretend that the parser did
        // not consume any characters:
        throw new ParseError(error.message, input)
      } else {
        throw error
      }
    }
  })
}

export namespace Expr {

  export type UnaryOperator<T> = Parser<(inner: T) => T>

  export type BinaryOperator<T, R=T> = Parser<(left: T, right: T) => R>

  function prefixOp<T>(
    operator: UnaryOperator<T>,
    termParser: Parser<T>
  ): Parser<T> {
    return operator.andThen(
      pre => termParser.map(pre)
    )
  }

  function postfixOp<T>(
    termParser: Parser<T>,
    operator: UnaryOperator<T>,
  ): Parser<T> {
    return termParser.andThen(value =>
      operator.map(post => post(value))
    )
  }

  export function infixOpLeftAssoc<T>(
    left: T,
    operatorParser: BinaryOperator<T>,
    rightParser: Parser<T>,
  ): Parser<T> {
    return operatorParser.andThen(op =>
      rightParser.andThen(right =>
        choice([
          infixOpLeftAssoc(op(left, right), operatorParser, rightParser),
          pure(op(left, right))
        ])
      )
    )
  }

  export function infixOpRightAssoc<T>(
    left: T,   
    operatorParser: BinaryOperator<T>,
    rightParser: Parser<T>,
  ): Parser<T> {
    return operatorParser.andThen(op =>
      rightParser.andThen(right =>
        choice([
          infixOpRightAssoc(right, operatorParser, rightParser),
          pure(right)
        ])
      ).map(right => op(left, right))
    )
  } 

  /**
   * Right-associative infix operator where both left- and right 
   * operand can be optional.
   */
  export function infixOpRightAssocOptional<T>(
    left: T | undefined,   
    operatorParser: BinaryOperator<T | undefined, T>,
    rightParser: Parser<T>,
  ): Parser<T> {
    return operatorParser.andThen(op =>
      optional(rightParser).andThen(right =>
        choice([
          infixOpRightAssocOptional(right, operatorParser, rightParser),
          pure(right)
        ])
      ).map(right => op(left, right))
    )
  } 

  export type Operator<T> = Readonly<
    | { type: 'prefix', op: Expr.UnaryOperator<T> }
    | { type: 'postfix', op: Expr.UnaryOperator<T> }
    | { type: 'infixLeft', op: Expr.BinaryOperator<T> }
    | { type: 'infixRight', op: Expr.BinaryOperator<T> }
    | { type: 'infixRightOptional', op: Expr.BinaryOperator<T | undefined, T> }
  >

  function addPrecLevel<T>(
    termParser: Parser<T>,
    operator: Operator<T>,
  ): Parser<T> {
    switch (operator.type) {
      case 'prefix': 
        return prefixOp(
          optional(operator.op).map(pre => pre ?? identity),
          termParser,
        )
      case 'postfix':
        return postfixOp(
          termParser,
          optional(operator.op).map(pre => pre ?? identity),
        )
      case 'infixLeft':
        return termParser.andThen(left =>
          choice([
            infixOpLeftAssoc(left, operator.op, termParser),
            pure(left)
          ])
        )
      case 'infixRight':
        return termParser.andThen(left =>
          choice([
            infixOpRightAssoc(left, operator.op, termParser),
            pure(left)
          ])
        )
      case 'infixRightOptional':
        return optional(termParser).andThen(left => {
          if (left === undefined)
            return infixOpRightAssocOptional(left, operator.op, termParser)
          else
            return choice([
              infixOpRightAssocOptional(left, operator.op, termParser),
              pure(left)
            ])
        })
    }
    checkedAllCases(operator)
  }

  export function makeExprParser<T>(
    termParser: Parser<T>,
    operators: Operator<T>[],
  ): Parser<T> {
    return operators.reduce(addPrecLevel, termParser)
  }

}
