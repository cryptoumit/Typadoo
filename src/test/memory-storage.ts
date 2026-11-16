import type { StoragePort } from '../storage/repository';

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryStorage implements StoragePort {
  readonly values = new Map<string, unknown>();
  failNextSetFor?: string;
  failNextGetFor?: string;

  async get(key: string): Promise<unknown> {
    if (this.failNextGetFor === key) {
      this.failNextGetFor = undefined;
      throw new Error('injected read failure');
    }
    return this.values.has(key) ? clone(this.values.get(key)) : undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    if (this.failNextSetFor === key) {
      this.failNextSetFor = undefined;
      throw new Error('injected write failure');
    }
    this.values.set(key, clone(value));
  }

  async remove(key: string): Promise<void> {
    this.values.delete(key);
  }
}
