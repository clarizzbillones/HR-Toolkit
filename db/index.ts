import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_URL?.replace('file:', '') ?? path.join(process.cwd(), 'db', 'data.db');

// Ensure directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  migrate(_db);
  return _db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      sub TEXT,
      due_tag TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      status_history TEXT NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pto_entries (
      id TEXT PRIMARY KEY,
      employee TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'PTO',
      start_date TEXT,
      end_date TEXT,
      days REAL,
      status TEXT NOT NULL DEFAULT 'Approved',
      source_file TEXT,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      dept TEXT NOT NULL DEFAULT 'Operations',
      birthday TEXT,
      anniversary_date TEXT,
      anniversary_years INTEGER,
      review_6mo_status TEXT,
      review_6mo_date TEXT,
      review_6mo_reviewer TEXT,
      review_6mo_summary TEXT,
      review_1yr_status TEXT,
      review_1yr_date TEXT,
      review_1yr_reviewer TEXT,
      review_1yr_summary TEXT,
      external_review_url TEXT,
      hire_date TEXT,
      review_notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payroll_periods (
      id TEXT PRIMARY KEY,
      run_date TEXT NOT NULL,
      period TEXT NOT NULL,
      cutoff TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Upcoming',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payroll_settings (
      id TEXT PRIMARY KEY DEFAULT 'singleton',
      cadence TEXT NOT NULL DEFAULT 'Semi-monthly',
      reminder_toggles TEXT NOT NULL DEFAULT '{"cutoff":true,"payrun":true,"timesheet":false}'
    );

    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      who TEXT NOT NULL,
      detail TEXT NOT NULL,
      cost REAL,
      matter TEXT,
      status TEXT NOT NULL DEFAULT 'Pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS insurance_invoices (
      id TEXT PRIMARY KEY,
      carrier TEXT NOT NULL,
      invoice_type TEXT,
      amount REAL NOT NULL,
      deadline TEXT NOT NULL,
      coverage_period TEXT,
      enrolled_count INTEGER,
      attachments TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reimbursements (
      id TEXT PRIMARY KEY,
      employee TEXT NOT NULL,
      purpose TEXT NOT NULL,
      amount REAL NOT NULL,
      payout_date TEXT,
      attachments TEXT NOT NULL DEFAULT '[]',
      receipts TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contractor_payments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      due_date TEXT,
      paid_date TEXT,
      amount REAL NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS overtime (
      id TEXT PRIMARY KEY,
      employee TEXT NOT NULL,
      hours REAL NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cashout_ledger (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      payee TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Paid',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id TEXT PRIMARY KEY DEFAULT 'singleton',
      firm_name TEXT NOT NULL DEFAULT 'Litson',
      payroll_cadence TEXT NOT NULL DEFAULT 'Semi-monthly',
      external_review_dashboard TEXT,
      letterhead_image TEXT,
      signature_image TEXT
    );

    CREATE TABLE IF NOT EXISTS integration_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, provider)
    );

    CREATE TABLE IF NOT EXISTS next_auth_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      refresh_token TEXT,
      access_token TEXT,
      expires_at INTEGER,
      token_type TEXT,
      scope TEXT,
      id_token TEXT,
      session_state TEXT,
      UNIQUE(provider, provider_account_id)
    );

    CREATE TABLE IF NOT EXISTS next_auth_sessions (
      id TEXT PRIMARY KEY,
      session_token TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      expires TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS next_auth_users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      email_verified TEXT,
      image TEXT
    );

    CREATE TABLE IF NOT EXISTS next_auth_verification_tokens (
      identifier TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires TEXT NOT NULL,
      UNIQUE(identifier, token)
    );
  `);
}

export function cuid(): string {
  return 'c' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
