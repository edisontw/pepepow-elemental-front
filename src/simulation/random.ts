const UINT32_RANGE = 0x1_0000_0000;

export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export class DeterministicRng {
  private state: number;

  constructor(seed: number | string) {
    const numericSeed = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    this.state = numericSeed || 0x6d2b79f5;
  }

  nextUint32(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state;
  }

  nextFloat(): number {
    return this.nextUint32() / UINT32_RANGE;
  }

  derive(streamName: string): DeterministicRng {
    return new DeterministicRng(`${this.state}:${streamName}`);
  }

  snapshot(): number {
    return this.state;
  }
}
