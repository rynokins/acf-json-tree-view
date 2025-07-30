const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

class AcfJsonDecorationProvider
{
  constructor() {
    // Create an event emitter for decoration changes.
    this._onDidChangeFileDecorations = new vscode.EventEmitter();
    this.onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;
  }
  async provideFileDecoration(uri, token) {
    // Only process file URIs
    if (uri.scheme !== 'file') {
      return;
    }

    const filePath = uri.fsPath;

    // Check that the file is in an acf-json folder and is a .json file
    if (
      !filePath.includes(`${path.sep}acf-json${path.sep}`) ||
      !filePath.endsWith('.json')
    ) {
      return;
    }

    try {
      const content = await fs.promises.readFile(filePath, "utf8");
      const json = JSON.parse(content);

      if (json.title) {
        const badge = json.title.length <= 4 ? json.title : undefined;
        return new vscode.FileDecoration(badge, json.title, new vscode.ThemeColor('textLink.foreground'));
      }
    } catch (error) {
      console.error('Error processing file:', filePath, error);
    }

    return;
  }

  // Call this method when you detect a file change, to refresh decorations.
  refresh(uri) {
    this._onDidChangeFileDecorations.fire(uri);
  }
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context)
{
  console.log('ACF JSON Title on Hover extension activated');

  const provider = new AcfJsonDecorationProvider();

  // Register the File Decoration Provider
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(provider)
  );

  // Create a filesystem watcher for all JSON files under any acf-json folder.
  const watcher = vscode.workspace.createFileSystemWatcher(
    '**/acf-json/*.json'
  );

  // When a file is changed, created, or deleted, tell VS Code to update its decoration.
  const onFileChange = (uri) => {
    console.log('File changed:', uri.fsPath);
    provider.refresh(uri);
  };

  watcher.onDidChange(onFileChange);
  watcher.onDidCreate(onFileChange);
  watcher.onDidDelete(onFileChange);

  context.subscriptions.push(watcher);
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = { activate, deactivate }
