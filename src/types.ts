import * as vscode from 'vscode';

export type UserActivityEventType =
  | 'activeTextEditorChange'
  | 'editorSelectionChange';

export interface UserActivityEvent {
  type: UserActivityEventType;
  fileUri?: vscode.Uri;
  instant: number;
}

export interface TimeEntry {
  uid: string;
  fileUri?: vscode.Uri;
  start: number;
  end?: number;
}
