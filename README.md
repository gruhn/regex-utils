
# Regex Utils

Zero-dependency TypeScript library for rare regex utilities:

## Install

```bash
npm install regex-utils
```

TODO: how to import TypeScript sources vs. JavaScript bundle.

## Limitations

* Not full regex syntax supported (yet)
* Some functions have worst case exponential complexity.
  Usually just pathological cases. Please report.

## Documentation

### `intersection(re1: RegExp, re1: RegExp): RegExp`

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

### `complement(re: RegExp): RegExp`

### `enumerate(re: RegExp): RegExp`

### `derivative(re: RegExp): RegExp`

## Todo Utilities

* recognize regex prone to catastrophic backtracking
  - https://www.regular-expressions.info/catastrophic.html
  - https://www.youtube.com/watch?v=DDe-S3uef2w
* check equivalence of two regex or find counterexample string

## References

Heavily informed by this paper: https://www.khoury.northeastern.edu/home/turon/re-deriv.pdf

