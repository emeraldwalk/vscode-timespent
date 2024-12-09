import * as vscode from 'vscode';
import type { Branch } from './gitTypes';

export type UserActivityEventType =
  | 'activeTextEditorChange'
  | 'editorSelectionChange'
  | 'extensionInit'
  | 'windowStateChange';

export interface Tag {
  fileUri?: vscode.Uri;
  gitBranch?: Branch;
}

export interface UserActivityEvent extends Tag {
  type: UserActivityEventType;
  instant: number;
}

export interface TimeEntry extends Tag {
  uid: string;
  start: number;
}

export interface SplitPaths {
  wksp: string;
  filePath: string;
}
