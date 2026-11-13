import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

// Real SQLite behind the small part of the D1 API the repository uses, with the real
// migrations applied: SQL is tested without a Workers runtime or a new dependency.

type Value = string | number | null;

export function sqliteD1(): D1Database {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../../migrations/0001_init.sql', import.meta.url), 'utf8'));

  const statement = (sql: string, params: Value[] = []) => ({
    bind: (...values: Value[]) => statement(sql, values),
    first: async () => db.prepare(sql).get(...params) ?? null,
    run: async () => {
      const { changes } = db.prepare(sql).run(...params);
      return { success: true, meta: { changes: Number(changes) } };
    },
  });
  return { prepare: (sql: string) => statement(sql) } as unknown as D1Database;
}
