# Regex Utils

Zero-dependency TypeScript library for regex intersection, complement and other utilities that go beyond string matching.
These are surprisingly hard to come by for any programming language:

 - [`intersection`](https://gruhn.github.io/regex-utils/functions/high-level-api.intersection.html):
   Combines multiple `RegExp` into a single `RegExp` that descibes their intersection.
 - [`complement`](https://gruhn.github.io/regex-utils/functions/high-level-api.complement.html):
   Returns a `RegExp` describes the opposite of the input `RegExp`.
 - [`size`](https://gruhn.github.io/regex-utils/functions/high-level-api.size.html):
   Returns the number of strings matching the input `RegExp`.
 - [`enumerate`](https://gruhn.github.io/regex-utils/functions/high-level-api.enumerate.html):
   Returns a stream of strings matching the input `RegExp`.
 - [`derivative`](https://gruhn.github.io/regex-utils/functions/high-level-api.derivative.html):
   Computes a Brzozowski derivative of the input `RegExp`.

## Installation

```bash
npm install @gruhn/regex-utils
```

## High- vs. Low-Level API

There is a high-level API and a low-level API:

 - [high-level API documentation](https://gruhn.github.io/regex-utils/modules/high-level-api.html)
 - [low-level API documentation](https://gruhn.github.io/regex-utils/modules/low-level-api.html)

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

* Syntax support
  - The library implements a custom parser for regular expressions,
    so only a subset of the syntax is supported:
    - quantifiers: `*`, `+`, `?`, `{3,5}`, ...
    - alternation: `|`
    - character classes: `.`, `\w`, `[a-z]`, ...
    - optional start/end markers: `^` / `$` but only at the start/end
      (technically they are allowed anywhere in the expression)
    - escaped meta characters: `\$`, `\.`, ...
    - capturing groups: `(...)`
  - regex flags are not supported at all
* performance of `intersection` and `complement`
  - These function have worst case exponential complexity.
    But often the worst case is not realized.
    - Nested quantifiers are especially dangerous, e.g. `(a*|b)*`.
  - A bigger problem is: even if computation is fast,
    the output regex can be extremely large to the point that
    the `new RegExp(...)` constructor crashes.

## References

Heavily informed by these papers:
- https://www.khoury.northeastern.edu/home/turon/re-deriv.pdf
- https://courses.grainger.illinois.edu/cs374/fa2017/extra_notes/01_nfa_to_reg.pdf
