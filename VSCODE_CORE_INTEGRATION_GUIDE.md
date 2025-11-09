# VSCode Core Integration Guide - Tích hợp AI Browser vào VSCode Core

## 📌 Tổng Quan

Hướng dẫn này chỉ cách fork VSCode repository và tích hợp AI Browser app trực tiếp vào VSCode core, thay vì tạo extension.

**Ưu điểm:**
- ✅ Tích hợp sâu, native experience
- ✅ Truy cập full VSCode APIs
- ✅ Không bị giới hạn bởi Webview
- ✅ Performance tốt hơn

**Nhược điểm:**
- ❌ Phải maintain fork riêng
- ❌ Merge upstream VSCode khó
- ❌ Build time lâu (~30 phút lần đầu)

---

## Bước 1: Setup Môi Trường

### 1.1 Prerequisites

```powershell
# Node.js 18+ (LTS)
node --version  # v18.x.x or higher

# Yarn (VSCode dùng Yarn, không dùng npm)
npm install -g yarn
yarn --version  # 1.22.x

# Python 3.x (cho node-gyp)
python --version  # 3.x

# Git
git --version

# Visual Studio Build Tools (Windows only)
# Download từ: https://visualstudio.microsoft.com/downloads/
# Chọn: "Desktop development with C++"
```

### 1.2 Fork và Clone VSCode

```powershell
# 1. Truy cập https://github.com/microsoft/vscode
# 2. Click "Fork" để tạo fork về tài khoản của bạn

# 3. Clone fork về local
cd d:\Dev
git clone https://github.com/YOUR_USERNAME/vscode.git
cd vscode

# 4. Add upstream để sync sau này
git remote add upstream https://github.com/microsoft/vscode.git

# 5. Tạo branch riêng cho feature
git checkout -b feature/ai-browser
```

### 1.3 Install Dependencies

```powershell
# Install tất cả dependencies (mất ~10-15 phút)
yarn install

# Verify installation
yarn --version
```

---

## Bước 2: Hiểu Kiến Trúc VSCode

### 2.1 Cấu Trúc Thư Mục Quan Trọng

```
vscode/
├── src/
│   └── vs/                          # VSCode source code
│       ├── base/                    # Base utilities
│       ├── platform/                # Platform services (DI, lifecycle)
│       ├── editor/                  # Monaco Editor core
│       └── workbench/               # VSCode Workbench (UI, editors, views)
│           ├── browser/             # Browser-specific code
│           ├── electron-sandbox/    # Electron renderer code
│           ├── services/            # Core services (files, config, etc)
│           └── contrib/             # Features/contributions
│               ├── files/           # File explorer
│               ├── search/          # Search panel
│               └── [YOUR_FEATURE]/  # Nơi bạn sẽ thêm code
```

### 2.2 VSCode Contribution Model

VSCode dùng **Dependency Injection (DI)** pattern:

```typescript
// Mỗi feature là một "contribution" trong contrib/
// Example: src/vs/workbench/contrib/aiEditor/

contrib/aiEditor/
├── browser/              # UI code (views, editors)
│   ├── aiEditorInput.ts
│   ├── aiEditorPane.ts
│   └── aiEditor.contribution.ts
├── common/               # Shared logic
│   ├── aiEditor.ts
│   └── aiEditorService.ts
└── node/                 # Node.js backend (LLM, extraction)
    ├── llmService.ts
    └── webContentExtractor.ts
```

---

## Bước 3: Tạo AI Editor Contribution

### 3.1 Tạo Thư Mục Contribution

```powershell
cd d:\Dev\vscode
mkdir -p src/vs/workbench/contrib/aiEditor/browser
mkdir -p src/vs/workbench/contrib/aiEditor/common
mkdir -p src/vs/workbench/contrib/aiEditor/node
```

### 3.2 Tạo Service Interface (common/aiEditorService.ts)

```typescript
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const IAIEditorService = createDecorator<IAIEditorService>('aiEditorService');

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface IAIEditorService {
	readonly _serviceBrand: undefined;

	/**
	 * Set website context for chat
	 */
	setWebsiteContext(content: string): void;

	/**
	 * Send chat message
	 */
	sendMessage(userMessage: string): Promise<string>;

	/**
	 * Clear chat history
	 */
	clearHistory(): void;

	/**
	 * Extract content from URL
	 */
	extractContent(url: string): Promise<string>;
}
```

