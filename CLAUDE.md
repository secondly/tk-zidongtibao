# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a browser extension for web automation that allows users to create and execute custom automation workflows on web pages. The extension supports various element location strategies, dynamic step management, real-time execution feedback, and multi-window automation operations.

Key features:
- Custom automation workflow creation and execution
- Multiple element location strategies (ID, Class, CSS selector, XPath, text content, etc.)
- Dynamic step management with the ability to add, delete, and adjust operation steps
- Clear execution feedback showing real-time status of each step
- Multi-window management automation operations
- Sensitive word detection and filtering

## Project Structure

```
├── background/              # Background scripts
├── content/                 # Content scripts running on web pages
├── modules/                 # Modular components
│   ├── content/             # Content script modules
│   ├── designer/            # Workflow designer modules
│   ├── popup/               # Popup UI modules
│   ├── window/              # Multi-window management modules
│   └── utils/               # Utility modules
├── shared/                  # Shared code between components
├── utils/                   # Utility functions
├── icons/                   # Extension icons
├── examples/                # Example workflow configurations
└── templates/               # Workflow templates
```

## Common Development Tasks

### Building and Running

1. Load the extension in browser:
   - Chrome: Open `chrome://extensions/`, enable "Developer mode", click "Load unpacked" and select project root
   - Firefox: Open `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on" and select manifest.json
   - Edge: Open `edge://extensions/`, enable "Developer mode", click "Load unpacked" and select project root

### Key Components

1. **Popup UI (plugin-automation-popup.js)**: Main user interface for workflow configuration and management
2. **Content Script (content/content.js)**: Executes automation operations on web pages
3. **Background Script (background/background.js)**: Coordinates communication and manages execution flow
4. **Universal Automation Engine (universal-automation-engine.js)**: Core automation execution engine
5. **Window Manager (modules/window/window-manager.js)**: Multi-window state management

### Testing

- Test pages included for various features:
  - `demo-test-page.html`: Main workflow testing page
  - `independent-test-page.html`: Independent operation testing
  - `virtual-list-demo.html`: Virtual list operation testing
  - `workflow-designer-mxgraph.html`: Workflow designer interface

### Multi-Window Management

The extension supports complex multi-window automation workflows:
- Opening new windows and switching contexts
- Closing windows and returning to previous contexts
- Managing window state stacks for complex navigation
- Handling window creation timeouts and readiness

Example workflow pattern:
1. Perform operations in main window
2. Click button that opens new window (`opensNewWindow: true`)
3. Execute operations in new window context
4. Close window and return to main window (`closeWindow` action)
5. Continue operations in main window

### Sensitive Word Detection

The extension includes inline sensitive word detection capabilities:
- Configurable sensitive word lists
- Element content filtering during loop operations
- Skip processing of elements containing sensitive words

## Common Commands

No specific build commands needed - this is a browser extension that runs directly in the browser.

For testing:
- Open test pages in browser (e.g., `demo-test-page.html`)
- Load extension in browser development mode
- Use browser developer tools for debugging

## Coding Conventions

- Modular architecture with clear separation of concerns
- ES6 class-based components
- Event-driven communication between components
- Consistent naming patterns for configuration properties
- Comprehensive error handling and logging