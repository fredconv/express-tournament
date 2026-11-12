// Only file that contains SQL (AGENTS.md §4).

export interface StoredTournament {
  id: string;
  ownerTokenHash: string;
  doc: string;
  version: number;
  updatedAt: string;
}

interface Row {
  id: string;
  owner_token_hash: string;
  doc: string;
  version: number;
  updated_at: string;
}

export async function insertTournament(
  db: D1Database,
  t: { id: string; ownerTokenHash: string; doc: string; now: string; expiresAt: string },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO tournaments (id, owner_token_hash, doc, version, created_at, updated_at, expires_at)
       VALUES (?, ?, ?, 1, ?, ?, ?)`,
    )
    .bind(t.id, t.ownerTokenHash, t.doc, t.now, t.now, t.expiresAt)
    .run();
}

export async function findTournament(db: D1Database, id: string): Promise<StoredTournament | null> {
  const row = await db
    .prepare('SELECT id, owner_token_hash, doc, version, updated_at FROM tournaments WHERE id = ?')
    .bind(id)
    .first<Row>();
  return row
    ? {
        id: row.id,
        ownerTokenHash: row.owner_token_hash,
        doc: row.doc,
        version: row.version,
        updatedAt: row.updated_at,
      }
    : null;
}

/** Replaces the document if `version` is still current; returns false on a conflict. */
export async function updateTournament(
  db: D1Database,
  t: { id: string; version: number; doc: string; now: string; expiresAt: string },
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE tournaments SET doc = ?, version = version + 1, updated_at = ?, expires_at = ?
       WHERE id = ? AND version = ?`,
    )
    .bind(t.doc, t.now, t.expiresAt, t.id, t.version)
    .run();
  return result.meta.changes === 1;
}
