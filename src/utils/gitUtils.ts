import * as vscode from 'vscode';
import { Branch, GitExtension } from '../gitTypes';

function isDescendant(parent: string, descendant: string): boolean {
  return descendant.toLowerCase().startsWith(parent.toLowerCase());
  // if (parent === descendant) {
  //   return true;
  // }

  // if (parent.charAt(parent.length - 1) !== sep) {
  //   parent += sep;
  // }

  // return descendant.startsWith(parent);
}

export async function getGitHead(uri: vscode.Uri): Promise<Branch | undefined> {
  const gitExtension =
    vscode.extensions.getExtension<GitExtension>('vscode.git');
  if (gitExtension == null) {
    console.log('[time-spent] vscode.git extension not found.');
    return;
  }

  if (!gitExtension.isActive) {
    await gitExtension.activate();
  }

  const api = gitExtension.exports.getAPI(1);

  const rootPath = vscode.workspace.getWorkspaceFolder(uri);
  if (rootPath == null) {
    return;
  }

  const repo = api.repositories.find(r =>
    isDescendant(r.rootUri.fsPath, rootPath.uri.fsPath),
  );

  return repo?.state.HEAD;
}
