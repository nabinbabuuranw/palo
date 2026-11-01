// Minimal D1 stand-in over node:sqlite for unit tests (the API surface the worker uses).
import { DatabaseSync } from 'node:sqlite';
class Stmt {
  db: any; sql: string; args: any[];
  constructor(db: any, sql: string, args: any[] = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...a: any[]) { return new Stmt(this.db, this.sql, a); }
  _s() { return this.db.prepare(this.sql); }
  async first(col?: string) { const r = this._s().get(...this.args); if (!r) return null; return col ? r[col] : { ...r }; }
  async all() { return { results: this._s().all(...this.args).map((r: any) => ({ ...r })), success: true }; }
  async run() { const r = this._s().run(...this.args); return { success: true, meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; }
  _runSync() { const s = this._s(); return /^\s*(SELECT|[\s\S]*RETURNING)/i.test(this.sql) ? s.all(...this.args) : s.run(...this.args); }
}
export class D1Shim {
  db: any;
  constructor() { this.db = new DatabaseSync(':memory:'); this.db.exec('PRAGMA foreign_keys = ON'); }
  prepare(sql: string) { return new Stmt(this.db, sql); }
  async batch(stmts: Stmt[]) {
    this.db.exec('BEGIN');
    try { const out = stmts.map((s) => ({ results: [].concat(s._runSync()) })); this.db.exec('COMMIT'); return out; }
    catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
}
