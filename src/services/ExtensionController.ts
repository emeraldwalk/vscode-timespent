import * as vscode from 'vscode';
import * as fs from 'node:fs';
import { ServiceBase } from './ServiceBase';
import type { UserActivityEventType } from '../types';
import { TimeEntryService } from './TimeEntryService';
import { initStorage } from '../utils/storageutils';
import { dateStr, timeStr } from '../utils/dateUtils';
import { getGitHead } from '../utils/gitUtils';
import path from 'node:path';

const INACTIVITY_TIMEOUT_MS = 60000;

export class ExtensionController extends ServiceBase {
  constructor() {
    super();

    void this.init();
  }

  private _outputChannel: vscode.OutputChannel | null = null;
  private _timeEntryService: TimeEntryService | null = null;

  init = async () => {
    const wkspPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    const defaultStorageDir =
      wkspPath == null ? undefined : path.join(wkspPath, '.vscode');

    const config = vscode.workspace.getConfiguration('emeraldwalk.timeSpent');
    const storageDir = config.get('storageDir', defaultStorageDir);
    const inactivityTimeoutMs = config.get(
      'inactivityTimeoutMs',
      INACTIVITY_TIMEOUT_MS,
    );

    const csvPath = initStorage(storageDir)?.csvPath;
    if (csvPath == null) {
      return;
    }

    this._outputChannel = vscode.window.createOutputChannel(
      'Time Spent',
      'markdown',
    );

    this._timeEntryService = new TimeEntryService(csvPath, inactivityTimeoutMs);
    this.registerDisposable(this._timeEntryService);

    vscode.window.onDidChangeWindowState(event => {
      const eventType = event.focused ? 'windowFocus' : 'windowBlur';
      this.onDidUserActivityOccur(eventType)();
    });
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

  onShowDailyWorkspaceSummary = async () => {
    if (this._outputChannel == null) {
      return;
    }

    const [result] =
      (await this._timeEntryService?.showDailySummary())?.values() ?? [];
    if (result == null) {
      return;
    }

    this._outputChannel.clear();
    this._outputChannel.show(true);

    let curDateStr: string | null = null;
    let curWkspPath: string | null = null;
    for (const [
      date,
      workspacePath,
      filePath,
      gitBranch,
      fileTotal,
      dailyTotal,
      dailyWkspTotal,
    ] of result.values) {
      const dateStr = new Date(Number(date)).toISOString().substring(0, 10);

      const lineBreak = '';
      const branchLabel = gitBranch ? `(${gitBranch})` : '[none]';

      if (dateStr !== curDateStr) {
        if (curDateStr) {
          this._outputChannel.appendLine(lineBreak);
          this._outputChannel.appendLine(
            '-------------------------------------------------------------------',
          );
        }
        const dailyTotalM = timeStr(dailyTotal);
        this._outputChannel.appendLine(`## ${dateStr}`);
        this._outputChannel.appendLine(`${dailyTotalM} - Total`);
        this._outputChannel.appendLine(lineBreak);
      }

      if ((dateStr !== curDateStr || curWkspPath) !== workspacePath) {
        const dailyWkspTotalM = timeStr(dailyWkspTotal);
        this._outputChannel.appendLine(`### Workspace: ${workspacePath}`);
        this._outputChannel.appendLine(`${dailyWkspTotalM} - Total`);
        this._outputChannel.appendLine(lineBreak);
      }

      curDateStr = dateStr;
      curWkspPath = workspacePath as string;

      this._outputChannel.appendLine(
        [timeStr(fileTotal), `${branchLabel} ${filePath}`].join(' - '),
      );
    }
  };

  onExportTimeEntriesToCsv = async () => {
    const [result] =
      (await this._timeEntryService?.showTimeEntries())?.values() ?? [];
    if (result == null) {
      return;
    }

    const dateI = result.columns.indexOf('date');
    const startI = result.columns.indexOf('start');
    const endI = result.columns.indexOf('end');

    const headerRow = [...result.columns, 'dateStr', 'startStr', 'endStr'];
    const rows = result.values.map(row => {
      row = [
        ...row,
        dateStr(row[dateI]),
        timeStr(row[startI]),
        timeStr(row[endI]),
      ];
      return row.map(v => (isNaN(Number(v)) ? `"${v}"` : v)).join(',');
    });

    const csvContent = [headerRow, ...rows].join('\n');

    const wkspFolder = vscode.workspace.workspaceFolders?.[0];

    const defaultUri =
      wkspFolder == null
        ? vscode.Uri.file('timespent.csv')
        : vscode.Uri.joinPath(wkspFolder.uri, 'timespent.csv');

    const uri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: { CSV: ['csv'] },
    });

    if (uri == null) {
      return;
    }

    fs.writeFileSync(uri.fsPath, csvContent);

    vscode.window.showTextDocument(uri);
  };
}
