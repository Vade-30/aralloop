// Database connection. One query interface over two PostgreSQL drivers:
//
// - DATABASE_URL set   -> a hosted PostgreSQL (Supabase) through `pg`
// - DATABASE_URL unset -> PGlite, a real PostgreSQL embedded in the Node
//   process and stored in .data/pglite, so the app runs with no setup
//
// Both speak the same SQL, so everything above this file is driver-agnostic.
//
// Conventions for callers:
// - Use $1, $2 ... placeholders; never build SQL from user input.
// - jsonb parameters: pass JSON.stringify(value) and cast, e.g. `$3::jsonb`.
//   (`pg` would otherwise send a JS array as a Postgres array.)
// - count(*) is a bigint; select it as `count(*)::int`.
// - timestamptz columns come back as Date objects.

import { mkdirSync } from "node:fs";
import path from "node:path";
import { SCHEMA_SQL } from "./schema";
import { seedIfEmpty } from "./seed";

export type QueryFn = <T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
) => Promise<T[]>;

export interface Db {
  kind: "pglite" | "postgres";
  query: QueryFn;
  /** Runs fn inside one transaction; rolls back if it throws. */
  transaction<T>(fn: (query: QueryFn) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

async function openPglite(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  // "||" so that an empty PGLITE_DIR= line in .env.local means the default too.
  const dir = process.env.PGLITE_DIR?.trim() || ".data/pglite";
  let pg;
  if (dir === "memory") {
    pg = new PGlite();
  } else {
    if (process.env.VERCEL) {
      throw new Error(
        "DATABASE_URL is not set. The embedded database cannot be used on Vercel; set DATABASE_URL to a PostgreSQL connection string.",
      );
    }
    // The folder is only known at run time. The comment tells the bundler not
    // to trace the whole project into the server output because of it.
    const resolved = path.resolve(/* turbopackIgnore: true */ dir);
    mkdirSync(path.dirname(resolved), { recursive: true });
    pg = new PGlite(resolved);
  }
  await pg.waitReady;
  return {
    kind: "pglite",
    query: async <T>(sql: string, params?: unknown[]) =>
      (await pg.query<T>(sql, params)).rows,
    transaction: (fn) =>
      pg.transaction((tx) =>
        fn(async <T>(sql: string, params?: unknown[]) =>
          (await tx.query<T>(sql, params)).rows,
        ),
      ) as Promise<never>,
    close: () => pg.close(),
  };
}

async function openPostgres(connectionString: string): Promise<Db> {
  const { Pool } = await import("pg");
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
  const pool = new Pool({
    connectionString,
    max: 3,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  });
  return {
    kind: "postgres",
    query: async <T>(sql: string, params?: unknown[]) =>
      (await pool.query(sql, params)).rows as T[],
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await fn(
          async <T>(sql: string, params?: unknown[]) =>
            (await client.query(sql, params)).rows as T[],
        );
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

async function open(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  const db = url ? await openPostgres(url) : await openPglite();
  // The schema is a batch of statements, so it cannot go through the
  // parameterised query path on either driver one statement at a time.
  for (const statement of SCHEMA_SQL.split(";")) {
    if (statement.trim()) await db.query(statement);
  }
  await seedIfEmpty(db);
  return db;
}

// Cached on globalThis so Next.js hot reloads and separately bundled routes
// share one connection instead of opening the database again.
const globalForDb = globalThis as unknown as { __aralloopDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!globalForDb.__aralloopDb) {
    globalForDb.__aralloopDb = open().catch((error) => {
      globalForDb.__aralloopDb = undefined;
      throw error;
    });
  }
  return globalForDb.__aralloopDb;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  return (await getDb()).query<T>(sql, params);
}

export async function transaction<T>(
  fn: (query: QueryFn) => Promise<T>,
): Promise<T> {
  return (await getDb()).transaction(fn);
}

/** Tests only: closes the connection so the next getDb() opens a fresh one. */
export async function closeDb(): Promise<void> {
  const pending = globalForDb.__aralloopDb;
  globalForDb.__aralloopDb = undefined;
  if (pending) await (await pending).close();
}
