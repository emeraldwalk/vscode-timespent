import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { type Database } from 'sql.js';

export async function initDb(filePath: string): Promise<Database> {
  const SQL = await initSqlJs();

  if (fs.existsSync(filePath)) {
    const filebuffer = fs.readFileSync(filePath);
    return new SQL.Database(filebuffer);
  }

  const db = new SQL.Database();

  db.run(
    `CREATE TABLE time_entries (
      id integer primary key,
      uid text,
      uri text,
      start integer,
      end integer,
      duration integer
    );`,
  );

  saveDb(db, filePath);

  return db;
}

export function saveDb(db: Database, filePath: string): void {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(filePath, buffer);
}
