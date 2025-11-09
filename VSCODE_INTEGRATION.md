# VSCode Integration Guide

## 🎯 Overview

This project is designed to integrate into VSCode as a **core UI component**, not as an extension. The goal is to add an AI-powered browser sidebar similar to how VSCode has built-in terminals, SCM, and debug views.

## 🏗️ Current Architecture

### Electron App Structure
```
AIApp/
├── src/
│   ├── main/              # Backend (Node.js)
│   │   ├── main.ts        # Electron main process
│   │   ├── preload.ts     # IPC bridge
│   │   └── services/
│   │       ├── llmService.ts          # AI chat logic
│   │       └── webContentExtractor.ts # Web scraping
│   └── renderer/          # Frontend (Browser)
│       ├── index.html     # UI layout
│       ├── app.ts         # UI logic
│       └── styles.css     # VSCode-like theming
```

### Key Components

1. **LLM Service** (`llmService.ts`)
   - Manages chat history client-side
   - Integrates with API Free LLM
   - No authentication required
   - Can be swapped with other LLM providers

2. **Web Content Extractor** (`webContentExtractor.ts`)
   - Fetches and parses HTML
   - Extracts text content
   - Auto-triggers on page load

3. **UI Components**
   - 80% Browser panel (webview)
   - 20% Chat panel (AI assistant)
   - Auto-extract on navigation
   - Chat history with clear function

## 🔄 VSCode Integration Strategy

### Approach 1: Webview Panel (Recommended for Initial Integration)

**Pros:**
- Minimal changes to VSCode core
- Can be implemented as extension first
- Easy to test and iterate
- Sandboxed environment

**Implementation:**
```typescript
// In VSCode extension
const panel = vscode.window.createWebviewPanel(
    'aiBrowser',
    'AI Browser',
    vscode.ViewColumn.Two,
    {
        enableScripts: true,
        retainContextWhenHidden: true
    }
);

// Inject our HTML/CSS/JS
panel.webview.html = getWebviewContent();
```

**Files to adapt:**
- `src/renderer/index.html` → VSCode webview HTML
- `src/renderer/app.ts` → Communicate via VSCode message passing
- `src/main/services/*` → Move to extension backend

### Approach 2: Native ViewContainer (Full VSCode Integration)

**Pros:**
- Native VSCode UI component
- Better performance
- Follows VSCode patterns
- Access to all VSCode APIs

**Implementation:**
1. Fork VSCode source code
2. Add new ViewContainer in `src/vs/workbench/contrib/`
3. Register contribution point
4. Implement TreeDataProvider for AI chat
5. Embed webview for browser panel

**Files structure in VSCode:**
```
vscode/src/vs/workbench/contrib/aiBrowser/
├── browser/
│   ├── aiBrowserView.ts        # Main view component
│   ├── aiBrowserWebview.ts     # Browser panel
│   └── chatPanel.ts            # Chat interface
├── common/
│   ├── aiBrowser.ts            # Interfaces
│   └── llmService.ts           # Our LLM service
└── electron-main/
    └── webContentExtractor.ts   # Our extractor
```

### Approach 3: Sidebar Extension (Easiest to Start)

**Pros:**
- No VSCode fork needed
- Can publish to marketplace
- Users can install easily
- Good for proof of concept

**Implementation:**
```json
// package.json contribution
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [{
        "id": "ai-browser",
        "title": "AI Browser",
        "icon": "resources/browser.svg"
      }]
    },
    "views": {
      "ai-browser": [{
        "type": "webview",
        "id": "ai-browser.main",
        "name": "Browser & Chat"
      }]
    }
  }
}
```

## 📦 Migration Checklist

### Phase 1: Extension Prototype (Week 1)
- [ ] Create VSCode extension scaffold
- [ ] Convert renderer code to webview
- [ ] Implement message passing (extension ↔ webview)
- [ ] Port LLM service to extension backend
- [ ] Port web extractor to extension backend
- [ ] Test basic functionality

### Phase 2: UI Polish (Week 2)
- [ ] Match VSCode theme system
- [ ] Add VSCode icons
- [ ] Implement proper state management
- [ ] Add configuration settings
- [ ] Test on different themes (dark/light)

### Phase 3: Core Integration Planning (Week 3)
- [ ] Study VSCode source structure
- [ ] Identify integration points
- [ ] Design contribution points
- [ ] Plan API surface
- [ ] Document architecture decisions

### Phase 4: Core Implementation (Week 4+)
- [ ] Fork VSCode repository
- [ ] Create feature branch
- [ ] Implement ViewContainer
- [ ] Add to workbench layout
- [ ] Register services
- [ ] Build and test custom VSCode
- [ ] Create pull request (if contributing back)

## 🔌 Required VSCode APIs

### For Extension Approach:
```typescript
import * as vscode from 'vscode';

// Webview API
vscode.window.createWebviewPanel()
vscode.window.registerWebviewPanelSerializer()

// Extension API
vscode.extensions.getExtension()

// Configuration API  
vscode.workspace.getConfiguration()

// Storage API
context.globalState.get/update()
```