### 3.3 Implement Service (node/aiEditorService.ts)

```typescript
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAIEditorService, ChatMessage } from 'vs/workbench/contrib/aiEditor/common/aiEditorService';
import axios from 'axios';
import * as https from 'https';

export class AIEditorService implements IAIEditorService {
	declare readonly _serviceBrand: undefined;

	private baseURL: string = 'https://apifreellm.com/api/chat';
	private chatHistory: ChatMessage[] = [];
	private websiteContext: string = '';

	setWebsiteContext(content: string): void {
		this.websiteContext = content;
		this.chatHistory = [];
	}

	clearHistory(): void {
		this.chatHistory = [];
	}

	async sendMessage(userMessage: string): Promise<string> {
		this.chatHistory.push({ role: 'user', content: userMessage });

		try {
			const messages: ChatMessage[] = [];
			
			if (this.websiteContext) {
				messages.push({
					role: 'system',
					content: `Answer questions based on this website:\n\n${this.truncateContent(this.websiteContext, 1000)}`
				});
			}
			
			messages.push(...this.chatHistory);

			const response = await this.callAPI(messages);
			
			this.chatHistory.push({ role: 'assistant', content: response });
			return response;
		} catch (error) {
			this.chatHistory.pop();
			throw error;
		}
	}

	async extractContent(url: string): Promise<string> {
		const httpsAgent = new https.Agent({ rejectUnauthorized: false });
		
		const response = await axios.get(url, { 
			httpsAgent,
			timeout: 10000 
		});

		const html = response.data;
		return this.extractTextFromHTML(html);
	}

	private async callAPI(messages: ChatMessage[]): Promise<string> {
		let fullMessage = '';
		
		const systemMsg = messages.find(m => m.role === 'system');
		if (systemMsg) {
			fullMessage += systemMsg.content + '\n\n';
		}
		
		const chatMessages = messages.filter(m => m.role !== 'system');
		const recentMessages = chatMessages.slice(-6);
		if (recentMessages.length > 0) {
			fullMessage += 'Recent conversation:\n';
			recentMessages.forEach(msg => {
				const role = msg.role === 'user' ? 'User' : 'Assistant';
				fullMessage += `${role}: ${msg.content}\n`;
			});
		}

		const httpsAgent = new https.Agent({ rejectUnauthorized: false });

		const response = await axios.post(
			this.baseURL,
			{ message: fullMessage },
			{
				headers: { 'Content-Type': 'application/json' },
				httpsAgent,
				timeout: 60000
			}
		);

		if (response.data.status === 'success' && response.data.response) {
			return response.data.response.trim();
		}
		throw new Error(response.data?.error || 'No response from API');
	}

	private extractTextFromHTML(html: string): string {
		let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
		text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
		text = text.replace(/<[^>]+>/g, ' ');
		text = text.replace(/&nbsp;/g, ' ');
		text = text.replace(/&amp;/g, '&');
		text = text.replace(/&lt;/g, '<');
		text = text.replace(/&gt;/g, '>');
		text = text.replace(/\s+/g, ' ');
		return text.trim();
	}

	private truncateContent(content: string, maxChars: number): string {
		return content.length <= maxChars 
			? content 
			: content.substring(0, maxChars) + '\n\n[Content truncated...]';
	}
}
```

### 3.4 Tạo Editor Input (browser/aiEditorInput.ts)

```typescript
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { URI } from 'vs/base/common/uri';
import { Emitter } from 'vs/base/common/event';

export class AIEditorInput extends EditorInput {
	static readonly ID = 'workbench.input.aiEditor';

	private readonly _onDidChangeLabel = this._register(new Emitter<void>());
	readonly onDidChangeLabel = this._onDidChangeLabel.event;

	private _name: string;
	private _url: string;

	constructor(
		name: string = 'AI Browser',
		url: string = ''
	) {
		super();
		this._name = name;
		this._url = url;
	}

	override get typeId(): string {
		return AIEditorInput.ID;
	}

	override getName(): string {
		return this._name;
	}

	get url(): string {
		return this._url;
	}

	setUrl(url: string): void {
		this._url = url;
		this._onDidChangeLabel.fire();
	}

	override matches(other: unknown): boolean {
		return other instanceof AIEditorInput;
	}

	override get resource(): URI | undefined {
		return undefined;
	}
}
```

