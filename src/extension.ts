import * as vscode from 'vscode';
import { ExtensionController } from '~/services/ExtensionController';

export function activate(context: vscode.ExtensionContext) {
  console.log('Activating time-spent extension.');

  const controller = new ExtensionController();
  context.subscriptions.push(controller);
}

export function deactivate() {}
