import { nanoid } from 'nanoid';
import type { QueryExecResult } from 'sql.js';
import type {
  TimeEntry,
  UserActivityEvent,
  UserActivityEventType,
} from '../types';
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

const INACTIVITY_TIMEOUT_MS = 45000;

export class TimeEntryService extends ServiceBase {
  constructor(csvPath: string) {
    super();
    this._csvPath = csvPath;

    this.registerDisposable({
      dispose: () => {
        if (this._timeEntry) {
          this.storeEntry('dispose', now());
        }
      },
    });
  }

  private readonly _csvPath: string;
  private _debounceTimeout?: NodeJS.Timeout;
  private _timeEntry: TimeEntry | null = null;

  handleEvent = (event: UserActivityEvent) => {
    console.log('[vscode-timespent]', event.type, event.fileUri?.path);

    if (
      this._timeEntry != null &&
      (event.type === 'windowBlur' || !isTagEqual(this._timeEntry, event))
    ) {
      // Note that this clears the entry as well
      this.storeEntry(event.type, event.instant);
    }

    if (this._timeEntry == null && event.type !== 'windowBlur') {
      this._timeEntry = {
        eventType: event.type,
        uid: nanoid(),
        fileUri: event.fileUri,
        gitBranch: event.gitBranch,
        start: event.instant,
      };
    }

    clearTimeout(this._debounceTimeout);

    this._debounceTimeout = setTimeout(() => {
      this.storeEntry('activityTimeout', now());
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

  storeEntry = (endEventType: UserActivityEventType, end: number) => {
    if (this._timeEntry == null) {
      return;
    }

    const { eventType, uid, fileUri, start, gitBranch } = this._timeEntry;
    const { wksp, filePath } = splitUriPath(fileUri);

    const csvRow = [
      uid,
      wksp,
      gitBranch?.name ?? '',
      gitBranch?.commit ?? '',
      filePath,
      `${eventType}:${endEventType}`,
      date(start),
      start,
      end,
      end - start,
    ] as const;

    appendCsvRow(this._csvPath, csvRow);

    this._timeEntry = null;
  };
}
