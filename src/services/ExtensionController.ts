import * as vscode from 'vscode';
import { ServiceBase } from './ServiceBase';

export class ExtensionController extends ServiceBase {
  constructor() {
    super();

    vscode.window.onDidChangeTextEditorSelection(() => {
      console.log('[TESTING] text selection changed');
    });
  }
}
