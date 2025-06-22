# Regex Utils

Zero-dependency TypeScript library for regex intersection, complement and other utilities that go beyond string matching.
These are surprisingly hard to come by for any programming language.

```typescript
import { intersection, size, enumerate } from '@gruhn/regex-utils'

// `intersection` combines multiple regex into one:
const passwordRegex = intersection(
  /^[a-zA-Z0-9]{12,32}$/, // 12-32 alphanumeric characters
  /[0-9]/, // at least one number
  /[A-Z]/, // at least one upper case letter   
  /[a-z]/, // at least one lower case letter
)

// `size` calculates the number of strings matching the regex: 
console.log(size(passwordRegex))
// 2301586451429392354821768871006991487961066695735482449920n

// `enumerate` returns a stream of strings matching the regex:
for (const sample of enumerate(passwordRegex).take(10)) {
  console.log(sample)
}
// aaaaaaaaaaA0
// aaaaaaaaaa0A
// aaaaaaaaaAA0
// aaaaaaaaaA00
// aaaaaaaaaaA1
// aaaaaaaaa00A
// baaaaaaaaaA0
// AAAAAAAAAA0a
// aaaaaaaaaAA1
// aaaaaaaaaa0B
```

## Installation

```bash
npm install @gruhn/regex-utils
```

## High- vs. Low-Level API

There is a high-level API and a low-level API:

 - [high-level API documentation](https://gruhn.github.io/regex-utils/modules/High-level_API.html)
 - [low-level API documentation](https://gruhn.github.io/regex-utils/modules/Low-Level_API.html)

The high-level API operates directly on native JavaScript `RegExp` instances,
which is more convenient but also requires parsing the regular expression.
The low-level API operates on an internal representation
which skips parsing step and is more efficient when combining multiple functions.
For example, say you want to know how many strings match the intersection
of two regular expressions:

```typescript
import { size, intersection } from '@gruhn/regex-utils'

size(intersection(regex1, regex2))
```

This:
1. parses the two input `RegExp`
2. computes the intersection
3. converts the result back to `RegExp`
4. parses that again
5. computes the size

Step (1) should be fast for small handwritten regex.
But the intersection of two regex can be quite large, 
which can make step (3) and (4) quite costly.
With the low-level API, step (3) and step (4) can be eliminated:

```typescript
import * as RE from '@gruhn/regex-utils/low-level-api'

RE.size(
  RE.toStdRegex(
    RE.and(
      RE.parse(regex1),
      RE.parse(regex2)
    )
  )
)
```

<!--

## Todo Utilities

* recognize regex prone to catastrophic backtracking
  - https://www.regular-expressions.info/catastrophic.html
  - https://www.youtube.com/watch?v=DDe-S3uef2w
* check equivalence of two regex or find counterexample string

-->

## Limitations

The library implements a custom parser for regular expressions,
so only a subset of the syntax is supported:
 - quantifiers: `*`, `+`, `?`, `{3,5}`, ...
 - alternation: `|`
 - character classes: `.`, `\w`, `[a-z]`, ...
 - optional start/end markers: `^` / `$` but only at the start/end
   (technically they are allowed anywhere in the expression)
 - escaped meta characters: `\$`, `\.`, ...
 - (non-)capturing groups: `(...)`, `(?...)`
 - positive/negative lookahead: `(?!...)`, `(?=...)`
Regex flags are not supported at all.

## References

Heavily informed by these papers:
- https://www.khoury.northeastern.edu/home/turon/re-deriv.pdf
- https://courses.grainger.illinois.edu/cs374/fa2017/extra_notes/01_nfa_to_reg.pdf
