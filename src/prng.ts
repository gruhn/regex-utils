
/**
 * Simple deterministic PRNG using Linear Congruential Generator
 * Based on Numerical Recipes parameters
 */
export class PRNG {
  private state: number

  constructor(seed: number = 1) {
    this.state = seed
  }

  next(): number {
    this.state = (this.state * 1664525 + 1013904223) % 0x100000000
    return this.state / 0x100000000 // normalize to [0, 1)
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max)
  }
}

