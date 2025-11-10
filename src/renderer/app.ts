/**
 * Renderer Process - UI Logic
 * 
 * Handles user interactions, webview management, and chat interface
 * 
 * Features:
 * - Automatic content extraction on page load
 * - Real-time chat with AI about website content
 * - Chat history with clear functionality
 * - Clean HTML formatting for AI responses
 * - VSCode-inspired dark theme UI
 */

/**
 * Electron API interface (injected by preload script)
 */
interface ElectronAPI {
    sendChatMessage: (message: string) => Promise<{
        success: boolean;
        response?: string;
        error?: string;
    }>;
    extractWebContent: (url: string) => Promise<{
        success: boolean;
        content?: string;
        error?: string;
    }>;
    clearChatHistory: () => Promise<{ success: boolean }>;
}

/**
 * Main Application Class
 * Manages the AI-powered browser interface
 */
class AIApp {
    private webview: Electron.WebviewTag;
    private isContentExtracted: boolean = false;
    private readonly api: ElectronAPI;

    constructor() {
        // Type-safe access to electronAPI
        this.api = (window as unknown as { electronAPI: ElectronAPI }).electronAPI;
        
        this.webview = document.getElementById('webview') as Electron.WebviewTag;
        this.initializeUI();
        this.registerEventHandlers();
        
        // Load default website
        this.loadDefaultWebsite();
    }

    /**
     * Load default website on startup
     */
    private loadDefaultWebsite(): void {
        const urlInput = document.getElementById('urlInput') as HTMLInputElement;
        const defaultUrl = urlInput.value || 'https://vnexpress.net';
        this.webview.src = defaultUrl;
    }

    /**
     * Initialize UI components
     */
    private initializeUI(): void {
        // No initialization needed - API Free LLM is ready to use
    }

    /**
     * Register all event handlers
     */
    private registerEventHandlers(): void {
        // Clear chat button
        const clearChatBtn = document.getElementById('clearChatBtn');
        clearChatBtn?.addEventListener('click', () => this.handleClearChat());

        // Browser handlers
        const loadBtn = document.getElementById('loadBtn');
        loadBtn?.addEventListener('click', () => this.handleLoadUrl());

        const urlInput = document.getElementById('urlInput') as HTMLInputElement;
        urlInput?.addEventListener('keypress', (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                this.handleLoadUrl();
            }
        });

        // Chat handlers
        const sendBtn = document.getElementById('sendBtn');
        sendBtn?.addEventListener('click', () => this.handleSendMessage());

