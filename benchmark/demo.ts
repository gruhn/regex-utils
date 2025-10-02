import { RB } from '../src/index'

const passwordRegex = RB(/^[a-zA-Z0-9]{12,32}$/) // 12-32 alphanumeric characters
  .and(/[0-9]/) // at least one number
  .and(/[A-Z]/) // at least one upper case letter   
  .and(/[a-z]/) // at least one lower case letter

// `size` calculates the number of strings matching the regex: 
console.log(passwordRegex.size())
// 2301586451429392354821768871006991487961066695735482449920n

// `enumerate` returns a stream of strings matching the regex:
for (const sample of passwordRegex.enumerate().take(10)) {
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
