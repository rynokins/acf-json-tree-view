const fs = require('fs');
const path = require('path');

// VS Code built-in icons (from codicons)
const VSCODE_ICONS = [
  'account', 'activate-breakpoints', 'add', 'archive', 'arrow-both', 'arrow-down', 'arrow-left', 'arrow-right', 'arrow-small-down', 'arrow-small-left', 'arrow-small-right', 'arrow-small-up', 'arrow-up', 'beaker', 'bell', 'bold', 'book', 'bookmark', 'bracket-dot', 'bracket-error', 'briefcase', 'broadcast', 'browser', 'bug', 'calendar', 'call-incoming', 'call-outgoing', 'case-sensitive', 'check', 'check-all', 'checklist', 'chevron-down', 'chevron-left', 'chevron-right', 'chevron-up', 'chrome-close', 'chrome-maximize', 'chrome-minimize', 'chrome-restore', 'circle', 'circle-filled', 'circle-large', 'circle-large-filled', 'circle-outline', 'circle-slash', 'circuit-board', 'clear-all', 'clippy', 'close', 'close-all', 'cloud', 'cloud-download', 'cloud-upload', 'code', 'collapse-all', 'color-mode', 'comment', 'comment-discussion', 'credit-card', 'dash', 'dashboard', 'database', 'debug', 'debug-all', 'debug-alt', 'debug-alt-small', 'debug-breakpoint', 'debug-breakpoint-conditional', 'debug-breakpoint-data', 'debug-breakpoint-function', 'debug-breakpoint-log', 'debug-breakpoint-unsupported', 'debug-console', 'debug-continue', 'debug-continue-small', 'debug-coverage', 'debug-disconnect', 'debug-line-by-line', 'debug-pause', 'debug-rerun', 'debug-restart', 'debug-restart-frame', 'debug-reverse-continue', 'debug-stackframe', 'debug-stackframe-active', 'debug-start', 'debug-step-back', 'debug-step-into', 'debug-step-out', 'debug-step-over', 'debug-stop', 'desktop-download', 'device-camera', 'device-camera-video', 'device-desktop', 'device-mobile', 'diff', 'diff-added', 'diff-ignored', 'diff-modified', 'diff-removed', 'diff-renamed', 'discard', 'edit', 'editor-layout', 'ellipsis', 'empty-window', 'error', 'exclude', 'expand-all', 'export', 'extensions', 'eye', 'eye-closed', 'feedback', 'file', 'file-binary', 'file-code', 'file-media', 'file-pdf', 'file-submodule', 'file-symlink-directory', 'file-symlink-file', 'file-text', 'file-zip', 'files', 'filter', 'flame', 'fold', 'fold-down', 'fold-up', 'folder', 'folder-active', 'folder-opened', 'gear', 'gift', 'gist-secret', 'git-branch', 'git-commit', 'git-compare', 'git-merge', 'git-pull-request', 'github', 'github-action', 'github-alt', 'globe', 'go-to-file', 'grabber', 'graph', 'graph-left', 'graph-line', 'graph-scatter', 'gripper', 'heart', 'history', 'home', 'horizontal-rule', 'hubot', 'inbox', 'info', 'issue-closed', 'issue-opened', 'issue-reopened', 'issues', 'italic', 'jersey', 'json', 'kebab-vertical', 'key', 'law', 'lightbulb', 'link', 'link-external', 'list-filter', 'list-flat', 'list-ordered', 'list-selection', 'list-tree', 'list-unordered', 'live-share', 'loading', 'location', 'lock', 'magnet', 'mail', 'mail-read', 'man', 'markdown', 'megaphone', 'mention', 'menu', 'merge', 'milestone', 'mirror', 'mortar-board', 'move', 'multiple-windows', 'mute', 'new-file', 'new-folder', 'newline', 'no-newline', 'note', 'notebook', 'notebook-template', 'octoface', 'open-preview', 'organization', 'output', 'package', 'paintcan', 'pass', 'pass-filled', 'person', 'person-add', 'pin', 'pinned', 'play', 'play-circle', 'plug', 'preserve-case', 'preview', 'primitive-dot', 'primitive-square', 'project', 'pulse', 'question', 'quote', 'radio-tower', 'reactions', 'record', 'record-keys', 'record-small', 'redo', 'references', 'refresh', 'regex', 'remote', 'remote-explorer', 'remove', 'replace', 'replace-all', 'reply', 'repo', 'repo-clone', 'repo-force-push', 'repo-forked', 'repo-pull', 'repo-push', 'report', 'request-changes', 'rocket', 'root-folder', 'root-folder-opened', 'rss', 'ruby', 'run-above', 'run-all', 'run-below', 'run-errors', 'save', 'save-all', 'save-as', 'screen-full', 'screen-normal', 'search', 'search-stop', 'server', 'server-environment', 'server-process', 'settings', 'settings-gear', 'shield', 'sign-in', 'sign-out', 'smiley', 'sort-precedence', 'source-control', 'split-horizontal', 'split-vertical', 'squirrel', 'star', 'star-add', 'star-delete', 'star-empty', 'star-full', 'star-half', 'stop', 'stop-circle', 'symbol-array', 'symbol-boolean', 'symbol-class', 'symbol-color', 'symbol-constant', 'symbol-enum', 'symbol-enum-member', 'symbol-event', 'symbol-field', 'symbol-file', 'symbol-interface', 'symbol-key', 'symbol-keyword', 'symbol-method', 'symbol-misc', 'symbol-namespace', 'symbol-numeric', 'symbol-operator', 'symbol-parameter', 'symbol-property', 'symbol-ruler', 'symbol-snippet', 'symbol-string', 'symbol-structure', 'symbol-variable', 'sync', 'sync-ignored', 'table', 'tag', 'target', 'tasklist', 'telescope', 'terminal', 'terminal-bash', 'terminal-cmd', 'terminal-debian', 'terminal-linux', 'terminal-powershell', 'terminal-tmux', 'terminal-ubuntu', 'text-size', 'three-bars', 'thumbsdown', 'thumbsup', 'tools', 'trash', 'triangle-down', 'triangle-left', 'triangle-right', 'triangle-up', 'twitter', 'type-hierarchy', 'type-hierarchy-sub', 'type-hierarchy-super', 'unfold', 'ungroup-by-ref-type', 'unlock', 'unmute', 'unverified', 'variable-group', 'verified', 'versions', 'vm', 'vm-active', 'vm-connect', 'vm-outline', 'vm-running', 'warning', 'watch', 'whitespace', 'whole-word', 'window', 'word-wrap', 'workspace-trusted', 'workspace-unknown', 'workspace-untrusted', 'zap', 'zoom-in', 'zoom-out'
];

