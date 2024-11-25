import { nanoid } from 'nanoid';
import fs from 'node:fs';
import type { Database, QueryExecResult } from 'sql.js';
import type { TimeEntry, UserActivityEvent } from '../types';
import { ServiceBase } from './ServiceBase';
import {
  dailySummary,
  flushDb,
  splitUriPath,
  timeEntries,
} from '../utils/storageutils';
import { date, now } from '../utils/dateUtils';
import { isTagEqual } from '../utils/tagUtils';

const HEARTBEAT_MS = 60000;
const INACTIVITY_TIMEOUT_MS = HEARTBEAT_MS * 1.5;

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
    if (this._timeEntry != null && !isTagEqual(this._timeEntry, event)) {
      this.storeEntry(true, event.instant);
      this._timeEntry = null;
    }

    if (this._timeEntry == null) {
      this._timeEntry = {
        uid: nanoid(),
        fileUri: event.fileUri,
        gitBranch: event.gitBranch,
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

  showDailySummary = (): QueryExecResult[] => {
    return dailySummary(this._db);
  };

  showTimeEntries = (): QueryExecResult[] => {
    return timeEntries(this._db);
  };

  storeEntry = (finalizeEntry: boolean, end: number | null) => {
    if (this._timeEntry == null) {
      return;
    }

    const { uid, fileUri, start, gitBranch } = this._timeEntry;
    const { wksp, filePath } = splitUriPath(fileUri);

    console.log(
      end == null ? 'Inserting:' : 'Updating:',
      JSON.stringify(this._timeEntry),
    );

    // Create
    if (end == null) {
      const sql = `INSERT
      INTO time_entries (uid, workspacePath, filePath, gitCommit, gitBranch, date, start)
      VALUES ('${uid}', '${wksp}', '${filePath}', '${
        gitBranch?.commit ?? ''
      }', '${gitBranch?.name ?? ''}', ${date(start)}, ${start});`;

      this._db.run(sql);
    }
    // Update
    else {
      const sql = `UPDATE time_entries
         SET
         end=${end},
         duration=${end - start}
         WHERE uid='${uid}';`;

      this._db.run(sql);

      flushDb(this._db, this._dbPath, false);
    }

    if (finalizeEntry) {
      this._timeEntry = null;
    }
  };
}
