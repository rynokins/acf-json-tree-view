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
    this.themes = new Map(); // theme name -> { name, children: [] }
    this.acfFiles = [];
    this.iconRules = this.loadIconRules();
    this.keyMap = new Map(); // key -> { theme, fieldGroup }
  }

  refresh() {
    this.loadAcfFiles().then(() => {
      this._onDidChangeTreeData.fire();
    }).catch(error => {
      console.error('Error refreshing ACF tree data:', error);
      // Fire the event anyway to ensure UI updates
      this._onDidChangeTreeData.fire();
    });
  }

  loadIconRules() {

    const config = vscode.workspace.getConfiguration('acfJsonTreeView');
    const customRules = config.get('iconRules', []);

    // Deduplicate by name and add default weights
    const uniqueRules = Array.from(
      new Map(customRules.map(rule => [rule.name, {
        ...rule,
        weight: rule.weight !== undefined ? rule.weight : 0
      }])).values()
    );

    // Sort by weight (descending) so higher weights are checked first
    return uniqueRules.sort((a, b) => (b.weight || 0) - (a.weight || 0));
  }

  evaluateCondition(condition, titleLower, locationParams) {
    // Handle null/undefined conditions
    if (!condition) return true;

    // Handle simple conditions with proper AND behavior for combined properties
    if (condition.titleContains !== undefined || condition.locationParam !== undefined) {
      // CRITICAL FIX: Changed from OR to AND for combined conditions
      if (condition.titleContains && condition.locationParam) {
        return titleLower.includes(condition.titleContains.toLowerCase()) &&
               locationParams.includes(condition.locationParam);
      }

      // Single condition checks remain the same
      if (condition.titleContains) {
        return titleLower.includes(condition.titleContains.toLowerCase());
      }

      if (condition.locationParam) {
        return locationParams.includes(condition.locationParam);
      }

      return true; // Empty condition matches everything
    }

    // Rest of the condition handling remains correct
    if (condition.and !== undefined) {
      const subConditions = Array.isArray(condition.and) ? condition.and : [condition.and];
      return subConditions.length === 0 || subConditions.every(subCondition =>
        this.evaluateCondition(subCondition, titleLower, locationParams)
      );
    }

    if (condition.or !== undefined) {
      const subConditions = Array.isArray(condition.or) ? condition.or : [condition.or];
      return subConditions.length > 0 && subConditions.some(subCondition =>
        this.evaluateCondition(subCondition, titleLower, locationParams)
      );
    }

    return false;
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
    // Check if this is an override
    const config = vscode.workspace.getConfiguration('acfJsonTreeView');
    const showOverrideIndicator = config.get('showOverrideIndicator', true);
    const overrideIcon = config.get('overrideIcon', 'add');
    const overrideColor = config.get('overrideColor', 'charts.orange');

    if (showOverrideIndicator && fieldGroup.isOverride) {
      return {
        icon: new vscode.ThemeIcon(overrideIcon, new vscode.ThemeColor(overrideColor)),
        color: overrideColor
      };
    }

    const titleLower = title.toLowerCase();
    const locationParams = this.getLocationParams(fieldGroup);

    for (const rule of this.iconRules) {
      if (this.evaluateCondition(rule.condition, titleLower, locationParams)) {
        return {
          icon: new vscode.ThemeIcon(rule.icon, new vscode.ThemeColor(rule.color)),
          color: rule.color
        };
      }
    }

    // Fallback to default
    return {
      icon: new vscode.ThemeIcon('json', new vscode.ThemeColor('charts.yellow')),
      color: 'charts.yellow'
    };
  }

  getLocationParams(fieldGroup) {
    if (!fieldGroup.location || !Array.isArray(fieldGroup.location)) {
      return [];
    }

    return fieldGroup.location.flatMap(locationGroup =>
      Array.isArray(locationGroup)
        ? locationGroup.map(rule => rule.param).filter(param => param)
        : []
    );
  }

  getTreeItem(element) {
    const config = vscode.workspace.getConfiguration('acfJsonTreeView');
    const themeIcon = config.get('themeIcon', 'folder');
    const themeColor = config.get('themeColor', 'folderIcons.folderForeground');
    if (element.type === 'theme') {
      const treeItem = new vscode.TreeItem(
        element.name,
        vscode.TreeItemCollapsibleState.Expanded
      );

      treeItem.contextValue = 'theme';
      treeItem.iconPath = new vscode.ThemeIcon(themeIcon, new vscode.ThemeColor(themeColor));
      return treeItem;
    }

    const iconData = this.getIconAndColor(element.title, element.fieldGroup);

    const treeItem = new vscode.TreeItem(
      element.title,
      vscode.TreeItemCollapsibleState.None
    );
    // For field groups:
    treeItem.contextValue = 'acfFile';

    const relativePath = vscode.workspace.asRelativePath(element.uri);

    // Build tooltip content with override info
    const tooltipLines = [
      `## ${element.title}`,
      ''
    ];

    tooltipLines.push(
      `📁 **File:** \`${element.filename}.json\``,
      '',
      `📂 **Path:** \`${relativePath}\``,
      ''
    );
    // Add override info if applicable
    if (element.isOverride && element.overrideOf) {
      tooltipLines.push(
        `**++ Overrides ++** \`../${element.overrideOf}/acf-json/${element.filename}.json\``, ''
      );
    }
    tooltipLines.push(
      `🔧 **Type:** ${this.getFieldGroupType(element.title, element.fieldGroup)}`,
      '',
      '_Click to open file_'
    );

    treeItem.tooltip = new vscode.MarkdownString(tooltipLines.join('\n'));

    treeItem.command = {
      command: 'acfFieldGroups.openFileQuiet',
      title: 'Open',
      arguments: [element.uri]
    };

    treeItem.contextValue = 'acfFile';
    treeItem.iconPath = iconData.icon;

    return treeItem;
  }

  getThemeFolderFromPath(filePath) {
    // Look for common WordPress theme paths
    const themeMatch = filePath.match(/themes[\/\\]([^\/\\]+)[\/\\]acf-json/);
    return themeMatch ? themeMatch[1] : null;
  }

	getFieldGroupType(title, fieldGroup) {
	  const titleLower = title.toLowerCase();
    const locationParams = this.getLocationParams(fieldGroup);

    for (const rule of this.iconRules) {
      if (this.evaluateCondition(rule.condition, titleLower, locationParams)) {
        return rule.typeLabel || 'Custom Fields';
      }
    }

    return 'General Fields';
	}

  getChildren(element) {
    if (!element) {
      // Return all themes
      return Array.from(this.themes.values());
    }

    if (element.type === 'theme') {
      // Return field groups for this theme
      return this.themes.get(element.name).children;
    }

    return [];
  }

  getThemeFromPath(filePath) {
    // Look for common WordPress theme paths
    const themeMatch = filePath.match(/(themes[\/\\]([^\/\\]+))/);
    return themeMatch ? themeMatch[2] : 'Unknown Theme';
  }


	async loadAcfFiles() {
	  this.themes.clear();
	  this.keyMap.clear();

	  // Build theme hierarchy first
	  const { themeMetadataMap, themePathMap, parentChildMap } = await buildThemeHierarchy();

	  try {
	    const acfFiles = await vscode.workspace.findFiles('**/acf-json/*.json');
	    console.log(`Found ${acfFiles.length} ACF files`);

	    for (const uri of acfFiles) {
	      try {
	        const content = await fs.promises.readFile(uri.fsPath, 'utf8');
	        const json = JSON.parse(content);

	        if (json.title) {
	          const filename = path.basename(uri.fsPath, '.json');

	          // Get theme folder name from path
	          const themeFolder = this.getThemeFolderFromPath(uri.fsPath);
	          if (!themeFolder) continue;

	          // Check if theme should be ignored
	          const config = vscode.workspace.getConfiguration('acfJsonTreeView');
	          const ignoredThemes = config.get('ignoreThemes', []);
	          if (ignoredThemes.includes(themeFolder)) {
	            continue;
	          }

	          // Get theme metadata
	          const themeMetadata = themeMetadataMap.get(themeFolder) || {
	            name: themeFolder,
	            folderName: themeFolder,
	            template: null
	          };

	          // Track by key for override detection
	          const key = json.key || filename;

	          // Check for overrides in parent themes
	          let isOverride = false;
	          let overrideOf = null;

	          if (themeMetadata.template) {
	            // Check if parent theme has the same field group key
	            let currentParent = themeMetadata.template;
	            while (currentParent && themePathMap.has(currentParent)) {
	              // Check if parent theme has this key
	              const parentThemePath = themePathMap.get(currentParent);
	              const parentAcfPath = path.join(parentThemePath, 'acf-json', `${filename}.json`);

	              try {
	                await fs.promises.access(parentAcfPath);
	                // Parent has the same file, this is an override
	                isOverride = true;
	                overrideOf = currentParent;
	                break;
	              } catch (error) {
	                // Parent doesn't have this file, check grandparent
	                const parentMetadata = themeMetadataMap.get(currentParent) || {};
	                currentParent = parentMetadata.template;
	              }
	            }
	          }

	          json.isOverride = isOverride;
	          json.overrideOf = overrideOf;

	          // Add to themes map using the display name
	          if (!this.themes.has(themeMetadata.name)) {
	            this.themes.set(themeMetadata.name, {
	              type: 'theme',
	              name: themeMetadata.name,
	              folderName: themeFolder,
	              children: []
	            });
	          }

	          // Add field group to theme
	          this.themes.get(themeMetadata.name).children.push({
	            title: json.title,
	            filename,
	            uri,
	            key: key,
	            fieldGroup: json,
	            isOverride: json.isOverride,
	            overrideOf: json.overrideOf
	          });
	        }
	      } catch (error) {
	        console.error('Error processing ACF file:', uri.fsPath, error);
	      }
	    }

	    // Sort themes alphabetically
	    const sortedThemes = new Map([...this.themes.entries()].sort());
	    this.themes = sortedThemes;

	    // Sort field groups within each theme
	    for (const [themeName, theme] of this.themes) {
	      theme.children.sort((a, b) => {
	        return a.title.localeCompare(b.title, undefined, {
	          numeric: true,
	          sensitivity: 'base'
	        });
	      });
	    }

	    console.log(`Loaded ${this.keyMap.size} ACF field groups across ${this.themes.size} themes`);
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

async function getThemeMetadata(themePath) {
  const styleCssPath = path.join(themePath, 'style.css');

  try {
    const content = await fs.promises.readFile(styleCssPath, 'utf8');

    // Extract the comment block at the top of the file
    const commentMatch = content.match(/\/\*[\s\S]*?\*\//);
    if (!commentMatch) {
      return {
        name: path.basename(themePath),
        folderName: path.basename(themePath),
        template: null
      };
    }

    const comment = commentMatch[0];

    // Parse metadata fields
    const metadata = {
      name: path.basename(themePath),
      folderName: path.basename(themePath),
      template: null
    };

    // Extract Theme Name
    const nameMatch = comment.match(/Theme\s*Name\s*:\s*(.+)/i);
    if (nameMatch) {
      metadata.name = nameMatch[1].trim();
    }

    // Extract Template (for child themes)
    const templateMatch = comment.match(/Template\s*:\s*(.+)/i);
    if (templateMatch) {
      metadata.template = templateMatch[1].trim();
    }

    return metadata;
  } catch (error) {
    console.error('Error reading style.css:', error);
    return {
      name: path.basename(themePath),
      folderName: path.basename(themePath),
      template: null
    };
  }
}

async function buildThemeHierarchy() {
  const themeMetadataMap = new Map(); // folderName -> metadata
  const themePathMap = new Map(); // folderName -> themePath
  const parentChildMap = new Map(); // childFolderName -> parentFolderName

  try {
    // Find all theme folders (look for style.css files)
    const themeStyleCssFiles = await vscode.workspace.findFiles('**/themes/*/style.css');

    for (const uri of themeStyleCssFiles) {
      const themePath = path.dirname(uri.fsPath);
      const folderName = path.basename(themePath);

      const metadata = await getThemeMetadata(themePath);
      metadata.folderName = folderName;

      themeMetadataMap.set(folderName, metadata);
      themePathMap.set(folderName, themePath);
    }

    // Build parent-child relationships
    for (const [folderName, metadata] of themeMetadataMap) {
      if (metadata.template) {
        parentChildMap.set(folderName, metadata.template);
      }
    }

    return { themeMetadataMap, themePathMap, parentChildMap };
  } catch (error) {
    console.error('Error building theme hierarchy:', error);
    return { themeMetadataMap: new Map(), themePathMap: new Map(), parentChildMap: new Map() };
  }
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
    async (arg) => {
      // Handle both tree item clicks (passing uri directly) and context menus (passing element)
      const uri = arg && arg.uri ? arg.uri : arg;
      if (!uri) {
        vscode.window.showErrorMessage('No file URI provided');
        return;
      }
      await openFileWithoutReveal(uri);
    }
  );

  const openFileCommand = vscode.commands.registerCommand(
    'acfFieldGroups.openFile',
    async (arg) => {
      try {
        // Handle both tree item clicks (passing uri directly) and context menus (passing element)
        const uri = arg && arg.uri ? arg.uri : arg;
        if (!uri) {
          throw new Error("No URI provided");
        }

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Add small delay to ensure file is loaded before revealing
        setTimeout(async () => {
          await vscode.commands.executeCommand('revealInExplorer', uri);
        }, 200);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to open file: ${error.message}`);
      }
    }
  );

  const generateNewKeyCommand = vscode.commands.registerCommand(
    'acfFieldGroups.generateNewKey',
    generateNewAcfKey
  );
  const generateNewGroupKeyCommand = vscode.commands.registerCommand(
    'acfFieldGroups.generateNewGroupKey',
    async (element) => {
      const uri = element && element.uri ? element.uri : vscode.window.activeTextEditor?.document.uri;
      if (uri) {
        await generateNewGroupKeyWithFilenameUpdate(uri);
      }
    }
  );

  const generateNewFieldKeyCommand = vscode.commands.registerCommand(
    'acfFieldGroups.generateNewFieldKeyAndReplaceAll',
    async (element) => {
      const uri = element && element.uri ? element.uri : vscode.window.activeTextEditor?.document.uri;
      if (uri) {
        const cursorPosition = vscode.window.activeTextEditor?.selection.active;
        await generateNewFieldKeyAndReplaceAll(uri, cursorPosition);
      }
    }
  );

  const generateNewKeysForAllFieldsCommand = vscode.commands.registerCommand(
    'acfFieldGroups.generateNewKeysForAllFields',
    async (element) => {
      const uri = element && element.uri ? element.uri : vscode.window.activeTextEditor?.document.uri;
      if (uri) {
        await generateNewKeysForAllFields(uri);
      }
    }
  );

  context.subscriptions.push(
    refreshCommand,
    openFileQuietCommand,
    openFileCommand,
    generateNewKeyCommand,
    generateNewGroupKeyCommand,
    generateNewFieldKeyCommand,
    generateNewKeysForAllFieldsCommand
  );

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

  // Add standard context menu commands
  context.subscriptions.push(vscode.commands.registerCommand('acfFieldGroups.copyPath', async (element) => {
    if (element && element.uri) {
      await vscode.env.clipboard.writeText(element.uri.fsPath);
      vscode.window.showInformationMessage(`Copied path to clipboard: ${element.uri.fsPath}`);
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('acfFieldGroups.copyRelativePath', async (element) => {
    if (element && element.uri) {
      const relativePath = vscode.workspace.asRelativePath(element.uri);
      await vscode.env.clipboard.writeText(relativePath);
      vscode.window.showInformationMessage(`Copied relative path to clipboard: ${relativePath}`);
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('acfFieldGroups.revealInExplorer', async (element) => {
    if (element && element.uri) {
      await vscode.commands.executeCommand('revealInExplorer', element.uri);
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('acfFieldGroups.openInNewEditorGroup', async (element) => {
    if (element && element.uri) {
      await vscode.window.showTextDocument(element.uri, {
        viewColumn: vscode.ViewColumn.Beside
      });
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('acfFieldGroups.rename', async (element) => {
    if (element && element.uri) {
      const newPath = await vscode.window.showInputBox({
        prompt: 'Enter new file name',
        value: path.basename(element.uri.fsPath)
      });

      if (newPath) {
        const newUri = vscode.Uri.joinPath(element.uri, '..', newPath);
        await vscode.workspace.fs.rename(element.uri, newUri);
        // Refresh the tree view after rename
        treeProvider.refresh();
      }
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('acfFieldGroups.delete', async (element) => {
    if (element && element.uri) {
      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to delete '${path.basename(element.uri.fsPath)}'?`,
        { modal: true },
        'Delete'
      );

      if (confirm === 'Delete') {
        try {
          await vscode.workspace.fs.delete(element.uri, { recursive: false });
          treeProvider.refresh();
          vscode.window.showInformationMessage(`Deleted: ${path.basename(element.uri.fsPath)}`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to delete file: ${error.message}`);
        }
      }
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('acfFieldGroups.newFile', async (element) => {
    try {
      // If element is a theme, use its path as base
      let basePath;
      if (element && element.type === 'theme') {
        // Find a sample file path from this theme to get the base path
        const themeFiles = Array.from(treeProvider.themes.get(element.name).children);
        if (themeFiles.length > 0) {
          basePath = path.dirname(themeFiles[0].uri.fsPath);
        }
      } else if (element && element.uri) {
        basePath = path.dirname(element.uri.fsPath);
      } else {
        // Default to first found acf-json directory
        const acfFiles = await vscode.workspace.findFiles('**/acf-json/*.json', null, 1);
        if (acfFiles.length > 0) {
          basePath = path.dirname(acfFiles[0].fsPath);
        }
      }

      if (!basePath) {
        vscode.window.showErrorMessage('Could not determine base path for new file');
        return;
      }
      let randomFilename = `group_${generateRandomString(13)}`;
      const fileName = await vscode.window.showInputBox({
        prompt: 'Enter new file name (will be suffixed with .json)',
        value: randomFilename
      });

      if (fileName) {
        const cleanName = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
        const newFilePath = path.join(basePath, cleanName);
        const newUri = vscode.Uri.file(newFilePath);

        // Create empty ACF JSON structure
        const newContent = JSON.stringify({
          key: fileName.endsWith('.json') ? fileName.replace('.json', '') : fileName,
          title: cleanName.replace('.json', ''),
          fields: [],
          location: [
            [
              {
                param: "post_type",
                operator: "==",
                value: "post"
              }
            ]
          ],
          menu_order: 0,
          position: "normal",
          style: "default",
          label_placement: "top",
          instruction_placement: "label",
          hide_on_screen: [],
          active: true,
          description: ""
        }, null, 2);

        await vscode.workspace.fs.writeFile(newUri, Buffer.from(newContent));
        await vscode.window.showTextDocument(newUri);
        treeProvider.refresh();
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create new file: ${error.message}`);
    }
  }));

  const openSettingsCommand = vscode.commands.registerCommand(
    'acfFieldGroups.openSettings',
    () => {
      vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'acfJsonTreeView'
      );
    }
  );
  context.subscriptions.push(openSettingsCommand);

  // Tree data provider
  const treeProvider = new AcfTreeDataProvider();

  const treeView = vscode.window.createTreeView('acfFieldGroups', {
    treeDataProvider: treeProvider,
    showCollapseAll: false
  });

  context.subscriptions.push(treeView);

  // Listen for configuration changes
  const configChangeListener = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('acfJsonTreeView')) {
      // Reload icon rules and refresh tree view
      treeProvider.iconRules = treeProvider.loadIconRules();
      treeProvider.refresh();

      // Also refresh file decorations
      decorationProvider.refresh();
    }
  });

  context.subscriptions.push(configChangeListener);

  treeProvider.refresh();

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