        const chatInput = document.getElementById('chatInput') as HTMLTextAreaElement;
        chatInput?.addEventListener('keypress', (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSendMessage();
            }
        });

        // Webview handlers
        this.webview.addEventListener('did-finish-load', () => {
            // Auto-extract content when page loads
            this.autoExtractContent();
        });

        this.webview.addEventListener('did-fail-load', (event: unknown) => {
            const err = event as { errorDescription?: string };
            this.addChatMessage('system', `Failed to load website: ${err.errorDescription || 'Unknown error'}`);
        });
    }

    /**
     * Handle clear chat history
     */
    private async handleClearChat(): Promise<void> {
        try {
            await this.api.clearChatHistory();
            
            // Clear chat messages from UI
            const chatMessages = document.getElementById('chatMessages') as HTMLDivElement;
            chatMessages.innerHTML = `
                <div class="chat-message system">
                    <div class="message-content">
                        ✨ Chat history cleared! Ready for new questions.
                    </div>
                </div>
            `;
        } catch (error) {
            // Silently fail - chat history will still clear on backend
        }
    }

    /**
     * Handle load URL
     */
    private handleLoadUrl(): void {
        const urlInput = document.getElementById('urlInput') as HTMLInputElement;
        let url = urlInput.value.trim();

        if (!url) {
            return;
        }

        // Add https:// if no protocol specified
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
            urlInput.value = url;
        }

        this.isContentExtracted = false;
        this.webview.src = url;
        this.updateExtractStatus('Loading website...');
    }

    /**
     * Auto-extract content when webpage finishes loading
     */
    private async autoExtractContent(): Promise<void> {
        const urlInput = document.getElementById('urlInput') as HTMLInputElement;
        const url = urlInput.value.trim();

        if (!url) {
            return;
        }

        this.updateExtractStatus('📥 Extracting content...');

        try {
            const result = await this.api.extractWebContent(url);
            
            if (result.success && result.content) {
                this.isContentExtracted = true;
                this.updateExtractStatus('✅ Content ready');
                this.addChatMessage('system', `📄 Content extracted! You can now ask questions about this page.`);
            } else {
                this.isContentExtracted = false;
                this.updateExtractStatus('❌ Extract failed');
                this.addChatMessage('system', `⚠️ Failed to extract content: ${result.error}`);
            }
        } catch (error) {
            this.isContentExtracted = false;
            this.updateExtractStatus('❌ Error');
            this.addChatMessage('system', `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Update extraction status indicator
     */
    private updateExtractStatus(message: string): void {
        const statusElement = document.getElementById('extractStatus');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    /**
     * Handle send chat message
     */
    private async handleSendMessage(): Promise<void> {
        const chatInput = document.getElementById('chatInput') as HTMLTextAreaElement;
        const message = chatInput.value.trim();

        if (!message) {
            return;
        }

        // Check if content has been extracted
        if (!this.isContentExtracted) {
            this.addChatMessage('system', '⚠️ Please wait for content extraction to complete, or load a website first.');
            return;
        }

        // Add user message
        this.addChatMessage('user', message);
        chatInput.value = '';

        // Show loading
        const loadingId = this.addChatMessage('assistant', '⏳ Thinking...');

        try {
            const result = await this.api.sendChatMessage(message);
            
            // Remove loading message
            this.removeChatMessage(loadingId);

            if (result.success && result.response) {
                this.addChatMessage('assistant', result.response);
            } else {
                this.addChatMessage('system', `❌ Error: ${result.error}`);
            }
        } catch (error) {
            this.removeChatMessage(loadingId);
            this.addChatMessage('system', `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Add message to chat with proper HTML formatting
     */
    private addChatMessage(role: 'user' | 'assistant' | 'system', content: string): string {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) {
            return '';
        }

        const messageId = `msg-${Date.now()}-${Math.random()}`;
        const messageDiv = document.createElement('div');
        messageDiv.id = messageId;
        messageDiv.className = `chat-message ${role}`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Convert text formatting to HTML for better readability
        contentDiv.innerHTML = this.formatMessageToHTML(content);

        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);

        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;

        return messageId;
    }

    /**
     * Convert plain text with formatting to HTML
     */
    private formatMessageToHTML(text: string): string {
        // Escape HTML to prevent XSS
        let html = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Split into lines for processing
        const lines = html.split('\n');
        const formatted: string[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip empty lines but preserve spacing
            if (!line) {
                if (i > 0 && formatted.length > 0) {
                    formatted.push('<div class="line-break"></div>');
                }
                continue;
            }
            
            // Bullet points
            if (/^[•\-*]\s+/.test(line)) {
                const content = line.replace(/^[•\-*]\s+/, '');
                formatted.push(`<div class="bullet-point">• ${content}</div>`);
            }
            // Numbered lists
            else if (/^\d+\.\s+/.test(line)) {
                const match = line.match(/^(\d+)\.\s+(.+)$/);
                if (match) {
                    formatted.push(`<div class="numbered-item">${match[1]}. ${match[2]}</div>`);
                } else {
                    formatted.push(`<div>${line}</div>`);
                }
            }
            // Headers (lines ending with :)
            else if (/^.+:$/.test(line) && line.length < 100) {
                formatted.push(`<div class="section-header"><strong>${line}</strong></div>`);
            }
            // Regular text
            else {
                formatted.push(`<div>${line}</div>`);
            }
        }

        // Join and apply final formatting
        html = formatted.join('');

        // Convert **bold** if any remains
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        
        // Convert *italic*
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

        return html;
    }

    /**
     * Remove chat message by ID
     */
    private removeChatMessage(messageId: string): void {
        const message = document.getElementById(messageId);
        if (message) {
            message.remove();
        }
    }

}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new AIApp();
});
