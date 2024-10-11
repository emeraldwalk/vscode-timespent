import * as vscode from 'vscode';
import { ExtensionController } from '~/services/ExtensionController';

let controller: ExtensionController;

export function activate(context: vscode.ExtensionContext) {
  console.log('Activating time-spent extension.');
  controller = new ExtensionController();
}

export async function deactivate() {
  await controller?.dispose();
}
