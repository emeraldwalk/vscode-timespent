import { nanoid } from 'nanoid';
import type { TimeEntry, UserActivityEvent } from '../types';

export class TimeEntryService {
  private _debounceTimeout?: NodeJS.Timeout;
  private _timeEntry?: TimeEntry;

  handleEvent = (event: UserActivityEvent) => {
    if (
      this._timeEntry != null &&
      this._timeEntry.fileUri?.toString() !== event.fileUri?.toString()
    ) {
      this.storeEntry();
      this._timeEntry = undefined;
    }

    if (this._timeEntry == null) {
      this._timeEntry = {
        id: nanoid(),
        fileUri: event.fileUri,
        start: event.instant,
      };

      this.storeEntry();
    }

    clearTimeout(this._debounceTimeout);

    this._debounceTimeout = setTimeout(() => {
      if (this._timeEntry) {
        this._timeEntry.end = new Date().valueOf();
        this.storeEntry();
      }
    }, 3000);
  };

  storeEntry = () => {
    if (this._timeEntry == null) {
      return;
    }

    if (this._timeEntry.end == null) {
      console.log('[TESTING] insert', this._timeEntry);
    } else {
      console.log('[TESTING] update', this._timeEntry);
      this._timeEntry = undefined;
    }
  };
}
