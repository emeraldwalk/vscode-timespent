import * as vscode from 'vscode';
import * as fs from 'node:fs';
import { type Database } from 'sql.js';
import { ServiceBase } from './ServiceBase';
import type { UserActivityEventType } from '../types';
import { TimeEntryService } from './TimeEntryService';
import { initDb } from '../utils/storageutils';
import { initStorage } from '../utils/storageutils';
import { dateStr, timeStr } from '../utils/dateUtils';
import { getGitHead } from '../utils/gitUtils';

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

    vscode.commands.registerCommand(
      'time-spent.exportTimeEntriesToCsv',
      this.onExportTimeEntriesToCsv,
    );

    await this.onDidUserActivityOccur('extensionInit')();
  };

  onDidUserActivityOccur = (eventType: UserActivityEventType) => {
    return async () => {
      const fileUri = vscode.window.activeTextEditor?.document.uri;

      // In cases where file path is undefined, there should be a corresponding
      // event where it is defined as the new editor gets focus. Skip the extra.
      if (eventType === 'activeTextEditorChange' && fileUri == null) {
        return;
      }

      const gitBranch = fileUri && (await getGitHead(fileUri));

      this._timeEntryService?.handleEvent({
        type: eventType,
        fileUri,
        gitBranch,
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

    this._outputChannel.clear();
    this._outputChannel.show(true);

    let curDateStr: string | null = null;
    for (const [date, filePath, fileTotal, dailyTotal] of result.values) {
      const dateStr = new Date(Number(date)).toISOString().substring(0, 10);
      if (dateStr !== curDateStr) {
        const dailyTotalM = timeStr(dailyTotal);
        this._outputChannel.appendLine(
          `-------------------------------- ${dateStr} ----------------------------------------------`,
        );
        this._outputChannel.appendLine(`${dailyTotalM} - Total`);
        this._outputChannel.appendLine(
          '------------------------------------------------------------------------------------------',
        );
      }

      curDateStr = dateStr;

      this._outputChannel.appendLine(
        [timeStr(fileTotal), filePath].join(' - '),
      );
    }
  };

  onExportTimeEntriesToCsv = async () => {
    const [result] = this._timeEntryService?.showTimeEntries().values() ?? [];
    if (result == null) {
      return;
    }

    console.log(result);

    const headerRow = [...result.columns, 'dateStr', 'startStr', 'endStr'];
    const rows = result.values.map(row => {
      row = [...row, dateStr(row[4]), timeStr(row[5]), timeStr(row[6])];
      return row.map(v => `"${v}"`).join(',');
    });

    const csvContent = [headerRow, ...rows].join('\n');

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file('timespent.csv'),
      filters: { CSV: ['csv'] },
    });

    if (uri == null) {
      return;
    }

    fs.writeFileSync(uri.fsPath, csvContent);

    vscode.window.showTextDocument(uri);
  };
}
