import * as vscode from 'vscode';
import { type Database } from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { ServiceBase } from './ServiceBase';
import type { UserActivityEventType } from '../types';
import { TimeEntryService } from './TimeEntryService';
import { initDb } from '../utils/dbUtils';

export class ExtensionController extends ServiceBase {
  constructor() {
    super();

    void this.init();
  }

  private _db: Database | null = null;
  private _timeEntryService: TimeEntryService | null = null;

  init = async () => {
    const wkspPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (wkspPath == null) {
      return;
    }

    const storageDir = path.join(wkspPath, '.vscode', '_timespent');
    const dbPath = path.join(storageDir, 'timespent.sqlite');

    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
      fs.writeFileSync(path.join(storageDir, '.gitignore'), '*\n');
      fs.writeFileSync(
        dbPath.replace(/\.sqlite$/, '.csv'),
        'UID,Elapsed,Start,End,Uri\n',
      );
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
