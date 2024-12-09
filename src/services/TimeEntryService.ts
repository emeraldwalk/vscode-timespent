import { nanoid } from 'nanoid';
import type { QueryExecResult } from 'sql.js';
import type { TimeEntry, UserActivityEvent } from '../types';
import { ServiceBase } from './ServiceBase';
import {
  appendCsvRow,
  dailySummary,
  initDbFromCsv,
  splitUriPath,
  timeEntries,
} from '../utils/storageutils';
import { date, now } from '../utils/dateUtils';
import { isTagEqual } from '../utils/tagUtils';

const HEARTBEAT_MS = 60000;
const INACTIVITY_TIMEOUT_MS = HEARTBEAT_MS * 1.5;

export class TimeEntryService extends ServiceBase {
  constructor(csvPath: string) {
    super();
    this._csvPath = csvPath;

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

  private readonly _csvPath: string;
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

  showDailySummary = async (): Promise<QueryExecResult[]> => {
    const db = await initDbFromCsv(this._csvPath);
    return dailySummary(db);
  };

  showTimeEntries = async (): Promise<QueryExecResult[]> => {
    const db = await initDbFromCsv(this._csvPath);
    return timeEntries(db);
  };

  storeEntry = (finalizeEntry: boolean, end: number | null) => {
    if (this._timeEntry == null) {
      return;
    }

    const { uid, fileUri, start, gitBranch } = this._timeEntry;
    const { wksp, filePath } = splitUriPath(fileUri);

    // Update
    if (end != null) {
      const csvRow = [
        uid,
        wksp,
        gitBranch?.name ?? '',
        gitBranch?.commit ?? '',
        filePath,
        date(start),
        start,
        end,
        end - start,
      ] as const;

      appendCsvRow(this._csvPath, csvRow);
    }

    if (finalizeEntry) {
      this._timeEntry = null;
    }
  };
}
