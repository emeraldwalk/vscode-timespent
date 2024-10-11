import * as vscode from 'vscode';
import { ServiceBase } from './ServiceBase';
import type { UserActivityEventType } from '../types';
import { TimeEntryService } from './TimeEntryService';

export class ExtensionController extends ServiceBase {
  constructor() {
    super();

    vscode.window.onDidChangeTextEditorSelection(
      this.onDidUserActivityOccur('editorSelectionChange'),
    );
    vscode.window.onDidChangeActiveTextEditor(
      this.onDidUserActivityOccur('activeTextEditorChange'),
    );
  }

  private readonly _timeEntryService = new TimeEntryService();

  onDidUserActivityOccur = (eventType: UserActivityEventType) => {
    return () => {
      const fileUri = vscode.window.activeTextEditor?.document.uri;

      // In cases where file path is undefined, there should be a corresponding
      // event where it is defined as the new editor gets focus. Skip the extra.
      if (eventType === 'activeTextEditorChange' && fileUri == null) {
        return;
      }

      this._timeEntryService.handleEvent({
        type: eventType,
        fileUri,
        instant: new Date().valueOf(),
      });
    };
  };
}
