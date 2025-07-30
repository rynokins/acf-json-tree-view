const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

// Global tracking for files opened from our extension
let filesOpenedFromExtension = new Set();
let originalAutoRevealSetting = null;
let autoRevealTimeout = null;

class AcfJsonDecorationProvider {
  constructor() {
    this._onDidChangeFileDecorations = new vscode.EventEmitter();
    this.onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;
  }

  async provideFileDecoration(uri, token) {
    if (uri.scheme !== 'file') {
      return;
    }

    const filePath = uri.fsPath;

    if (
      !filePath.includes(`${path.sep}acf-json${path.sep}`) ||
      !filePath.endsWith('.json')
    ) {
      return;
    }

    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const json = JSON.parse(content);

      if (json.title) {
        return new vscode.FileDecoration(
          '⬡',
          `ACF: ${json.title}`,
          new vscode.ThemeColor('charts.blue')
        );
      }
    } catch (error) {
      console.error('Error processing file:', filePath, error);
    }

    return;
  }

  refresh(uri) {
    this._onDidChangeFileDecorations.fire(uri);
  }
}

class AcfTreeDataProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.acfFiles = [];
  }

  refresh() {
    this.loadAcfFiles().then(() => {
      this._onDidChangeTreeData.fire();
    });
  }

  isOptionsPage(fieldGroup) {
    if (!fieldGroup.location || !Array.isArray(fieldGroup.location)) {
      return false;
    }

    return fieldGroup.location.some(locationGroup =>
      Array.isArray(locationGroup) &&
      locationGroup.some(rule =>
        rule.param === 'options_page'
      )
    );
  }

  getIconAndColor(title, fieldGroup) {
    if (this.isOptionsPage(fieldGroup)) {
      return {
        icon: new vscode.ThemeIcon('gear', new vscode.ThemeColor('foreground')),
        color: 'foreground'
      };
    }

    const titleLower = title.toLowerCase();

    if (titleLower.includes('block')) {
      return {
        icon: new vscode.ThemeIcon('symbol-class', new vscode.ThemeColor('charts.purple')),
        color: 'charts.purple'
      };
    }

    if (titleLower.includes('clone')) {
      return {
        icon: new vscode.ThemeIcon('git-branch', new vscode.ThemeColor('charts.orange')),
        color: 'charts.orange'
      };
    }

    if (titleLower.includes('post')) {
      return {
        icon: new vscode.ThemeIcon('file-text', new vscode.ThemeColor('charts.green')),
        color: 'charts.green'
      };
    }

    if (titleLower.includes('page')) {
      return {
        icon: new vscode.ThemeIcon('browser', new vscode.ThemeColor('charts.blue')),
        color: 'charts.blue'
      };
    }

    if (titleLower.includes('menu')) {
      return {
        icon: new vscode.ThemeIcon('list-unordered', new vscode.ThemeColor('charts.red')),
        color: 'charts.red'
      };
    }

    return {
      icon: new vscode.ThemeIcon('json', new vscode.ThemeColor('charts.yellow')),
      color: 'charts.yellow'
    };
  }

  getTreeItem(element) {
    const iconData = this.getIconAndColor(element.title, element.fieldGroup);

    const treeItem = new vscode.TreeItem(
      element.title,
      vscode.TreeItemCollapsibleState.None
    );

    const relativePath = vscode.workspace.asRelativePath(element.uri);
    treeItem.description = `${element.filename}.json • ${path.dirname(relativePath)}`;

    treeItem.tooltip = new vscode.MarkdownString([
      `## ${element.title}`,
      '',
      `📁 **File:** \`${element.filename}.json\``,
      '',
      `📂 **Path:** \`${relativePath}\``,
      '',
      `🔧 **Type:** ${this.getFieldGroupType(element.title, element.fieldGroup)}`,
      '',
      '_Click to open file_'
    ].join('\n'));

    treeItem.command = {
      command: 'acfFieldGroups.openFileQuiet',
      title: 'Open',
      arguments: [element.uri]
    };

    treeItem.contextValue = 'acfFile';
    treeItem.iconPath = iconData.icon;

    return treeItem;
  }

  getFieldGroupType(title, fieldGroup) {
    if (this.isOptionsPage(fieldGroup)) {
      return 'Options';
    }

    const titleLower = title.toLowerCase();

    if (titleLower.includes('block')) return 'Gutenberg Block';
    if (titleLower.includes('clone')) return 'Clone Field';
    if (titleLower.includes('post')) return 'Post Fields';
    if (titleLower.includes('page')) return 'Page Fields';
    if (titleLower.includes('menu')) return 'Menu Fields';

    return 'General Fields';
  }

  getChildren(element) {
    if (!element) {
      return this.acfFiles;
    }
    return [];
  }

  async loadAcfFiles() {
    this.acfFiles = [];

    try {
      const acfFiles = await vscode.workspace.findFiles('**/acf-json/*.json');
      console.log(`Found ${acfFiles.length} ACF files`);

      for (const uri of acfFiles) {
        try {
          const content = await fs.promises.readFile(uri.fsPath, 'utf8');
          const json = JSON.parse(content);

          if (json.title) {
            const filename = path.basename(uri.fsPath, '.json');
            this.acfFiles.push({
              title: json.title,
              filename,
              uri,
              key: json.key || filename,
              fieldGroup: json
            });
          }
        } catch (error) {
          console.error('Error processing ACF file:', uri.fsPath, error);
        }
      }

      this.acfFiles.sort((a, b) => {
        return a.title.localeCompare(b.title, undefined, {
          numeric: true,
          sensitivity: 'base'
        });
      });

      console.log(`Loaded ${this.acfFiles.length} ACF field groups (sorted by name)`);
    } catch (error) {
      console.error('Error finding ACF files:', error);
    }
  }
}

