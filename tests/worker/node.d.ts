// Minimal Node declarations for the test-only SQLite adapter; the worker project does not
// load @types/node so that Workers globals stay the only runtime types.

declare module 'node:sqlite' {
  type Value = string | number | null;
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: Value[]): unknown;
      run(...params: Value[]): { changes: number | bigint };
    };
  }
}

declare module 'node:fs' {
  export function readFileSync(path: URL, encoding: 'utf8'): string;
}

interface ImportMeta {
  readonly url: string;
}