// VS Code theme colors
const THEME_COLORS = [
  // General colors
  'foreground', 'errorForeground', 'descriptionForeground', 'icon.foreground',

  // Chart colors
  'charts.foreground', 'charts.lines', 'charts.red', 'charts.blue', 'charts.yellow',
  'charts.orange', 'charts.green', 'charts.purple', 'charts.grey',

  // Terminal colors
  'terminal.background', 'terminal.foreground', 'terminal.ansiBlack', 'terminal.ansiRed',
  'terminal.ansiGreen', 'terminal.ansiYellow', 'terminal.ansiBlue', 'terminal.ansiMagenta',
  'terminal.ansiCyan', 'terminal.ansiWhite', 'terminal.ansiBrightBlack', 'terminal.ansiBrightRed',
  'terminal.ansiBrightGreen', 'terminal.ansiBrightYellow', 'terminal.ansiBrightBlue',
  'terminal.ansiBrightMagenta', 'terminal.ansiBrightCyan', 'terminal.ansiBrightWhite',

  // Git decoration colors
  'gitDecoration.addedResourceForeground', 'gitDecoration.modifiedResourceForeground',
  'gitDecoration.deletedResourceForeground', 'gitDecoration.untrackedResourceForeground',
  'gitDecoration.ignoredResourceForeground', 'gitDecoration.conflictingResourceForeground',
  'gitDecoration.submoduleResourceForeground', 'gitDecoration.stageModifiedResourceForeground',
  'gitDecoration.stageDeletedResourceForeground',

  // Symbol icon colors
  'symbolIcon.arrayForeground', 'symbolIcon.booleanForeground', 'symbolIcon.classForeground',
  'symbolIcon.colorForeground', 'symbolIcon.constantForeground', 'symbolIcon.constructorForeground',
  'symbolIcon.enumeratorForeground', 'symbolIcon.enumeratorMemberForeground', 'symbolIcon.eventForeground',
  'symbolIcon.fieldForeground', 'symbolIcon.fileForeground', 'symbolIcon.folderForeground',
  'symbolIcon.functionForeground', 'symbolIcon.interfaceForeground', 'symbolIcon.keyForeground',
  'symbolIcon.keywordForeground', 'symbolIcon.methodForeground', 'symbolIcon.moduleForeground',
  'symbolIcon.namespaceForeground', 'symbolIcon.nullForeground', 'symbolIcon.numberForeground',
  'symbolIcon.objectForeground', 'symbolIcon.operatorForeground', 'symbolIcon.packageForeground',
  'symbolIcon.propertyForeground', 'symbolIcon.referenceForeground', 'symbolIcon.snippetForeground',
  'symbolIcon.stringForeground', 'symbolIcon.structForeground', 'symbolIcon.textForeground',
  'symbolIcon.typeParameterForeground', 'symbolIcon.unitForeground', 'symbolIcon.variableForeground',

  // Folder and file colors
  'folderIcons.folderForeground', 'tree.indentGuidesStroke',

  // Notification colors
  'notificationCenterHeader.foreground', 'notificationCenterHeader.background',
  'notificationToast.border', 'notifications.foreground', 'notifications.background',
  'notifications.border', 'notificationCenter.border', 'notificationCenterHeader.foreground',
  'notificationLink.foreground',

  // Status bar colors
  'statusBar.foreground', 'statusBar.background', 'statusBar.border',
  'statusBarItem.activeBackground', 'statusBarItem.hoverBackground',
  'statusBarItem.prominentForeground', 'statusBarItem.prominentBackground',
  'statusBarItem.prominentHoverBackground', 'statusBarItem.errorBackground',
  'statusBarItem.errorForeground', 'statusBarItem.warningBackground',
  'statusBarItem.warningForeground',

  // Activity bar colors
  'activityBar.foreground', 'activityBar.inactiveForeground', 'activityBar.background',
  'activityBarBadge.foreground', 'activityBarBadge.background', 'activityBar.activeBorder',
  'activityBar.activeBackground', 'activityBar.activeFocusBorder'
];

