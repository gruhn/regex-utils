import { RB } from '../src/index'

const passwordRegex = RB(/^\w{12,32}$/) // 12-32 alphanumeric characters
  .and(/[0-9]/) // at least one number
  .and(/[A-Z]/) // at least one upper case letter
  .and(/[a-z]/) // at least one lower case letter

// `size` calculates the number of strings matching the regex:
console.log(passwordRegex.size())

// `sample` returns a stream of random strings matching the regex:
for (const sample of passwordRegex.sample().take(100)) {
  console.log(sample)
}
