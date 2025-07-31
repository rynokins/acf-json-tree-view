# ACF JSON Tree View README

## Features

# ACF JSON Tree View

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/rynokins.acf-json-tree-view?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=rynokins.acf-json-tree-view)
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/rynokins.acf-json-tree-view?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=rynokins.acf-json-tree-view)

A Visual Studio Code extension that provides an enhanced tree view for managing Advanced Custom Fields (ACF) JSON Field Groups in WordPress projects.

View a list of the titles of your Field Groups instead of the randomized `group_abcdefg123456.json` filenames! Add colors and icons to distinguish between the types of ACF Field Groups using location rules or titles, or both! And more.

![ACF JSON Tree View Screenshot](https://via.placeholder.com/800x400?text=ACF+JSON+Tree+View+Screenshot)

## Features
- List view of the titles of your ACF Field Groups
- Opening via ACF JSON Tree View will open your json file while avoiding setting the focus to the json file in the explorer view.
- Enhanced tooltips in the tree view + adds title to tooltips in the explorer view

### Theme-Based Organization
- Automatically organizes ACF Field Groups by WordPress theme
- Parses `style.css` to display theme names
- Collapsible theme folders for better navigation
- Shows child theme Field Group overrides with visual indicators (assuming you're loading both parent and child Field Groups, like below)
```php
/**
 * Override parent theme's acf-json
 * --
 * This code will prepend the parent theme's path for you
 * so you can load parent theme as well as child theme Field Groups.
 */
add_filter( 'acf/settings/load_json', function($paths) {
  if (is_child_theme()) {
    array_unshift($paths, get_template_directory() . '/acf-json');
  }
  return $paths;
});
```

### Customizable Field Group Types
- Define custom icons, colors, and labels based on field group properties
- Support for complex matching rules with AND/OR conditions
- Rule weighting system to prioritize specific matching criteria

### JSON Key Management
Additional commands to make editing your ACF JSON files easier. Use commands to generate a new random 13 character keys for groups or fields.
- *Generate new ACF Field key*
  - Generates a new key in the currently focused field object
- *Generate New Field Key (Replace All)*
  - New key that replaces all matching instances with the new generated key
- *Generate New Group Key (Update Filename)*
  - Prompts you to save with the new group key
- *Generate New Keys for All Fields*
  - Bulk generate new for all keys, replaces all matching instances


### Enhanced Context Menu
- Standard file operations (copy path, rename, delete, etc.)
- ACF-specific key management operations
- Direct access to extension settings
- "Open and Reveal in Explorer" functionality

## Configuration
Customize via settings, either search for `acfJsonTreeView` or use the ⚙️ gear button in the tree view's title bar.

### Icon Rules
Customize how Field Groups are categorized and displayed using icon rules:

```json
"acfJsonTreeView.iconRules": [
  {
    "name": "Post Type Settings",
    "weight": 1,
    "condition": {
      "and": [
        { "locationParam": "post_type" },
        { "titleContains": "settings" }
      ]
    },
    "icon": "gear",
    "color": "charts.blue",
    "typeLabel": "Post Type Settings"
  },
  {
    "name": "Post Type Fields",
    "weight": 0,
    "condition": {
      "locationParam": "post_type"
    },
    "icon": "file-text",
    "color": "charts.green",
    "typeLabel": "Post Type Fields"
  }
]
```

#### Condition Types
- **Simple Conditions**:
  ```json
  { "titleContains": "block" }
  { "locationParam": "post_type" }
  ```

- **AND Conditions** (all must match):
  ```json
  {
    "and": [
      { "titleContains": "block" },
      { "locationParam": "post_type" }
    ]
  }
  ```

- **OR Conditions** (at least one must match):
  ```json
  {
    "or": [
      { "titleContains": "block" },
      { "titleContains": "section" }
    ]
  }
  ```

- **Nested Conditions**:
  ```json
  {
    "and": [
      { "titleContains": "settings" },
      {
        "or": [
          { "locationParam": "options_page" },
          { "locationParam": "block" }
        ]
      }
    ]
  }
  ```

#### Rule Properties
| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Unique name for the rule |
| `weight` | number | Priority (higher = evaluated first) |
| `condition` | object | Matching criteria (see above) |
| `icon` | string | VS Code theme icon name |
| `color` | string | Theme color ID |
| `typeLabel` | string | Display label for field group type |

### Theme Settings
| Setting | Default | Description |
|---------|---------|-------------|
| `acfJsonTreeView.ignoreThemes` | `[]` | List of theme names to exclude from tree view |
| `acfJsonTreeView.themeIcon` | `"folder"` | Icon for theme folders |
| `acfJsonTreeView.themeColor` | `"folderIcons.folderForeground"` | Color for theme folder icons |

### Override Settings
| Setting | Default | Description |
|---------|---------|-------------|
| `acfJsonTreeView.showOverrideIndicator` | `true` | Show indicator for field group overrides |
| `acfJsonTreeView.overrideIcon` | `"add"` | Icon for override indicators |
| `acfJsonTreeView.overrideColor` | `"charts.orange"` | Color for override indicators |

## Usage

### Accessing the Tree View
1. Open the VS Code Explorer (default shortcut: `Ctrl+Shift+E` or `Cmd+Shift+E` on Mac)
2. Look for "ACF Field Groups" in the explorer view

### Context Menu Operations
Right-click on any field group or theme to access:
- Standard file operations (Open, Copy Path, Rename, Delete, etc.)
- ACF Key Management operations
- Settings access

### Key Management
1. Right-click on a field group JSON file
2. Select "ACF Key Management" submenu
3. Choose from:
   - **Generate New Group Key** - Creates new group key and prompts to update filename
   - **Generate New Field Key (Replace All)** - Creates new field key and updates all references
   - **Generate New Keys for All Fields** - Updates all field keys in the file

## Requirements

None. Works with the `acf-json` folder sugggested by the [ACF](https://github.com/elliotcondon/acf) extension.


## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---