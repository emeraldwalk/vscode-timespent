import * as vscode from 'vscode';
import { type Database } from 'sql.js';
import { ServiceBase } from './ServiceBase';
import type { UserActivityEventType } from '../types';
import { TimeEntryService } from './TimeEntryService';
import { initDb } from '../utils/storageutils';
import { initStorage } from '../utils/storageutils';
import { timeStr } from '../utils/dateUtils';

export class ExtensionController extends ServiceBase {
  constructor() {
    super();

    void this.init();
  }

  private _db: Database | null = null;
  private _outputChannel: vscode.OutputChannel | null = null;
  private _timeEntryService: TimeEntryService | null = null;

  init = async () => {
    const dbPath = initStorage()?.dbPath;
    if (dbPath == null) {
      return;
    }

    this._outputChannel = vscode.window.createOutputChannel('Time Spent');

    this._db = await initDb(dbPath);

    this._timeEntryService = new TimeEntryService(this._db, dbPath);
    this.registerDisposable(this._timeEntryService);

    vscode.window.onDidChangeTextEditorSelection(
      this.onDidUserActivityOccur('editorSelectionChange'),
    );
    vscode.window.onDidChangeActiveTextEditor(
      this.onDidUserActivityOccur('activeTextEditorChange'),
    );

    vscode.commands.registerCommand(
      'time-spent.dailyWorkspaceSummary',
      this.onShowDailyWorkspaceSummary,
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

  onShowDailyWorkspaceSummary = () => {
    if (this._outputChannel == null) {
      return;
    }

    const [result] = this._timeEntryService?.showDailySummary().values() ?? [];
    if (result == null) {
      return;
    }

    this._outputChannel.show(true);

    let curDateStr: string | null = null;
    for (const [date, filePath, fileTotal, dailyTotal] of result.values) {
      const dateStr = new Date(Number(date)).toISOString().substring(0, 10);
      if (dateStr !== curDateStr) {
        const dailyTotalM = timeStr(dailyTotal);
        this._outputChannel.appendLine(
          `--- ${dateStr} ---\n${dailyTotalM} - Total\n------------------`,
        );
      }

      curDateStr = dateStr;

      this._outputChannel.appendLine(
        [timeStr(fileTotal), filePath].join(' - '),
      );
    }
  };
}
