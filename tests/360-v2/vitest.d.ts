declare module 'vitest' {
  export const describe: (name: string, fn: () => void) => void;
  export const it: (name: string, fn: () => void) => void;
  export const beforeEach: (fn: () => void) => void;
  export interface Expectation {
    toBe(value: unknown): void;
    toEqual(value: unknown): void;
    toBeNull(): void;
    not: {
      toBeNull(): void;
      toBeUndefined(): void;
    };
    toBeDefined(): void;
  }
  export const expect: (value: unknown) => Expectation;
}