### For Core Integration:
```typescript
// VSCode internal APIs (not public)
import { IViewDescriptorService } from 'vs/workbench/common/views';
import { IWebviewService } from 'vs/workbench/contrib/webview/browser/webview';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
```

## 🗂️ File Mapping

| Current File | Extension Location | Core Location |
|--------------|-------------------|---------------|
| `main.ts` | `extension.ts` | N/A (use VSCode services) |
| `preload.ts` | Message passing | N/A (use DI) |
| `llmService.ts` | `src/llmService.ts` | `src/vs/workbench/contrib/aiBrowser/common/llmService.ts` |
| `webContentExtractor.ts` | `src/webExtractor.ts` | `src/vs/workbench/contrib/aiBrowser/electron-main/webExtractor.ts` |
| `app.ts` | Webview script | `src/vs/workbench/contrib/aiBrowser/browser/aiBrowserView.ts` |
| `index.html` | Webview HTML | Template in `.ts` file |
| `styles.css` | Inline in webview | VSCode theme system |

## 🎨 Theming Integration

### Current: Custom CSS Variables
```css
:root {
    --bg-primary: #1e1e1e;
    --text-primary: #cccccc;
}
```

### VSCode Extension: Use Theme Colors
```typescript
const colors = {
    background: new vscode.ThemeColor('editor.background'),
    foreground: new vscode.ThemeColor('editor.foreground'),
    border: new vscode.ThemeColor('panel.border')
};
```

### VSCode Core: Use Theme Service
```typescript
import { IThemeService } from 'vs/platform/theme/common/themeService';

constructor(@IThemeService private themeService: IThemeService) {
    const theme = this.themeService.getColorTheme();
    const bgColor = theme.getColor('editor.background');
}
```

## 🔧 Configuration

### Extension Settings:
```json
{
  "aiBrowser.llm.provider": "apifreellm",
  "aiBrowser.llm.endpoint": "https://apifreellm.com/api/chat",
  "aiBrowser.autoExtract": true,
  "aiBrowser.maxHistoryLength": 10
}
```

### Access in code:
```typescript
const config = vscode.workspace.getConfiguration('aiBrowser');
const provider = config.get<string>('llm.provider');
```

## 📚 Resources

### VSCode Extension Development:
- [Extension API](https://code.visualstudio.com/api)
- [Webview Guide](https://code.visualstudio.com/api/extension-guides/webview)
- [Tree View Guide](https://code.visualstudio.com/api/extension-guides/tree-view)

### VSCode Core Development:
- [How to Contribute](https://github.com/microsoft/vscode/wiki/How-to-Contribute)
- [Source Code Organization](https://github.com/microsoft/vscode/wiki/Source-Code-Organization)
- [Coding Guidelines](https://github.com/microsoft/vscode/wiki/Coding-Guidelines)

### Similar Extensions:
- Browser Preview: `auchenberg.vscode-browser-preview`
- Live Server: `ritwickdey.LiveServer`
- GitHub Copilot Chat: `GitHub.copilot-chat`

## 🚀 Quick Start: Extension Prototype

### 1. Generate Extension:
```bash
npm install -g yo generator-code
yo code

# Choose:
# - New Extension (TypeScript)
# - Name: ai-browser
# - Description: AI-powered browser with chat
```

### 2. Copy Our Code:
```bash
# Copy services
cp src/main/services/*.ts ai-browser/src/

# Copy UI  
mkdir ai-browser/media
cp src/renderer/* ai-browser/media/
```

### 3. Implement Extension:
```typescript
// extension.ts
export function activate(context: vscode.ExtensionContext) {
    const provider = new AIBrowserViewProvider(context.extensionUri);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'ai-browser.main',
            provider
        )
    );
}
```

### 4. Test:
```bash
cd ai-browser
npm install
# Press F5 in VSCode to debug
```

## ✅ Success Criteria

### Extension:
- [ ] Appears in Activity Bar
- [ ] Browser panel works
- [ ] Chat responds correctly
- [ ] Auto-extract on navigation
- [ ] Persists state across restarts
- [ ] Works with all VSCode themes

### Core Integration:
- [ ] Builds with VSCode source
- [ ] Follows VSCode patterns
- [ ] Uses dependency injection
- [ ] Integrates with command palette
- [ ] Respects VSCode lifecycle
- [ ] Passes all tests

## 🎯 Next Steps

1. **Choose approach** (Extension vs Core)
2. **Set up development environment**
3. **Create prototype**
4. **Test thoroughly**
5. **Iterate based on feedback**
6. **Document for users**
7. **Publish or contribute**

---

**Recommended Path:**  
Start with **Extension** → Validate concept → Then do **Core Integration**

**Timeline:**  
- Extension MVP: 1-2 weeks
- Core Integration: 4-6 weeks
- Polish & Documentation: 1-2 weeks

**Total:** ~2-3 months for full VSCode integration
