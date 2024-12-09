import * as vscode from 'vscode';
import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { type Database, type QueryExecResult } from 'sql.js';
import type { SplitPaths } from '../types';

export function dailySummary(db: Database): QueryExecResult[] {
  return db.exec(
    `SELECT
      date,
      workspacePath,
      filePath,
      gitBranch,
      fileTotal,
      SUM(fileTotal) OVER(PARTITION BY date) as dailyTotal,
      SUM(fileTotal) OVER(PARTITION BY date, workspacePath) as dailyWkspTotal
    FROM (
      SELECT date,
      workspacePath,
      filePath,
      gitBranch,
      SUM(duration) as fileTotal,
      SUM(duration) OVER(PARTITION BY date)
      FROM time_entries
      GROUP BY date, filePath, gitBranch
    )
    ORDER BY date DESC, workspacePath, gitBranch, filePath;`,
  );
}

export function timeEntries(db: Database): QueryExecResult[] {
  return db.exec(`SELECT * FROM time_entries ORDER BY start;`);
}

export function initStorage(storageDir?: string): {
  storageDir: string;
  csvPath: string;
} | null {
  if (storageDir == null) {
    return null;
  }

  storageDir = path.join(storageDir, '_timespent');
  const csvPath = path.join(storageDir, 'timespent.csv');

  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
    fs.writeFileSync(path.join(storageDir, '.gitignore'), '*\n');
  }

  return { storageDir, csvPath };
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
      gitBranch text,
      gitCommit text,
      filePath text,
      date integer,
      start integer,
      end integer,
      duration integer
    );`,
  );

  flushDb(db, filePath, true);

  return db;
}

/**
 * Initialize an in-memory SQLITE database from a CSV file.
 * @param csvFilePath
 * @returns
 */
export async function initDbFromCsv(csvFilePath: string): Promise<Database> {
  const SQL = await initSqlJs();

  const db = new SQL.Database();

  db.run(
    `CREATE TABLE time_entries (
      id integer primary key,
      uid text,
      workspacePath text,
      gitBranch text,
      gitCommit text,
      filePath text,
      date integer,
      start integer,
      end integer,
      duration integer
    );`,
  );

  const sql = `INSERT
  INTO time_entries (uid, workspacePath, gitBranch, gitCommit, filePath, date, start, end, duration)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`;

  const csv = fs.readFileSync(csvFilePath, 'utf-8').split('\n');
  csv.shift(); // Remove header

  for (const line of csv) {
    const values = line.split(',');
    if (values.length === 9) {
      db.run(
        sql,
        values.map(v => v.replace(/^"|"$/g, '')),
      );
    }
  }

  return db;
}

export function flushDb(
  db: Database,
  filePath: string,
  createIfNotExists: boolean,
): void {
  if (!createIfNotExists && !fs.existsSync(filePath)) {
    return;
  }

  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(filePath, buffer);
}

/**
 * Append csv row to given path.
 * @param filePath
 * @param row
 */
export function appendCsvRow(
  filePath: string,
  row: readonly [
    string,
    string,
    string,
    string,
    string,
    number,
    number,
    number,
    number,
  ],
): void {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(
      filePath,
      'uid,workspacePath,gitBranch,gitCommit,filePath,date,start,end,duration\n',
    );
  }

  const csvRow = row.map(v => (typeof v === 'string' ? `"${v}"` : v)).join(',');
  fs.appendFileSync(filePath, `${csvRow}\n`);
}

/**
 * Split Uri path into wksp and relative path components.
 */
export function splitUriPath(uri?: vscode.Uri): SplitPaths {
  const wkspFolder =
    uri?.scheme === 'file'
      ? vscode.workspace.workspaceFolders?.find(path =>
          uri?.fsPath.startsWith(path.uri.fsPath),
        )
      : // This happens when output panels are selected
        vscode.workspace.workspaceFolders?.[0];

  const wkspPath = wkspFolder?.uri.fsPath ?? '';

  const filePath =
    uri?.scheme === 'file'
      ? uri.fsPath.substring(wkspPath.length + 1)
      : uri?.fsPath;

  return {
    wksp: wkspPath,
    filePath: filePath ?? '',
  };
}
