import { nanoid } from 'nanoid';
import fs from 'node:fs';
import type { Database } from 'sql.js';
import type { TimeEntry, UserActivityEvent } from '../types';
import { ServiceBase } from './ServiceBase';
import { saveDb } from '../utils/dbUtils';

const DEBOUNCE_TIMEOUT_MS = 60000;

export class TimeEntryService extends ServiceBase {
  constructor(db: Database, dbPath: string) {
    super();
    this._db = db;
    this._dbPath = dbPath;

    this.registerDisposable({
      dispose: () => {
        this.storeEntry(true);
      },
    });
  }

  private readonly _db: Database;
  private readonly _dbPath: string;
  private _debounceTimeout?: NodeJS.Timeout;
  private _timeEntry?: TimeEntry;

  handleEvent = (event: UserActivityEvent) => {
    if (
      this._timeEntry != null &&
      this._timeEntry.fileUri?.toString() !== event.fileUri?.toString()
    ) {
      this._timeEntry.end = event.instant;
      this.storeEntry(true);
      this._timeEntry = undefined;
    }

    if (this._timeEntry == null) {
      this._timeEntry = {
        uid: nanoid(),
        fileUri: event.fileUri,
        start: event.instant,
      };

      this.storeEntry(false);
    }

    clearTimeout(this._debounceTimeout);

    this._debounceTimeout = setTimeout(() => {
      if (this._timeEntry) {
        this._timeEntry.end = new Date().valueOf() - DEBOUNCE_TIMEOUT_MS;
        this.storeEntry(true);
      }
    }, DEBOUNCE_TIMEOUT_MS);
  };

  storeEntry = (clearAfterUpdate: boolean) => {
    if (this._timeEntry == null) {
      return;
    }

    // Create
    if (this._timeEntry.end == null) {
      const { uid, fileUri, start } = this._timeEntry;
      const uri = fileUri?.toString() ?? '';

      const sql = `INSERT
      INTO time_entries (uid, uri, start)
      VALUES ('${uid}', '${uri}', ${start});`;
      console.log('Running:', sql);

      this._db.run(sql);
    }
    // Update
    else {
      const { uid, fileUri, start, end } = this._timeEntry;
      const uri = fileUri?.fsPath.toString() ?? '';

      const sql = `UPDATE time_entries
         SET
         uri='${uri}',
         start=${start},
         end=${end},
         duration=${end - start}
         WHERE uid='${uid}';`;

      console.log('Running:', sql);

      this._db.run(sql);

      fs.appendFileSync(
        this._dbPath.replace(/\.sqlite$/, '.csv'),
        `${[`"${uid}"`, end - start, start, end, `"${uri}"`].join(',')}\n`,
      );

      saveDb(this._db, this._dbPath);
    }

    if (clearAfterUpdate) {
      this._timeEntry = undefined;
    }
  };
}
