import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { PaymentMethod, PaymentProvider } from "./types";

type OrderRow = {
  id: string;
  user_id: string;
  package_id: string;
  amount_cents: number;
  points: number;
  provider: string | null;
  payment_method: string | null;
  status: string;
  provider_order_id: string | null;
  provider_trade_no: string | null;
  idempotency_key: string | null;
  notify_payload: string | null;
  fail_reason: string | null;
  created_at: number;
  paid_at: number | null;
  closed_at: number | null;
};

function ensureOrderColumns(db: Database.Database) {
  const columns = db.prepare("PRAGMA table_info(orders)").all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));
  const requiredColumns: Array<[string, string]> = [
    ["provider", "TEXT"],
    ["payment_method", "TEXT"],
    ["provider_trade_no", "TEXT"],
    ["idempotency_key", "TEXT"],
    ["notify_payload", "TEXT"],
    ["fail_reason", "TEXT"],
    ["closed_at", "INTEGER"]
  ];
  const missingColumns = requiredColumns.filter(([name]) => !columnNames.has(name));

  for (const [name, definition] of missingColumns) {
    db.exec(`ALTER TABLE orders ADD COLUMN ${name} ${definition}`);
  }
}

export function preparePaymentDb(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      points_balance INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      package_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      points INTEGER NOT NULL,
      status TEXT NOT NULL,
      provider_order_id TEXT,
      created_at INTEGER NOT NULL,
      paid_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS point_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      points INTEGER NOT NULL,
      amount_cents INTEGER,
      reference_id TEXT,
      note TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_paid_order_ledger ON point_transactions(reference_id, type)
      WHERE type = 'recharge';
  `);

  ensureOrderColumns(db);
}

export function createPendingOrder(
  db: Database.Database,
  input: {
    id: string;
    userId: string;
    packageId: string;
    amountCents: number;
    points: number;
    provider: PaymentProvider;
    paymentMethod: PaymentMethod;
  }
) {
  preparePaymentDb(db);

  const now = Date.now();
  db.prepare(
    `INSERT INTO orders (
      id, user_id, package_id, amount_cents, points, provider, payment_method, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).run(
    input.id,
    input.userId,
    input.packageId,
    input.amountCents,
    input.points,
    input.provider,
    input.paymentMethod,
    now
  );

  return db.prepare("SELECT * FROM orders WHERE id = ?").get(input.id) as OrderRow;
}

export function applyPaidOrder(
  db: Database.Database,
  input: {
    orderId: string;
    providerTradeNo: string;
    notifyPayload: string;
    paidAt: number;
  }
) {
  preparePaymentDb(db);

  return db.transaction(() => {
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(input.orderId) as OrderRow | undefined;
    if (!order || order.status === "paid") {
      return { applied: false };
    }

    const changed = db.prepare(
      "UPDATE orders SET status = 'paid', provider_trade_no = ?, notify_payload = ?, paid_at = ? WHERE id = ? AND status IN ('pending', 'paying')"
    ).run(input.providerTradeNo, input.notifyPayload, input.paidAt, input.orderId).changes;

    if (!changed) {
      return { applied: false };
    }

    db.prepare("UPDATE users SET points_balance = points_balance + ? WHERE id = ?").run(order.points, order.user_id);
    db.prepare(
      `INSERT INTO point_transactions (id, user_id, type, points, amount_cents, reference_id, note, created_at)
       VALUES (?, ?, 'recharge', ?, ?, ?, '套餐充值到账', ?)`
    ).run(randomUUID(), order.user_id, order.points, order.amount_cents, order.id, input.paidAt);

    return { applied: true };
  })();
}
