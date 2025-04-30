
# Rare Regex Utils

Zero-dependency TypeScript library for regex utilities that go beyond string matching.
These are surprisingly hard to come by in any programming language ecosystem.

## Install

```bash
npm install rare-regex-utils
```

TODO: how to import TypeScript sources vs. JavaScript bundle.

## Limitations

* Not full regex syntax supported (yet)
* Output regex maybe too verbose, e.g.
  - `(|a)` instead of `a?`
  - `aaaaaa*` instead of `a{5,}`
  - `[a-zA-Z]` instead of `\w`
* Some functions have worst case exponential complexity.
  Usually just pathological cases. Please report.

## Documentation

### `intersection(...res: RegExp[]): RegExp`

Takes a sequence of regular expressions and constructs their intersection.
This is useful to combine several constraints into one. 
For example, to build a regular expression that can validate a new password:

```typescript
import { intersection } from 'rare-regex-utils'

const passwordRegex = intersection(
  /.{12,}/, // 12 letters or more
  /[0-9]/,  // at least one number
  /[A-Z]/,  // at least one upper case letter   
  /[a-z]/,  // at least one lower case letter
)
// returns: TODO

function isValidPassword(str: string) {
  return passwordRegex.test(str)
}
```

In most cases it's simpler and more efficient to match each `RegExp` individually:

```typescript
function isValidPassword(str: string) {
  return /.{12,}/.test(str) && /[0-9]/.test(str) && /[A-Z]/.test(str) && /[a-z]/.test(str)
}
```

However, this is not always possible. 
For example, when a third-party interface expect a single `RegExp` as input like:
* Express.js - for route parameter matching and path specifications
* Yup/Joi/Zod - for string pattern validation
* Webpack - in various configuration options like test, include, and exclude patterns
* fast-check - for random string generation during fuzzing / property based testing

### `complement(re: RegExp): RegExp`

TODO

### `enumerate(re: RegExp): Generator<string>`

A [generator function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*)
that returns a (potentially infinite) stream of strings that match the given `RegExp`.
This can be useful for testing regular expressions.

```typescript
import { enumerate } from 'rare-regex-utils'

const emailRegex = /^[\w\-\.]+@([\w-]+\.)+[\w-]{2,}$/

for (const matchedStr of enumerate(emailRegex)) {
  console.log(matchedStr)
}
```
```
TODO: show output
```

> [!WARNING]
> If the regular expression matches infinitely many strings then a loop like this won't terminate.

> [!TIP]
> Use the new [Iterator helpers](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator/take)
> to only get the first N matches, e.g `enumerate(emailRegex).take(100)`.

The generator produces a _fair enumeration_.
That means every string that matches the regular expression is _eventually_ enumerated.
To illustrate, an _unfair enumeration_ of `/^((na)+|batman)$/` would be:
```
"na", "nana", "nanana", "nananana", "nanananana", ...
```
because it never produces "batman". A fair enumeration would be:
```
"na", "batman", "nana", "nanana", "nananana", "nanananana", ...
```

### `size(re: RegExp): bigint | undefined`

Returns the number of strings that match the given `RegExp` or `undefined` if there are infinitely many matches.

```typescript
import { size } from 'rare-regex-utils'

size(/^[a-z]$/) === 26n

size(/^(a|a)$/) === 1n

size(/^[a-z][0-9]$/) === 260n

size(/^[a-z]*$/) === undefined

size(/^[a-z]{60}/) === 7914088058189701615326255069116716194962212229317838559326167922356251403772678373376n 
```

> [!NOTE]
> Double counting matches might still happen.

### `derivative(prefix: string, re: RegExp): RegExp`

Can compute a [Brzozowski derivative](https://en.wikipedia.org/wiki/Brzozowski_derivative) of the given `RegExp`.

TODO: examples.

## Todo Utilities

* recognize regex prone to catastrophic backtracking
  - https://www.regular-expressions.info/catastrophic.html
  - https://www.youtube.com/watch?v=DDe-S3uef2w
* check equivalence of two regex or find counterexample string

## References

Heavily informed by this paper: https://www.khoury.northeastern.edu/home/turon/re-deriv.pdf

