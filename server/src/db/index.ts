import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dataDir = path.join(__dirname, "..", "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "prospect.db");
export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
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

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
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
`);

export default db;
