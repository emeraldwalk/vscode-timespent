import * as vscode from 'vscode';
import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { type Database } from 'sql.js';
import type { SplitPaths } from '../types';

export function initStorage(): {
  storageDir: string;
  dbPath: string;
  csvPath: string;
} | null {
  const wkspPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  if (wkspPath == null) {
    return null;
  }

  const storageDir = path.join(wkspPath, '.vscode', '_timespent');
  const dbPath = path.join(storageDir, 'timespent.sqlite');
  const csvPath = path.join(storageDir, 'timespent.csv');

  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
    fs.writeFileSync(path.join(storageDir, '.gitignore'), '*\n');
    fs.writeFileSync(
      dbPath.replace(/\.sqlite$/, '.csv'),
      'UID,Date,Elapsed,Start,End,Wksp,Path\n',
    );
  }

  return { storageDir, dbPath, csvPath };
}

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
      workspacePath text,
      filePath text,
      date integer,
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

/**
 * Split Uri path into wksp and relative path components.
 */
export function splitUriPath(uri?: vscode.Uri): SplitPaths {
  const wkspPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  if (wkspPath == null) {
    return {
      wksp: '',
      filePath: uri?.fsPath ?? '',
    };
  }

  return {
    wksp: wkspPath,
    filePath: uri?.fsPath.substring(wkspPath.length + 1) ?? '',
  };
}
