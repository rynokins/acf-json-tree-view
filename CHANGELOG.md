# Change Log

## [0.0.6] - 2025-08-01

### Added
- **Enhanced Autocomplete for Settings**
  - Added comprehensive enum lists for VS Code icons (300+ options)
  - Added comprehensive enum lists for theme colors (80+ options)
  - Implemented autocomplete support for all icon and color configuration fields
  - Added `@vscode/codicons` dependency for official icon references

### Fixed
- **Configuration Management**
  - Fixed settings refresh issue - icon/color changes now update immediately without requiring window reload
  - Added configuration change listener to automatically reload icon rules when settings are modified
  - Improved real-time settings updates for better user experience

### Changed
- **Build System Improvements**
  - Updated build scripts to include enum generation in the build process
  - Added `prebuild` script to ensure enums are generated before building
  - Improved extension packaging workflow with proper bundling

## [0.0.5] - 2025-07-31

### Added
- **Theme-based Organization**
  - Tree view now organizes ACF field groups by WordPress theme
  - Parses `style.css` to get accurate theme names and parent/child relationships
  - Correctly identifies field group overrides in child themes

- **Configurable Icon Rules**
  - Added support for custom icon rules via settings
  - Implemented AND/OR condition logic for rule matching
  - Added rule weighting system to prioritize specific rules
  - Backward compatible with simple title/location conditions

- **Override Detection & Indicators**
  - Added visual indicator for field groups that override parent theme field groups
  - Configurable override icon and color
  - Enhanced tooltip to show override information

- **Context Menu Enhancements**
  - Added standard file operations (copy path, rename, delete, etc.)
  - Implemented "ACF Key Management" submenu with:
    - Generate New ACF Field Key (updates currently focused field object)
    - Generate New Group Key (with filename update)
    - Generate New Field Key (with reference replacement)
    - Generate New Keys for All Fields (bulk operation)
  - Added direct access to extension settings from tree view
  - Added editor context menu for ACF JSON files

- **Key Generation Features**
  - Group key generation with automatic filename update
  - Field key generation with reference replacement within the same file
  - Bulk field key generation for all fields in a file
  - Preserves key references throughout ACF JSON structure

- **UI/UX Improvements**
  - Enhanced tooltips with detailed field group information
  - Fixed "Open and Reveal in Explorer" command
  - Added theme icon configuration options
  - Improved error handling and user feedback

### Fixed
- Fixed rule evaluation logic to properly handle AND conditions
- Resolved issue where weighted rules were behaving like OR rules
- Fixed command argument handling for tree item clicks and context menus
- Corrected settings search functionality for direct settings access
- Fixed tooltip override information formatting
- Fixed context menu not displaying by ensuring commands are registered before tree view creation
- Added proper submenu definition to resolve "submenu not defined" error
- Implemented editor context menu for ACF JSON files
- Fixed context value matching between tree items and menu conditions
- Added regex path matching for editor context menus (`resourcePath =~ /acf-json/`)

### Changed
- Restructured code for better maintainability
- Improved theme hierarchy detection algorithm
- Updated default icon rules to use explicit AND conditions
- Changed rule evaluation to prioritize higher-weighted rules
- Modified tree view structure to show themes as collapsible parents
- Added settings, icon, updated readme and changelog

## [Unreleased]

- Initial release