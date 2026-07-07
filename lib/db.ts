import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });

const globalForDb = globalThis as unknown as { subtitleDb?: Database.Database };

function getColumnNames(db: Database.Database, tableName: string) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return new Set(columns.map((column) => column.name));
}

function addColumnIfMissing(
  db: Database.Database,
  tableName: string,
  columnName: string,
  definition: string
) {
  const columnNames = getColumnNames(db, tableName);
  if (!columnNames.has(columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

export const db = globalForDb.subtitleDb ?? new Database(path.join(dataDir, "subtitle-clear.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    points_balance INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_name TEXT NOT NULL,
    video_ref TEXT NOT NULL,
    duration_estimate_sec REAL NOT NULL,
    mode TEXT NOT NULL CHECK(mode IN ('standard', 'pro')),
    options_json TEXT NOT NULL DEFAULT '{}',
    reserved_points INTEGER NOT NULL,
    final_points INTEGER,
    provider_task_id TEXT,
    status TEXT NOT NULL,
    result_url TEXT,
    provider_error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS point_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    points INTEGER NOT NULL,
    amount_cents INTEGER,
    reference_id TEXT,
    note TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    package_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    points INTEGER NOT NULL,
    provider TEXT,
    payment_method TEXT,
    status TEXT NOT NULL,
    provider_order_id TEXT,
    provider_trade_no TEXT,
    idempotency_key TEXT,
    notify_payload TEXT,
    fail_reason TEXT,
    created_at INTEGER NOT NULL,
    paid_at INTEGER,
    closed_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_jobs_user_created ON jobs(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_paid_order_ledger ON point_transactions(reference_id, type)
    WHERE type = 'recharge';

  -- 视频号助手授权联动表（与 lib/helper-auth.ts、lib/helper-license.ts 对齐）
  CREATE TABLE IF NOT EXISTS helper_access_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS helper_memberships (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL,
    status TEXT NOT NULL,
    starts_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS helper_trial_usage (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    used_count INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, device_id)
  );

  CREATE TABLE IF NOT EXISTS helper_download_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    video_count INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_helper_tokens_user ON helper_access_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_helper_tokens_expiry ON helper_access_tokens(expires_at);
  CREATE INDEX IF NOT EXISTS idx_helper_events_user_created ON helper_download_events(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS email_verifications (
    email TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
`);

addColumnIfMissing(db, "users", "email_verified", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing(db, "orders", "provider", "TEXT");
addColumnIfMissing(db, "orders", "payment_method", "TEXT");
addColumnIfMissing(db, "orders", "provider_trade_no", "TEXT");
addColumnIfMissing(db, "orders", "idempotency_key", "TEXT");
addColumnIfMissing(db, "orders", "notify_payload", "TEXT");
addColumnIfMissing(db, "orders", "fail_reason", "TEXT");
addColumnIfMissing(db, "orders", "closed_at", "INTEGER");

if (process.env.NODE_ENV !== "production") globalForDb.subtitleDb = db;
