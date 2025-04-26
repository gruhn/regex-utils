
# Regex Utils

Zero-dependency TypeScript library for rare regex utilities:

* `intersection(regex1, regex2)` creates a new regular expression that only matches the strings matched by both `regex1` and `regex2`
* `complement(regex)`
* `size(regex)`
* `equivalent(regex1, regex2)` ...
* `findMismatch(regex1, regex2)` ...
* `enumerate(regex)` produces a (potentially infinite) stream of strings that match `regex`.
* `derivative(string, regex)` ...
* and more...

Heavily informed by this paper: https://www.khoury.northeastern.edu/home/turon/re-deriv.pdf

## Installation

```bash
npm install regex-utils
```

TODO: how to import TypeScript sources vs. JavaScript bundle.

```typescript
import { intersection } from 'regex-utils'

// password constraints as 
const constraints = [
  /.{12,}/,  // min length 12 letters
  /[0-9]/,   // at least one number
  /[A-Z]/,   // at least one upper case letter   
  /[a-z]/,   // at least one lower case letter
]

// Combine into a single regex:
const passwordRegex = constraints.reduce(intersection)
```

## Limitations

* Not full regex syntax supported (yet)
* Some functions have worst case exponential complexity.
  Usually just pathological cases. Please report.

## Documentation

### `intersection(regex1: RegExp, regex2: RegExp): RegExp`

...

### `findMismatch(regex1: RegExp, regex2: RegExp): string | undefined`

Finds a string matching `regex1` or `regex2` but not both.
If no such string exists then the two regular expressions are equivalent and the function returns `undefined`.

TODO: attach information whether the returned string matches `regex1` or `regex2`.

### `equivalent(regex1: RegExp, regex2: RegExp): boolean`