function isAcfJsonFile(uri) {
  if (!uri || uri.scheme !== 'file') return false;
  const filePath = uri.fsPath;
  return filePath.includes(`${path.sep}acf-json${path.sep}`) && filePath.endsWith('.json');
}

async function disableAutoReveal() {
  try {
    const config = vscode.workspace.getConfiguration('explorer');
    if (originalAutoRevealSetting === null) {
      originalAutoRevealSetting = config.get('autoReveal');
    }
    await config.update('autoReveal', false, vscode.ConfigurationTarget.Global);
  } catch (error) {
    console.error('Failed to disable auto reveal:', error);
  }
}

async function restoreAutoReveal() {
  try {
    if (originalAutoRevealSetting !== null) {
      const config = vscode.workspace.getConfiguration('explorer');
      await config.update('autoReveal', originalAutoRevealSetting, vscode.ConfigurationTarget.Global);
      originalAutoRevealSetting = null;
    }
  } catch (error) {
    console.error('Failed to restore auto reveal:', error);
  }
}

function scheduleAutoRevealRestore() {
  // Clear any existing timeout
  if (autoRevealTimeout) {
    clearTimeout(autoRevealTimeout);
  }

  // Schedule restoration after 2 seconds of no ACF file activity
  autoRevealTimeout = setTimeout(async () => {
    // Only restore if no ACF files are currently active
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || !isAcfJsonFile(activeEditor.document.uri) ||
        !filesOpenedFromExtension.has(activeEditor.document.uri.toString())) {
      await restoreAutoReveal();
      filesOpenedFromExtension.clear();
    }
  }, 2000);
}

async function openFileWithoutReveal(uri) {
  try {
    // Track this file as opened from our extension
    filesOpenedFromExtension.add(uri.toString());

    // Disable auto-reveal
    await disableAutoReveal();

    // Open the document
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document, {
      preview: false,
      preserveFocus: false
    });

    // Schedule auto-reveal restoration
    scheduleAutoRevealRestore();

    vscode.window.setStatusBarMessage(
      `Opened ACF file: ${path.basename(uri.fsPath)}`,
      2000
    );

  } catch (error) {
    await restoreAutoReveal();
    vscode.window.showErrorMessage(`Failed to open file: ${error.message}`);
  }
}

