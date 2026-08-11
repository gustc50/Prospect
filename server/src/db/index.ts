import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import path from "path";
import fs from "fs";

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export interface PreparedStatement {
  run(...args: unknown[]): RunResult;
  get(...args: unknown[]): any;
  all(...args: unknown[]): any[];
}

export interface CompatDb {
  prepare(sql: string): PreparedStatement;
  exec(sql: string): void;
  pragma(pragma: string): void;
  transaction<T extends (...args: any[]) => any>(fn: T): T;
}

// Converte os parâmetros no estilo better-sqlite3 (objeto único = parâmetros nomeados
// via "@campo", ou argumentos posicionais = "?") para o formato que o sql.js espera.
function toBindParams(args: unknown[]): unknown[] | Record<string, unknown> {
  if (args.length === 1 && args[0] !== null && typeof args[0] === "object" && !Array.isArray(args[0])) {
    const prefixed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(args[0] as Record<string, unknown>)) {
      prefixed[`@${key}`] = value ?? null;
    }
    return prefixed;
  }
  return args.map((a) => a ?? null);
}

class CompatDbImpl implements CompatDb {
  // sql.js's export() flushes/closes out the current transaction state, so we must
  // never call save() (which exports) while a BEGIN...COMMIT is still in flight —
  // only once the transaction itself finishes.
  private inTransaction = false;

  constructor(private raw: SqlJsDatabase, private dbPath: string) {}

  prepare(sql: string): PreparedStatement {
    const raw = this.raw;
    const maybeSave = () => {
      if (!this.inTransaction) this.save();
    };

    return {
      run(...args: unknown[]): RunResult {
        const stmt = raw.prepare(sql);
        stmt.bind(toBindParams(args) as any);
        stmt.step();
        stmt.free();
        const changes = raw.getRowsModified();
        let lastInsertRowid = 0;
        const idResult = raw.exec("SELECT last_insert_rowid() AS id");
        if (idResult.length) lastInsertRowid = Number(idResult[0].values[0][0]);
        maybeSave();
        return { changes, lastInsertRowid };
      },
      get(...args: unknown[]) {
        const stmt = raw.prepare(sql);
        stmt.bind(toBindParams(args) as any);
        let row: Record<string, unknown> | undefined;
        if (stmt.step()) row = stmt.getAsObject();
        stmt.free();
        return row;
      },
      all(...args: unknown[]) {
        const stmt = raw.prepare(sql);
        stmt.bind(toBindParams(args) as any);
        const rows: Record<string, unknown>[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
      },
    };
  }

  exec(sql: string) {
    this.raw.exec(sql);
    if (!this.inTransaction) this.save();
  }

  pragma(pragma: string) {
    this.raw.exec(`PRAGMA ${pragma}`);
  }

  transaction<T extends (...args: any[]) => any>(fn: T): T {
    const raw = this.raw;
    const self = this;
    return function (this: unknown, ...args: unknown[]) {
      raw.exec("BEGIN");
      self.inTransaction = true;
      try {
        const result = fn.apply(this, args);
        raw.exec("COMMIT");
        self.inTransaction = false;
        self.save();
        return result;
      } catch (err) {
        self.inTransaction = false;
        try {
          raw.exec("ROLLBACK");
        } catch {
          // ignore: the transaction may already have been aborted by the original error
        }
        throw err;
      }
    } as T;
  }

  save() {
    // db.export() flushes/reopens sql.js's internal connection as a side effect,
    // which resets connection-level PRAGMAs (like foreign_keys) back to their
    // SQLite defaults (OFF). Re-apply them immediately so cascading deletes keep
    // working on the next statement.
    const data = Buffer.from(this.raw.export());
    fs.writeFileSync(this.dbPath, data);
    this.raw.exec("PRAGMA foreign_keys = ON");
  }
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    segment TEXT DEFAULT '',
    description TEXT DEFAULT '',
    products_services TEXT DEFAULT '',
    differentials TEXT DEFAULT '',
    target_audience TEXT DEFAULT '',
    tone_of_voice TEXT DEFAULT 'consultivo e cordial',
    website TEXT DEFAULT '',
    contact_info TEXT DEFAULT '',
    qualification_criteria TEXT DEFAULT '',
    goal TEXT DEFAULT 'Agendar uma reunião de apresentação com o lead qualificado.',
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    source TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'novo',
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    llm_provider TEXT NOT NULL DEFAULT 'anthropic',
    model TEXT DEFAULT '',
    questions TEXT NOT NULL DEFAULT '[]',
    objections TEXT NOT NULL DEFAULT '[]',
    extra_instructions TEXT DEFAULT '',
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'aberta',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('lead','assistant','system')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

// Bancos criados por versões anteriores do app não têm a coluna "agent_id" em
// "conversations" (ela foi adicionada depois) — o CREATE TABLE IF NOT EXISTS acima não
// altera tabelas já existentes, então aplicamos essa migração manualmente aqui.
function ensureColumn(db: CompatDb, table: string, column: string, columnDefinition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDefinition}`);
  }
}

export async function initDb(): Promise<CompatDb> {
  const dataDir = path.join(__dirname, "..", "..", "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.join(dataDir, "prospect.db");

  const SQL = await initSqlJs();
  const raw = fs.existsSync(dbPath) ? new SQL.Database(fs.readFileSync(dbPath)) : new SQL.Database();

  const db = new CompatDbImpl(raw, dbPath);
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  ensureColumn(db, "conversations", "agent_id", "agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL");

  return db;
}
