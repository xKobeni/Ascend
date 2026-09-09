export class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 0x6d2b79f5;
  }

  static fromEntropy(): Random {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now();
    return new Random(seed);
  }

  next(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state / 0x1_0000_0000;
  }

  float(minimum: number, maximum: number): number {
    return minimum + (maximum - minimum) * this.next();
  }

  integer(minimum: number, maximum: number): number {
    return Math.floor(this.float(minimum, maximum + 1));
  }

  pick<Item>(items: readonly Item[]): Item {
    const item = items[Math.floor(this.next() * items.length)];
    if (item === undefined) {
      throw new Error("Cannot choose from an empty collection.");
    }
    return item;
  }
}
