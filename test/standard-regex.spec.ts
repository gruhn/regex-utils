import fc from "fast-check";
import { describe, test, expect } from "vitest";
import * as SRE from "../src/standard-regex";
import { stdRegex } from './arbitrary-regex';

describe('toString', () => {

  test('output is accepted by RegExp constructor', () => {
    fc.assert(
      fc.property(
        stdRegex(),
        stdRegex => {
          // Throws error if regex is invalid:
          new RegExp(SRE.toString(stdRegex))
        }
      )
    )
  })

})


