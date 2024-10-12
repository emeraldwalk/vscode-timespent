import * as vscode from 'vscode';
import { type Database } from 'sql.js';
import { ServiceBase } from './ServiceBase';
import type { UserActivityEventType } from '../types';
import { TimeEntryService } from './TimeEntryService';
import { initDb } from '../utils/dbUtils';
import { initStorage } from '../utils/storageutils';

export class ExtensionController extends ServiceBase {
  constructor() {
    super();

    void this.init();
  }

  private _db: Database | null = null;
  private _timeEntryService: TimeEntryService | null = null;

  init = async () => {
    const dbPath = initStorage()?.dbPath;
    if (dbPath == null) {
      return;
    }

    this._db = await initDb(dbPath);

    this._timeEntryService = new TimeEntryService(this._db, dbPath);
    this.registerDisposable(this._timeEntryService);

    vscode.window.onDidChangeTextEditorSelection(
      this.onDidUserActivityOccur('editorSelectionChange'),
    );
    vscode.window.onDidChangeActiveTextEditor(
      this.onDidUserActivityOccur('activeTextEditorChange'),
    );

    this.onDidUserActivityOccur('extensionInit')();
  };

  onDidUserActivityOccur = (eventType: UserActivityEventType) => {
    return () => {
      const fileUri = vscode.window.activeTextEditor?.document.uri;

      // In cases where file path is undefined, there should be a corresponding
      // event where it is defined as the new editor gets focus. Skip the extra.
      if (eventType === 'activeTextEditorChange' && fileUri == null) {
        return;
      }

      this._timeEntryService?.handleEvent({
        type: eventType,
        fileUri,
        instant: new Date().valueOf(),
      });
    };
  };
}