async function generateNewGroupKeyWithFilenameUpdate(uri) {
  if (!uri) {
    vscode.window.showErrorMessage('No file URI provided');
    return;
  }

  try {
    const document = await vscode.workspace.openTextDocument(uri);
    const text = document.getText();

    // Find the JSON object (should be the whole document for ACF field groups)
    const objectBounds = { start: 0, end: text.length };
    const objectText = text.substring(objectBounds.start, objectBounds.end);

    // Find the "key" property and its value
    const keyMatch = objectText.match(/"key"\s*:\s*"([^"]+)"/);

    if (!keyMatch) {
      vscode.window.showErrorMessage('No "key" field found in the JSON file');
      return;
    }

    const oldKey = keyMatch[1];
    const newKey = 'group_' + generateRandomString(13);

    // Replace the key value
    const newObjectText = objectText.replace(
      /"key"\s*:\s*"[^"]+"/,
      `"key": "${newKey}"`
    );

    const objectRange = new vscode.Range(
      document.positionAt(objectBounds.start),
      document.positionAt(objectBounds.end)
    );

    // Apply the edit to update the key in the document
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, objectRange, newObjectText);
    await vscode.workspace.applyEdit(edit);

    // Prompt to rename the file
    const shouldRename = await vscode.window.showInformationMessage(
      `Generated new group key: ${newKey}\n\nWould you like to rename the file to match the new key?`,
      'Yes',
      'No'
    );

    if (shouldRename === 'Yes') {
      const oldFilename = path.basename(uri.fsPath);
      const newFilename = `${newKey}.json`;
      const newUri = vscode.Uri.joinPath(uri, '..', newFilename);

      try {
        await vscode.workspace.fs.rename(uri, newUri);
        vscode.window.showInformationMessage(
          `File renamed from ${oldFilename} to ${newFilename}`
        );

        // Refresh the tree view
        const treeProvider = getTreeProvider(); // Implementation below
        if (treeProvider) treeProvider.refresh();
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to rename file: ${error.message}`);
      }
    }

  } catch (error) {
    vscode.window.showErrorMessage(`Error updating group key: ${error.message}`);
  }
}

async function generateNewFieldKeyAndReplaceAll(uri, cursorPosition) {
  if (!uri) {
    vscode.window.showErrorMessage('No file URI provided');
    return;
  }

  try {
    const document = await vscode.workspace.openTextDocument(uri);
    const text = document.getText();

    // Find the field object containing the cursor
    const objectBounds = findContainingJsonObject(text, document.offsetAt(cursorPosition));

    if (!objectBounds) {
      vscode.window.showErrorMessage('Cursor is not within a field object');
      return;
    }

    const objectText = text.substring(objectBounds.start, objectBounds.end);

    // Find the "key" property and its value within the field
    const keyMatch = objectText.match(/"key"\s*:\s*"([^"]+)"/);

    if (!keyMatch) {
      vscode.window.showErrorMessage('No "key" field found in the current field');
      return;
    }

    const oldKey = keyMatch[1];
    const newKey = 'field_' + generateRandomString(13);

    // Replace just the key value in the field
    const newObjectText = objectText.replace(
      /"key"\s*:\s*"[^"]+"/,
      `"key": "${newKey}"`
    );

    const objectRange = new vscode.Range(
      document.positionAt(objectBounds.start),
      document.positionAt(objectBounds.end)
    );

    // Apply the edit to update the field key
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, objectRange, newObjectText);

    // Find and replace all references to the old key in the same file
    const referenceRegex = new RegExp(`"${oldKey}"`, 'g');
    let match;
    let hasReplacements = false;

    while ((match = referenceRegex.exec(text)) !== null) {
      // Skip the original key definition
      if (match.index >= objectBounds.start && match.index <= objectBounds.end) {
        continue;
      }

      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      edit.replace(document.uri, new vscode.Range(startPos, endPos), `"${newKey}"`);
      hasReplacements = true;
    }

    if (hasReplacements) {
      vscode.window.showInformationMessage(
        `Replaced ${referenceRegex.lastIndex} references to field key`
      );
    }

    await vscode.workspace.applyEdit(edit);
    vscode.window.showInformationMessage(
      `Field key updated: ${oldKey} → ${newKey}`
    );

  } catch (error) {
    vscode.window.showErrorMessage(`Error updating field key: ${error.message}`);
  }
}

async function generateNewKeysForAllFields(uri) {
  if (!uri) {
    vscode.window.showErrorMessage('No file URI provided');
    return;
  }

  try {
    const document = await vscode.workspace.openTextDocument(uri);
    const text = document.getText();

    // Parse the JSON to identify all fields
    let jsonData;
    try {
      jsonData = JSON.parse(text);
    } catch (e) {
      vscode.window.showErrorMessage('Invalid JSON in file');
      return;
    }

    if (!jsonData.fields || !Array.isArray(jsonData.fields)) {
      vscode.window.showInformationMessage('No fields found in this file');
      return;
    }

    // Create a map of old keys to new keys
    const keyMap = new Map();
    for (const field of jsonData.fields) {
      if (field.key) {
        keyMap.set(field.key, 'field_' + generateRandomString(13));
      }
    }

    if (keyMap.size === 0) {
      vscode.window.showInformationMessage('No field keys found to update');
      return;
    }

    // Create edit to replace all keys
    const edit = new vscode.WorkspaceEdit();
    let replacements = 0;

    // Replace field keys in the fields array
    for (const [oldKey, newKey] of keyMap) {
      const keyRegex = new RegExp(`"key"\\s*:\\s*"${oldKey}"`, 'g');
      let match;

      while ((match = keyRegex.exec(text)) !== null) {
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
        edit.replace(
          document.uri,
          new vscode.Range(startPos, endPos),
          `"key": "${newKey}"`
        );
        replacements++;
      }

      // Replace references to the old key
      const refRegex = new RegExp(`"${oldKey}"`, 'g');
      while ((match = refRegex.exec(text)) !== null) {
        // Skip the key definition itself
        if (match[0] === `"${oldKey}"` &&
            text.substring(match.index - 7, match.index + 7).includes('"key"')) {
          continue;
        }

        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
        edit.replace(
          document.uri,
          new vscode.Range(startPos, endPos),
          `"${newKey}"`
        );
        replacements++;
      }
    }

    if (replacements > 0) {
      await vscode.workspace.applyEdit(edit);
      vscode.window.showInformationMessage(
        `Generated ${keyMap.size} new field keys with ${replacements} total replacements`
      );
    } else {
      vscode.window.showInformationMessage('No keys were updated');
    }

  } catch (error) {
    vscode.window.showErrorMessage(`Error updating field keys: ${error.message}`);
  }
}

// Helper to get the tree provider instance
function getTreeProvider() {
  return global.acfTreeProvider;
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