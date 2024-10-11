import { nanoid } from 'nanoid';
import type { TimeEntry, UserActivityEvent } from '../types';
import type { Database } from 'sql.js';
import { ServiceBase } from './ServiceBase';
import { saveDb } from '../utils/dbUtils';

const DEBOUNCE_TIMEOUT_MS = 60000;

export class TimeEntryService extends ServiceBase {
  constructor(db: Database, dbPath: string) {
    super();
    this._db = db;
    this._dbPath = dbPath;
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
      this._timeEntry.end = new Date().valueOf();
      this.storeEntry();
      this._timeEntry = undefined;
    }

    if (this._timeEntry == null) {
      this._timeEntry = {
        uid: nanoid(),
        fileUri: event.fileUri,
        start: event.instant,
      };

      this.storeEntry();
    }

    clearTimeout(this._debounceTimeout);

    this._debounceTimeout = setTimeout(() => {
      if (this._timeEntry) {
        this._timeEntry.end = new Date().valueOf() - DEBOUNCE_TIMEOUT_MS;
        this.storeEntry();
      }
    }, DEBOUNCE_TIMEOUT_MS);
  };

  storeEntry = () => {
    if (this._timeEntry == null) {
      return;
    }

    if (this._timeEntry.end == null) {
      const { uid, fileUri, start } = this._timeEntry;
      const uri = fileUri?.toString() ?? '';

      const sql = `INSERT
      INTO time_entries (uid, uri, start)
      VALUES ('${uid}', '${uri}', ${start});`;
      console.log('Running:', sql);

      this._db.run(sql);
    } else {
      const { uid, fileUri, start, end } = this._timeEntry;
      const uri = fileUri?.toString() ?? '';

      const sql = `UPDATE time_entries
         SET
         uri='${uri}',
         start=${start},
         end=${end},
         duration=${end - start}
         WHERE uid='${uid}';`;

      console.log('Running:', sql);

      this._db.run(sql);

      this._timeEntry = undefined;

      saveDb(this._db, this._dbPath);
    }
  };
}
