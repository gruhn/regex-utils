
# Regex Utils

Zero-dependency TypeScript library providing rare regex utility functions:

* `intersection(regex1, regex2)` creates a new regular expression that only matches the strings matched by both `regex1` and `regex2`
* `equivalent(regex1, regex2)` ...
* `findMismatch(regex1, regex2)` ...
* `enumerate(regex)` produces a (potentially infinite) stream of strings matched by `regex`.
* `stripPrefix(string, regex)` ...
* and more...

Mostly inspired by: https://www.khoury.northeastern.edu/home/turon/re-deriv.pdf

## Installation

```bash
npm install regex-utils
```

TODO: how to import TypeScript sources vs. JavaScript bundle.

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

