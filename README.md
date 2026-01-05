# Regex Utils

Zero-dependency TypeScript library for regex utilities that go beyond string matching.
These are surprisingly hard to come by for any programming language. ✨

- [Documentation](https://gruhn.github.io/regex-utils/interfaces/RegexBuilder.html)
- Online demos:
  - [RegExp Equivalence Checker](https://gruhn.github.io/regex-utils/equiv-checker.html)
  - [Random Password Generator](https://gruhn.github.io/regex-utils/password-generator.html)

## API Overview 🚀

- 🔗 Set-style operations:
  - [.and(...)](https://gruhn.github.io/regex-utils/interfaces/RegexBuilder.html#and) - Compute intersection of two regex.
  - [.not()](https://gruhn.github.io/regex-utils/interfaces/RegexBuilder.html#not) - Compute the complement of a regex.
  - [.without(...)](https://gruhn.github.io/regex-utils/interfaces/RegexBuilder.html#without) - Compute the difference of two regex.
- ✅ Set-style predicates:
  - [.isEquivalent(...)](https://gruhn.github.io/regex-utils/interfaces/RegexBuilder.html#isEquivalent) - Check whether two regex match the same strings.
  - [.isSubsetOf(...)](https://gruhn.github.io/regex-utils/interfaces/RegexBuilder.html#isSubsetOf)
  - [.isSupersetOf(...)](https://gruhn.github.io/regex-utils/interfaces/RegexBuilder.html#isSupersetOf)
  - [.isDisjointFrom(...)](https://gruhn.github.io/regex-utils/interfaces/RegexBuilder.html#isDisjointFrom)
  - [.isEmpty()](https://gruhn.github.io/regex-utils/interfaces/RegexBuilder.html#isEmpty) - Check whether a regex matches no strings.
- 📜 Generate strings:
  - [.sample(...)](https://gruhn.github.io/regex-utils/interfaces/RegexBuilder.html#sample) - Generate random strings matching a regex.
  - [.enumerate()](https://gruhn.github.io/regex-utils/interfaces/RegexBuilder.html#enumerate) - Exhaustively enumerate strings matching a regex.
- 🔧 Miscellaneous:
  - [.size()](https://gruhn.github.io/regex-utils/interfaces/RegexBuilder.html#size) - Count the number of strings that a regex matches.
  - [.derivative(...)](https://gruhn.github.io/regex-utils/interfaces/RegexBuilder.html#derivative) - Compute a Brzozowski derivative of a regex.
- and others...

## Installation 📦

```bash
npm install @gruhn/regex-utils
```
```typescript
import { RB } from '@gruhn/regex-utils'
```

## Syntax Support

| Feature | Support | Examples |
|---------|---------|-------------|
| Quantifiers | ✅ | `a*`, `a+`, `a{3,10}`, `a?` |
| Alternation | ✅ | `a\|b` |
| Character classes | ✅ | `.`, `\w`, `[a-zA-Z]`, ... |
| Escaping | ✅ | `\$`, `\.`, ... |
| (Non-)capturing groups | ✅<sup>1</sup> | `(?:...)`, `(...)` |
| Start/end anchors | ⚠️<sup>2</sup> | `^`, `$` |
| Lookahead | ⚠️<sup>3</sup> | `(?=...)`, `(?!...)` |
| Lookbehind | ❌ | `(?<=...)`, `(?<!...)` |
| Word boundary | ❌ | `\b`, `\B` |
| Unicode property escapes | ❌ | `\p{...}`, `\P{...}` |
| Backreferences | ❌ | `\1` `\2` ... |
| `dotAll` flag | ✅ | `/.../s`, `(?s:...)` |
| `global` flag | ✅<sup>4</sup> | `/.../g` |
| `hasIndices` flag | ✅<sup>4</sup> | `/.../d` |
| `ignoreCase` flag | ❌ | `/.../i` `(?i:...)` |
| `multiline` flag | ❌ | `/.../m` `(?m:...)` |
| `unicode` flag | ❌ | `/.../u` |
| `unicodeSets` flag | ❌ | `/.../v` |
| `sticky` flag | ❌ | `/.../y` |

1. Both capturing- and non-capturing groups are just treated as parenthesis, because this library is never doing string extraction.
2. Some pathological patterns are not supported like anchors inside quantifiers `(^a)+`.
3. Anchors inside lookaheads like `(?=^a)` are not supported.
4. Flag is simply ignored because it does not affect the behavior of this library.

An `UnsupportedSyntaxError` is thrown when unsupported patterns are detected.
The library **SHOULD ALWAYS** either throw an error or respect the regex specification exactly.
Please report a bug if the library silently uses a faulty interpretation.

Handling syntax-related errors:
```typescript
import { RB, ParseError, UnsupportedSyntaxError } from '@gruhn/regex-utils'

try {
  RB(/^[a-z]*$/)
} catch (error) {
  if (error instanceof SyntaxError) {
    // Invalid regex syntax! Native error, not emitted by this library.
    // E.g. this will also throw a `SyntaxError`: new RegExp(')')
  } else if (error instanceof ParseError) {
    // The regex syntax is valid but the internal parser could not handle it.
    // If this happens it's a bug in this library.
  } else if (error instanceof UnsupportedSyntaxError) {
    // Regex syntax is valid but not supported by this library.
  }
}
```

## Example use cases 💡

### Generate test data from regex 📜

Generate 5 random email addresses:
```typescript
const email = RB(/^[a-z]+@[a-z]+\.[a-z]{2,3}$/)
for (const str of email.sample().take(5)) {
  console.log(str)
}
```
```
ky@e.no
cc@gg.gaj
z@if.ojk
vr@y.ehl
e@zx.hzq
```

Generate 5 random email addresses, which have exactly 20 characters:
```typescript
const emailLength20 = email.and(/^.{20}$/)
for (const str of emailLength20.sample().take(5)) {
  console.log(str)
}
```
```
kahragjijttzyze@i.mv
gnpbjzll@cwoktvw.hhd
knqmyotxxblh@yip.ccc
kopfpstjlnbq@lal.nmi
vrskllsvblqb@gemi.wc
```

### Refactor regex then check equivalence 🔄

[**ONLINE DEMO**](https://gruhn.github.io/regex-utils/equiv-checker.html?regexp1=%5Ea%7Cb%24&regexp2=%5E%5Bab%5D%24)

Say we found this incredibly complicated regex somewhere in the codebase:
```typescript
const oldRegex = /^a|b$/
```

This can be simplified, right?
```typescript
const newRegex = /^[ab]$/
```

But to double-check we can use `.isEquivalent` to verify that the new version matches exactly the same strings as the old version.
That is, whether `oldRegex.test(str) === newRegex.test(str)` for every possible input string:

```typescript
RB(oldRegex).isEquivalent(newRegex) // false
```

Looks like we made some mistake.
We can generate counterexamples using `.without(...)` and `.sample(...)`.
First, we derive new regex that match exactly what `newRegex` matches but not `oldRegex` and vice versa:
```typescript
const onlyNew = RB(newRegex).without(oldRegex)
const onlyOld = RB(oldRegex).without(newRegex)
```
`onlyNew` turns out to be empty (`onlyNew.isEmpty() === true`) but `onlyOld` has some matches:
```typescript
for (const str of onlyOld.sample().take(5)) {
  console.log(str)
}
```
```
aaba
aa
aba
bab
aababa
```
Why does `oldRegex` match all these strings with multiple characters?
Shouldn't it only match "a" or "b" like `newRegex`?
Turns out we thought that  `oldRegex` is the same as `^(a|b)$`
but in reality it's the same as `(^a)|(b$)`.

### Comment regex using complement 💬

How do you write a regex that matches HTML comments like:
```
<!-- This is a comment -->
```
A straightforward attempt would be:
```typescript
<!--.*-->
```
The problem is that `.*` also matches the end marker `-->`,
so this is also a match:
```typescript
<!-- This is a comment --> and this shouldn't be part of it -->
```
We need to specify that the inner part can be any string that does not contain `-->`.
With `.not()` (aka. regex complement) this is easy:

```typescript
import { RB } from '@gruhn/regex-utils'

const commentStart = RB('<!--')
const commentInner = RB(/^.*-->.*$/).not()
const commentEnd = RB('-->')

const comment = commentStart.concat(commentInner).concat(commentEnd)
```

With `.toRegExp()` we can convert back to a native JavaScript regex:
```typescript
comment.toRegExp()
```
```
/^<!--(---*[^->]|-?[^-])*---*>$/
```

### Password regex using intersections 🔐

[**ONLINE DEMO**](https://gruhn.github.io/regex-utils/password-generator.html?constraints=%5E.%7B16%2C32%7D%24%0A%5E%5B%5Cx21-%5Cx7E%5D*%24%0A%5B0-9%5D%0A%5Ba-z%5D%0A%5BA-Z%5D)

It's difficult to write a single regex for multiple independent constraints.
For example, to specify a valid password.
But with regex intersections it's very natural:

```typescript
import { RB } from '@gruhn/regex-utils'

const passwordRegex = RB(/^[a-zA-Z0-9]{12,32}$/) // 12-32 alphanumeric characters
  .and(/[0-9]/) // contains a number
  .and(/[A-Z]/) // contains an upper case letter
  .and(/[a-z]/) // contains a lower case letter
```

We can convert this back to a native JavaScript RegExp with:
```typescript
passwordRegex.toRegExp()
```
> [!NOTE]
> The output `RegExp` can be very large.

We can also use other utilities like `.size()` to determine how many potential passwords match this regex:
```typescript
console.log(passwordRegex.size())
```
```
2301586451429392354821768871006991487961066695735482449920n
```

With `.sample()` we can generate some of these matches:
```typescript
for (const str of passwordRegex.sample().take(10)) {
  console.log(str)
}
```
```
NEWJIAXQISWT0Wwm
lxoegadrzeynezkmtfcIBzzQ9e
ypzvhvtwpWk4u6
MSZXXKIKEKWKXLQ8HQ7Ds
BCBSFBSMNOLKlgQN5L
8950244600709IW1pg
UOTQBLVOTZQWFSAJYBXZNQBEeom0l
520302447164378435bv4dp4ysC
71073970686490eY2Jt4
afgpnxqwUK5B
```

### Solve _Advent Of Code 2023 - Day 12_ 🎄

In the coding puzzle [Advent Of Code 2023 - Day 12](https://adventofcode.com/2023/day/12)
you are given pairs of string patterns.
An example pair is `.??..??...?##.` and `1,1,3`.
Both patterns describe a class of strings and the task is to count the number of strings that match both patterns.

In the first pattern, `.` and `#` stand for the literal characters "dot" and "hash".
The `?` stands for either `.` or `#`.
This can be written as a regular expression:

 - for `#` we simply write `#`
 - for `.` we write `o` (since `.` is a reserved symbol in regular expressions)
 - for `?` we write `(o|#)`

So the pattern `.??..??...?##.` would be written as:
```typescript
const firstRegex = /^o(o|#)(o|#)oo(o|#)(o|#)ooo(o|#)##o$/
```

In the second pattern, each digit stands for a sequence of `#` separated by at least one `o`.
This can also be written as a regular expression:

 - For a digit like `3` we write `#{3}`.
 - Between digits we write `o+`.
 - Additionally, arbitrary many `o` are allowed at the start and end,
   so we add `o*` at the start and end.

Thus, `1,1,3` would be written as:
```typescript
const secondRegex = /^o*#{1}o+#{1}o+#{3}o*$/
```

To solve the task and find the number of strings that match both regex,
we can use `.and(...)` and `.size()` from `regex-utils`.
`.and(...)` computes the intersection of two regular expressions.
That is, it creates a new regex which exactly matches the strings matched by both input regex.
```typescript
const intersection = RB(firstRegex).and(secondRegex)
```
With `.size()` we can then determine the number of matched strings:
```typescript
console.log(intersection.size())
```
```
4n
```

While at it, we can also try `.enumerate()` to list all these matches:
```typescript
for (const str of intersection.enumerate()) {
  console.log(str)
}
```
```
oo#ooo#ooo###o
o#oooo#ooo###o
oo#oo#oooo###o
o#ooo#oooo###o
```

For a full solution checkout: [./benchmark/aoc2023-day12.ts](./benchmark/aoc2023-day12.ts).

## References 📖

Heavily informed by these papers:
- https://www.khoury.northeastern.edu/home/turon/re-deriv.pdf
- https://courses.grainger.illinois.edu/cs374/fa2017/extra_notes/01_nfa_to_reg.pdf
