import * as vscode from 'vscode';
import type { Branch } from './gitTypes';

export type UserActivityEventType =
  | 'activeTextEditorChange'
  | 'activityTimeout'
  | 'dispose'
  | 'editorSelectionChange'
  | 'extensionInit'
  | 'windowFocus'
  | 'windowBlur';

export interface Tag {
  fileUri?: vscode.Uri;
  gitBranch?: Branch;
}

export interface UserActivityEvent extends Tag {
  type: UserActivityEventType;
  instant: number;
}

export interface TimeEntry extends Tag {
  eventType: UserActivityEventType;
  uid: string;
  start: number;
}

export interface SplitPaths {
  wksp: string;
  filePath: string;
}
