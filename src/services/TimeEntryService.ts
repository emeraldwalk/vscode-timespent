import { nanoid } from 'nanoid';
import fs from 'node:fs';
import type { Database } from 'sql.js';
import type { TimeEntry, UserActivityEvent } from '../types';
import { ServiceBase } from './ServiceBase';
import { saveDb } from '../utils/storageutils';

const HEARTBEAT_MS = 60000;
const INACTIVITY_TIMEOUT_MS = HEARTBEAT_MS * 1.5;

function now() {
  return new Date().valueOf();
}

export class TimeEntryService extends ServiceBase {
  constructor(db: Database, dbPath: string) {
    super();
    this._db = db;
    this._dbPath = dbPath;

    // Update entry in an interval
    const interval = setInterval(() => {
      if (this._timeEntry) {
        this.storeEntry(false, now());
      }
    }, HEARTBEAT_MS);

    this.registerDisposable({
      dispose: () => {
        clearInterval(interval);

        if (this._timeEntry) {
          this.storeEntry(true, now());
        }
      },
    });
  }

  private readonly _db: Database;
  private readonly _dbPath: string;
  private _debounceTimeout?: NodeJS.Timeout;
  private _timeEntry: TimeEntry | null = null;

  handleEvent = (event: UserActivityEvent) => {
    if (
      this._timeEntry != null &&
      this._timeEntry.fileUri?.toString() !== event.fileUri?.toString()
    ) {
      this.storeEntry(true, event.instant);
      this._timeEntry = null;
    }

    if (this._timeEntry == null) {
      this._timeEntry = {
        uid: nanoid(),
        fileUri: event.fileUri,
        start: event.instant,
      };

      this.storeEntry(false, null);
    }

    clearTimeout(this._debounceTimeout);

    // Once activity timer has been exceeded, clear current time entry.
    // Since activity timer is > heartbeat timer, we should know at least
    // 1 update has been stored
    this._debounceTimeout = setTimeout(() => {
      if (this._timeEntry) {
        this._timeEntry = null;
      }
    }, INACTIVITY_TIMEOUT_MS);
  };

  storeEntry = (finalizeEntry: boolean, end: number | null) => {
    if (this._timeEntry == null) {
      return;
    }

    const { uid, fileUri, start } = this._timeEntry;
    const uri = fileUri?.toString() ?? '';

    console.log(
      end == null ? 'Inserting:' : 'Updating:',
      JSON.stringify(this._timeEntry),
    );

    // Create
    if (end == null) {
      const sql = `INSERT
      INTO time_entries (uid, uri, start)
      VALUES ('${uid}', '${uri}', ${start});`;

      this._db.run(sql);
    }
    // Update
    else {
      const sql = `UPDATE time_entries
         SET
         uri='${uri}',
         start=${start},
         end=${end},
         duration=${end - start}
         WHERE uid='${uid}';`;

      this._db.run(sql);

      if (finalizeEntry) {
        fs.appendFileSync(
          this._dbPath.replace(/\.sqlite$/, '.csv'),
          `${[`"${uid}"`, end - start, start, end, `"${uri}"`].join(',')}\n`,
        );
      }

      saveDb(this._db, this._dbPath);
    }

    if (finalizeEntry) {
      this._timeEntry = null;
    }
  };
}