function activate(context) {
  console.log('ACF JSON Title on Hover extension activated');

  // File decoration provider
  const decorationProvider = new AcfJsonDecorationProvider();
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(decorationProvider)
  );

  // Tree data provider
  const treeProvider = new AcfTreeDataProvider();

  const treeView = vscode.window.createTreeView('acfFieldGroups', {
    treeDataProvider: treeProvider,
    showCollapseAll: false
  });

  context.subscriptions.push(treeView);
  treeProvider.refresh();

  // Listen for active editor changes to manage auto-reveal
  const activeEditorChangeListener = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
    if (editor && editor.document) {
      const uri = editor.document.uri;

      // If switching to an ACF file that was opened from our extension, keep auto-reveal disabled
      if (isAcfJsonFile(uri) && filesOpenedFromExtension.has(uri.toString())) {
        await disableAutoReveal();
        scheduleAutoRevealRestore();
      }
      // If switching to a non-ACF file, allow auto-reveal restoration to proceed
      else if (!isAcfJsonFile(uri)) {
        scheduleAutoRevealRestore();
      }
    }
  });

  context.subscriptions.push(activeEditorChangeListener);

  // Listen for document close events to clean up tracking
  const documentCloseListener = vscode.workspace.onDidCloseTextDocument((document) => {
    filesOpenedFromExtension.delete(document.uri.toString());

    // If no more tracked files are open, restore auto-reveal
    if (filesOpenedFromExtension.size === 0) {
      scheduleAutoRevealRestore();
    }
  });

  context.subscriptions.push(documentCloseListener);

  // File system watcher
  const watcher = vscode.workspace.createFileSystemWatcher('**/acf-json/*.json');

  const onFileChange = (uri) => {
    console.log('ACF file changed:', uri.fsPath);
    decorationProvider.refresh(uri);
    treeProvider.refresh();
  };

  watcher.onDidChange(onFileChange);
  watcher.onDidCreate(onFileChange);
  watcher.onDidDelete(onFileChange);

  context.subscriptions.push(watcher);

  // Commands
  const refreshCommand = vscode.commands.registerCommand(
    'acfFieldGroups.refresh',
    () => treeProvider.refresh()
  );

  const openFileQuietCommand = vscode.commands.registerCommand(
    'acfFieldGroups.openFileQuiet',
    async (uri) => {
      await openFileWithoutReveal(uri);
    }
  );

  const openFileCommand = vscode.commands.registerCommand(
    'acfFieldGroups.openFile',
    async (uri) => {
      try {
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);
        await vscode.commands.executeCommand('revealInExplorer', uri);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to open file: ${error.message}`);
      }
    }
  );

  const generateNewKeyCommand = vscode.commands.registerCommand(
    'acfFieldGroups.generateNewKey',
    generateNewAcfKey
  );

  context.subscriptions.push(refreshCommand, openFileQuietCommand, openFileCommand, generateNewKeyCommand);

  // Restore auto-reveal setting when extension deactivates
  context.subscriptions.push({
    dispose: async () => {
      if (autoRevealTimeout) {
        clearTimeout(autoRevealTimeout);
      }
      await restoreAutoReveal();
      filesOpenedFromExtension.clear();
    }
  });
}

function deactivate() {
  if (autoRevealTimeout) {
    clearTimeout(autoRevealTimeout);
  }
  restoreAutoReveal();
  filesOpenedFromExtension.clear();
}

function generateRandomString(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function generateNewAcfKey() {
  const activeEditor = vscode.window.activeTextEditor;

  if (!activeEditor) {
    vscode.window.showErrorMessage('No active editor found');
    return;
  }

  if (!isAcfJsonFile(activeEditor.document.uri)) {
    vscode.window.showErrorMessage('Active file is not an ACF JSON file');
    return;
  }

  try {
    const document = activeEditor.document;
    const text = document.getText();
    const cursorPosition = activeEditor.selection.active;
    const cursorOffset = document.offsetAt(cursorPosition);

    // Find the JSON object that contains the cursor
    const objectBounds = findContainingJsonObject(text, cursorOffset);

    if (!objectBounds) {
      vscode.window.showErrorMessage('Cursor is not within a JSON object');
      return;
    }

    const objectText = text.substring(objectBounds.start, objectBounds.end);

    // Find the "key" property and its value within the object
    const keyMatch = objectText.match(/"key"\s*:\s*"([^"]+)"/);

    if (!keyMatch) {
      vscode.window.showErrorMessage('No "key" field found in the current JSON object');
      return;
    }

    const oldKey = keyMatch[1];
    const newKey = 'field_' + generateRandomString(13);

    // Replace just the key value, preserving all formatting
    const newObjectText = objectText.replace(
      /"key"\s*:\s*"[^"]+"/,
      `"key": "${newKey}"`
    );

    const objectRange = new vscode.Range(
      document.positionAt(objectBounds.start),
      document.positionAt(objectBounds.end)
    );

    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, objectRange, newObjectText);

    const success = await vscode.workspace.applyEdit(edit);

    if (success) {
      vscode.window.showInformationMessage(
        `ACF key updated: ${oldKey} → ${newKey}`
      );
    } else {
      vscode.window.showErrorMessage('Failed to update ACF key');
    }

  } catch (error) {
    vscode.window.showErrorMessage(`Error updating ACF key: ${error.message}`);
  }
}

function findContainingJsonObject(text, cursorOffset) {
  let braceCount = 0;
  let start = -1;
  let end = -1;

  // Find the start of the containing object (search backwards)
  for (let i = cursorOffset; i >= 0; i--) {
    const char = text[i];

    if (char === '}') {
      braceCount++;
    } else if (char === '{') {
      braceCount--;

      if (braceCount < 0) {
        start = i;
        break;
      }
    }
  }

  if (start === -1) {
    return null;
  }

  // Find the end of the containing object (search forwards)
  braceCount = 0;
  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (char === '{') {
      braceCount++;
    } else if (char === '}') {
      braceCount--;

      if (braceCount === 0) {
        end = i + 1;
        break;
      }
    }
  }

  if (end === -1) {
    return null;
  }

  return { start, end };
}

module.exports = { activate, deactivate };