### 3.5 Tạo Editor Pane (browser/aiEditorPane.ts)

```typescript
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditorPane } from 'vs/workbench/browser/parts/editor/editorPane';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { AIEditorInput } from 'vs/workbench/contrib/aiEditor/browser/aiEditorInput';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IAIEditorService } from 'vs/workbench/contrib/aiEditor/common/aiEditorService';
import * as dom from 'vs/base/browser/dom';

export class AIEditorPane extends EditorPane {
	static readonly ID = 'workbench.editor.aiEditor';

	private container: HTMLElement | undefined;
	private webview: HTMLIFrameElement | undefined;
	private chatContainer: HTMLElement | undefined;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IAIEditorService private readonly aiEditorService: IAIEditorService
	) {
		super(AIEditorPane.ID, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		this.container = parent;
		this.render();
	}

	private render(): void {
		if (!this.container) return;

		// Clear
		dom.clearNode(this.container);

		// Create layout (80-20 split)
		const wrapper = dom.append(this.container, dom.$('.ai-editor-wrapper'));
		
		// Browser panel (80%)
		const browserPanel = dom.append(wrapper, dom.$('.browser-panel'));
		const controls = dom.append(browserPanel, dom.$('.browser-controls'));
		
		const urlInput = dom.append(controls, dom.$('input.url-input', {
			type: 'text',
			placeholder: 'Enter URL...',
			value: 'https://vnexpress.net'
		})) as HTMLInputElement;

		const loadBtn = dom.append(controls, dom.$('button.btn', undefined, 'Load'));
		const statusSpan = dom.append(controls, dom.$('span.status'));

		this.webview = dom.append(browserPanel, dom.$('iframe.webview', {
			sandbox: 'allow-same-origin allow-scripts'
		})) as HTMLIFrameElement;

		// Chat panel (20%)
		this.chatContainer = dom.append(wrapper, dom.$('.chat-panel'));
		const chatHeader = dom.append(this.chatContainer, dom.$('.chat-header'));
		dom.append(chatHeader, dom.$('h3', undefined, '💬 AI Assistant'));
		
		const clearBtn = dom.append(chatHeader, dom.$('button.btn-small', undefined, 'Clear'));
		
		const messagesDiv = dom.append(this.chatContainer, dom.$('.chat-messages'));
		dom.append(messagesDiv, dom.$('.chat-message.system', undefined, 
			'👋 Load a website and ask questions!'));

		const inputArea = dom.append(this.chatContainer, dom.$('.chat-input-area'));
		const chatInput = dom.append(inputArea, dom.$('textarea.chat-input', {
			placeholder: 'Ask a question...',
			rows: '3'
		})) as HTMLTextAreaElement;
		const sendBtn = dom.append(inputArea, dom.$('button.btn', undefined, 'Send'));

		// Event handlers
		loadBtn.onclick = async () => {
			const url = urlInput.value.trim();
			if (!url) return;

			statusSpan.textContent = 'Loading...';
			this.webview!.src = url;

			// Auto-extract when loaded
			this.webview!.onload = async () => {
				try {
					statusSpan.textContent = 'Extracting...';
					const content = await this.aiEditorService.extractContent(url);
					this.aiEditorService.setWebsiteContext(content);
					statusSpan.textContent = '✅ Ready';
					this.addMessage(messagesDiv, 'system', '📄 Content extracted! Ask questions now.');
				} catch (err) {
					statusSpan.textContent = '❌ Failed';
					this.addMessage(messagesDiv, 'system', `Error: ${err}`);
				}
			};
		};

		sendBtn.onclick = async () => {
			const message = chatInput.value.trim();
			if (!message) return;

			this.addMessage(messagesDiv, 'user', message);
			chatInput.value = '';

			const loadingMsg = this.addMessage(messagesDiv, 'assistant', '⏳ Thinking...');

			try {
				const response = await this.aiEditorService.sendMessage(message);
				loadingMsg.remove();
				this.addMessage(messagesDiv, 'assistant', response);
			} catch (err) {
				loadingMsg.remove();
				this.addMessage(messagesDiv, 'system', `Error: ${err}`);
			}
		};

		clearBtn.onclick = () => {
			this.aiEditorService.clearHistory();
			dom.clearNode(messagesDiv);
			this.addMessage(messagesDiv, 'system', '✨ Chat cleared!');
		};

		// Add CSS
		this.addStyles();
	}

	private addMessage(container: HTMLElement, role: string, content: string): HTMLElement {
		const msg = dom.append(container, dom.$(`.chat-message.${role}`, undefined, content));
		container.scrollTop = container.scrollHeight;
		return msg;
	}

	private addStyles(): void {
		const style = document.createElement('style');
		style.textContent = `
			.ai-editor-wrapper { display: flex; height: 100%; }
			.browser-panel { flex: 0 0 80%; display: flex; flex-direction: column; }
			.browser-controls { padding: 8px; display: flex; gap: 8px; background: #2d2d30; }
			.url-input { flex: 1; padding: 6px; background: #3c3c3c; border: 1px solid #3e3e42; color: #ccc; }
			.btn { padding: 6px 12px; background: #007acc; color: white; border: none; cursor: pointer; }
			.btn:hover { background: #1e88d8; }
			.webview { flex: 1; border: none; background: white; }
			.chat-panel { flex: 0 0 20%; display: flex; flex-direction: column; border-left: 1px solid #3e3e42; background: #1e1e1e; }
			.chat-header { padding: 12px; border-bottom: 1px solid #3e3e42; display: flex; justify-content: space-between; align-items: center; }
			.chat-header h3 { margin: 0; font-size: 14px; color: #ccc; }
			.btn-small { padding: 4px 8px; font-size: 12px; }
			.chat-messages { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
			.chat-message { padding: 8px; border-radius: 4px; font-size: 13px; }
			.chat-message.user { background: #007acc; color: white; align-self: flex-end; max-width: 80%; }
			.chat-message.assistant { background: #2d2d30; color: #ccc; }
			.chat-message.system { background: #3e3e42; color: #969696; font-size: 12px; }
			.chat-input-area { padding: 12px; border-top: 1px solid #3e3e42; }
			.chat-input { width: 100%; padding: 8px; background: #3c3c3c; border: 1px solid #3e3e42; color: #ccc; resize: none; margin-bottom: 8px; }
		`;
		document.head.appendChild(style);
	}

	override async setInput(input: AIEditorInput, options: any, context: any, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		// Render when input is set
		if (this.container) {
			this.render();
		}
	}

	override clearInput(): void {
		super.clearInput();
	}

	override layout(dimension: any): void {
		// Handle resize if needed
	}
}
```

### 3.6 Register Contribution (browser/aiEditor.contribution.ts)

```typescript
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { Registry } from 'vs/platform/registry/common/platform';
import { EditorPaneDescriptor, IEditorPaneRegistry } from 'vs/workbench/browser/editor';
import { EditorExtensions, IEditorFactoryRegistry } from 'vs/workbench/common/editor';
import { AIEditorInput } from 'vs/workbench/contrib/aiEditor/browser/aiEditorInput';
import { AIEditorPane } from 'vs/workbench/contrib/aiEditor/browser/aiEditorPane';
import { IAIEditorService } from 'vs/workbench/contrib/aiEditor/common/aiEditorService';
import { AIEditorService } from 'vs/workbench/contrib/aiEditor/node/aiEditorService';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';

// Register service
registerSingleton(IAIEditorService, AIEditorService, true);

// Register editor pane
Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		AIEditorPane,
		AIEditorPane.ID,
		localize('aiEditor', "AI Browser")
	),
	[new SyncDescriptor(AIEditorInput)]
);

// Register command to open AI Editor
CommandsRegistry.registerCommand('aiEditor.open', async (accessor: ServicesAccessor) => {
	const editorService = accessor.get(IEditorService);
	const input = new AIEditorInput();
	await editorService.openEditor(input);
});
```

---

## Bước 4: Wire vào VSCode Workbench

### 4.1 Thêm vào Workbench Contributions

Mở file: `src/vs/workbench/workbench.common.main.ts`

Thêm import vào cuối file:

```typescript
// AI Editor
import 'vs/workbench/contrib/aiEditor/browser/aiEditor.contribution';
```

### 4.2 Thêm Command vào Menu

Tạo file: `src/vs/workbench/contrib/aiEditor/browser/aiEditor.contribution.menu.ts`

```typescript
import { MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { localize } from 'vs/nls';

MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
	command: {
		id: 'aiEditor.open',
		title: { value: localize('openAIEditor', "Open AI Browser"), original: 'Open AI Browser' }
	}
});
```

Import vào `aiEditor.contribution.ts`:

```typescript
import 'vs/workbench/contrib/aiEditor/browser/aiEditor.contribution.menu';
```

---

## Bước 5: Build và Test

### 5.1 Build VSCode

```powershell
cd d:\Dev\vscode

# Build lần đầu (mất ~30 phút)
yarn watch

# Để terminal này chạy (auto rebuild khi code thay đổi)
```

### 5.2 Run VSCode Dev Build

Mở terminal mới:

```powershell
cd d:\Dev\vscode

# Run Electron development version
.\scripts\code.bat
```

### 5.3 Test AI Editor

1. VSCode window mới sẽ mở
2. Press `Ctrl+Shift+P`
3. Type: "Open AI Browser"
4. Select command
5. AI Editor sẽ mở như một editor tab

### 5.4 Debug

Press F5 trong VSCode để launch Extension Development Host với debugger attached.

---

## Bước 6: Package Custom VSCode Build

### 6.1 Build Production

```powershell
# Stop yarn watch first (Ctrl+C)

# Build production
yarn gulp vscode-win32-x64

# Output: .build/win32-x64/VSCode-win32-x64/
```

### 6.2 Create Installer

```powershell
# Install Inno Setup (Windows)
# Download: https://jrsoftware.org/isdl.php

# Build installer
yarn gulp vscode-win32-x64-inno-setup

# Output: .build/win32-x64/VSCode-win32-x64-setup.exe
```

### 6.3 Distribute

Custom VSCode build của bạn sẽ là standalone app với AI Browser integrated.

---

## Bước 7: Maintain Fork

### 7.1 Sync với Upstream

```powershell
# Fetch upstream changes
git fetch upstream

# Merge vào branch của bạn
git checkout main
git merge upstream/main

# Rebase feature branch
git checkout feature/ai-browser
git rebase main

# Resolve conflicts nếu có
```

### 7.2 Update Dependencies

```powershell
# VSCode update dependencies thường xuyên
yarn install
```

---

## 📌 Next Steps

### Immediate:
1. Fork VSCode repo
2. Tạo contribution module
3. Copy code từ guide này
4. Build và test local

### Short-term:
1. Thêm keybindings
2. Thêm menu items
3. Improve UI styling
4. Add persistence

### Long-term:
1. Maintain merge với upstream
2. Add tests
3. Documentation
4. Consider contributing back to VSCode (nếu feature đủ tốt)

---

## 🔧 Troubleshooting

### Build Errors

**Error: Cannot find module 'vs/...'**
```powershell
# Clean và rebuild
yarn clean
yarn install
yarn watch
```

**Error: node-gyp rebuild failed**
```powershell
# Install Visual Studio Build Tools
# Ensure Python 3.x is in PATH
```

### Runtime Errors

**Service not registered**
- Check `registerSingleton()` được gọi
- Verify DI constructor parameters

**Editor not opening**
- Check EditorPane registration
- Verify command registration in CommandsRegistry

---

## 📚 Resources

- [VSCode Architecture](https://github.com/microsoft/vscode/wiki/Source-Code-Organization)
- [Contributing to VSCode](https://github.com/microsoft/vscode/wiki/How-to-Contribute)
- [Extension API](https://code.visualstudio.com/api)
- [Building VSCode](https://github.com/microsoft/vscode/wiki/How-to-Contribute#build-and-run)

---

**Tác giả:** AI Assistant  
**Ngày tạo:** November 9, 2025  
**Status:** ✅ Complete Guide - Ready to Implement
