# VSCode AI App

🤖 AI-powered browser with LLM chatbox - Ready for VSCode integration

## 📋 Description

This is a standalone Electron application built with TypeScript that provides:
- **Embedded Browser** (80% width, left side): Load and view websites with a webview component
- **AI Chatbox** (20% width, right side): Ask questions about website content using API Free LLM

The application is designed with a clean architecture similar to VSCode, making it easy to integrate into VSCode's core UI later.

**✨ No API Key Required** - Uses API Free LLM (free public endpoint)

## 🏗️ Architecture

The project follows VSCode's architectural patterns:

```
AIApp/
├── src/
│   ├── main/                    # Main process (Electron)
│   │   ├── main.ts             # Application entry point
│   │   ├── preload.ts          # Secure IPC bridge
│   │   └── services/
│   │       ├── llmService.ts   # API Free LLM integration
│   │       └── webContentExtractor.ts
│   └── renderer/                # Renderer process (UI)
│       ├── index.html          # Main UI
│       ├── app.ts              # UI logic
│       └── styles.css          # VSCode-inspired styling
├── package.json
├── tsconfig.json
└── README.md
```

## ✨ Features

- ✅ **Embedded Browser**: Load any website (tested with vnexpress.net)
- ✅ **Content Extraction**: Extract text content from loaded websites
- ✅ **AI Chat**: Ask questions about website content using API Free LLM
- ✅ **Chat History**: Maintains conversation context client-side
- ✅ **No Authentication**: No API key needed - free to use
- ✅ **VSCode-inspired UI**: Dark theme matching VSCode aesthetics
- ✅ **Secure Architecture**: Context isolation and IPC communication
- ✅ **TypeScript**: Full type safety and modern code
- ✅ **Clean Code**: Well-documented, maintainable, and extensible

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Internet connection (for API Free LLM)

### Installation

1. **Clone or navigate to the project:**
   ```powershell
   cd d:\Dev\AIApp
   ```

2. **Install dependencies:**
   ```powershell
   npm install
   # Or if you have PowerShell execution policy issues:
   & 'C:\Program Files\nodejs\npm.cmd' install
   ```

3. **Compile TypeScript:**
   ```powershell
   npm run compile
   # Or:
   & 'C:\Program Files\nodejs\npm.cmd' run compile
   ```

4. **Run the application:**
   ```powershell
   npm start
   # Or:
   & 'C:\Program Files\nodejs\npm.cmd' start
   ```

   Or for development with auto-recompile:
   ```powershell
   npm run dev
   ```

**Note:** If you see GPU process errors in the terminal, you can safely ignore them. The app will still work correctly.

## 📖 Usage

### 1. Load a Website
- Enter a URL in the browser panel (e.g., `https://vnexpress.net`)
- Click "Load" button
- The website will appear in the embedded browser

### 2. Extract Content
- After loading a website, click "Extract Content" button
- The app will extract text content from the webpage
- This content is automatically set as context for the AI

### 3. Chat with AI
- Type your question in the chatbox
- Example questions:
  - "Summarize this website"
  - "What are the main topics on this page?"
  - "Give me the latest news headlines"
- Click "Send" to get AI-powered answers

### 4. Clear Chat (Optional)
- Click "Clear Chat" button to reset conversation history
- Useful when switching to a different website topic

## 🖼️ Screenshots

### Main Interface
```
┌──────────────────────────────────────────────────────────────────────┐
│ 🤖 VSCode AI App                  🟢 API Free LLM Ready              │
├──────────────────────────────────────────────────────────────────────┤
│ Browser (80%)                           │ Chat (20%)                  │
│ ┌────────────────────────────────┐     │ ┌─────────────────────────┐ │
│ │ [https://vnexpress.net] [Load] │     │ │ 💬 AI Assistant [Clear] │ │
│ │ [Extract Content]              │     │ │ Ask questions...        │ │
│ ├────────────────────────────────┤     │ ├─────────────────────────┤ │
│ │                                │     │ │ 👋 Welcome! Load a      │ │
│ │   Embedded Website View        │     │ │ website and chat...     │ │
│ │   (vnexpress.net loaded)       │     │ │ User: Summarize this  │ │
│ │                                │     │ │                        │ │
│ │                                │     │ │ AI: This website is...│ │
│ │                                │     │ │                        │ │
│ │                                │     │ ├────────────────────────┤ │
│ │                                │     │ │ [Type question...]     │ │
│ │                                │     │ │ [Send]                 │ │
│ └────────────────────────────────┘     │ └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## 🔧 Configuration

### LLM Provider Configuration

The app supports multiple LLM providers. Edit `src/main/services/llmService.ts`:

```typescript
// For OpenAI (default)
this.provider = 'openai';
this.model = 'gpt-3.5-turbo';

// For Anthropic
this.provider = 'anthropic';
this.model = 'claude-3-sonnet-20240229';
```

## 🔌 Integration with VSCode

This application is designed to be integrated into VSCode's core UI. Key integration points:

1. **Architecture Compatibility**: Uses TypeScript and follows VSCode patterns
2. **Service Layer**: LLM and content extraction services can be easily ported
3. **UI Components**: Can be converted to VSCode webview panels
4. **IPC Pattern**: Similar to VSCode's extension host communication

### Integration Steps (for later):

1. Copy `services/` to VSCode's `src/vs/workbench/contrib/aiApp/`
2. Create new VSCode view container for the AI app
3. Replace Electron webview with VSCode webview API
4. Adapt IPC to VSCode's extension API
5. Register commands and keybindings

## 📦 Building for Production

```powershell
npm run compile
npm run package
```

This creates a distributable package in the `dist/` folder.

## 🛠️ Technologies Used

- **Electron**: Desktop application framework
- **TypeScript**: Type-safe JavaScript
- **Node.js**: Runtime environment
- **Axios**: HTTP client for API calls
- **OpenAI API**: Language model integration

## 📝 Code Quality

- ✅ Full TypeScript with strict mode
- ✅ ESLint configuration
- ✅ Clean architecture with separation of concerns
- ✅ Comprehensive comments and documentation
- ✅ Error handling and user feedback
- ✅ Security best practices (context isolation)

## 🔒 Security

- Context isolation enabled
- No node integration in renderer
- Secure IPC communication through preload script
- API keys stored locally (not in code)

## 🤝 Contributing

This project is designed for VSCode integration task. Feel free to:
- Improve code quality
- Add new LLM providers
- Enhance UI/UX
- Add more features

## 📄 License

MIT

## 👤 Author

Created for VSCode integration task

## 🙏 Acknowledgments

- VSCode team for the excellent architecture patterns
- Electron community for great documentation
- OpenAI for powerful LLM APIs