function updatePackageJsonEnums() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    console.error('package.json not found');
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  // Update icon enum
  const iconProperty = packageJson.contributes.configuration.properties['acfJsonTreeView.iconRules'].items.properties.icon;
  iconProperty.enum = VSCODE_ICONS;
  iconProperty.description = `Icon name to display. Choose from ${VSCODE_ICONS.length} available VS Code icons.`;

  // Update color enum
  const colorProperty = packageJson.contributes.configuration.properties['acfJsonTreeView.iconRules'].items.properties.color;
  colorProperty.enum = THEME_COLORS;
  colorProperty.description = `Theme color ID for the icon. Choose from ${THEME_COLORS.length} available theme colors.`;

  // Update override icon enum
  packageJson.contributes.configuration.properties['acfJsonTreeView.overrideIcon'].enum = VSCODE_ICONS;

  // Update override color enum
  packageJson.contributes.configuration.properties['acfJsonTreeView.overrideColor'].enum = THEME_COLORS;

  // Update theme icon enum
  packageJson.contributes.configuration.properties['acfJsonTreeView.themeIcon'].enum = VSCODE_ICONS;

  // Update theme color enum
  packageJson.contributes.configuration.properties['acfJsonTreeView.themeColor'].enum = THEME_COLORS;

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log(`✅ Updated package.json with ${VSCODE_ICONS.length} icons and ${THEME_COLORS.length} colors`);
}

if (require.main === module) {
  updatePackageJsonEnums();
}

module.exports = { updatePackageJsonEnums, VSCODE_ICONS, THEME_COLORS };