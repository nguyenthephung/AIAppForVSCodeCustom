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
    private lastExtractedUrl: string = '';
    private extractingUrls: Set<string> = new Set();
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
            // NOTE: did-finish-load fires after page fully loads, which is the right time to extract.
            // We don't listen to did-navigate or did-navigate-in-page to avoid duplicate extractions.
            this.autoExtractContent();
        });

        this.webview.addEventListener('did-fail-load', (event: unknown) => {
            // Event shape: { errorCode, errorDescription, validatedURL, isMainFrame }
            const err = event as { errorCode?: number; errorDescription?: string; validatedURL?: string; isMainFrame?: boolean };

            // Ignore failures for subresources (only care about main frame)
            if (typeof err.isMainFrame === 'boolean' && !err.isMainFrame) {
                return;
            }

            // Ignore aborted navigations (ERR_ABORTED, code -3) which happen during normal navigation
            if (err.errorCode === -3) {
                return;
            }

            // If we already extracted content for the current page, don't show the failure notification.
            try {
                const currentUrl = (typeof this.webview.getURL === 'function') ? this.webview.getURL() : (this.webview.src as string);
                if (this.isContentExtracted && err.validatedURL && currentUrl && err.validatedURL === currentUrl) {
                    return;
                }
            } catch {
                // ignore errors when calling getURL
            }

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
                            Chat history cleared! Ready for new questions.
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
        this.lastExtractedUrl = '';
        this.webview.src = url;
        this.updateExtractStatus('Loading website...');
    }

    /**
     * Auto-extract content when webpage finishes loading
     */
    private async autoExtractContent(): Promise<void> {
        const urlInput = document.getElementById('urlInput') as HTMLInputElement;

        // Use the webview's current URL to handle in-page navigation (clicking links,
        // SPA route changes, etc.). Fall back to the URL input value if unavailable.
        const webviewUrl = (typeof this.webview.getURL === 'function') ? this.webview.getURL() : (this.webview.src as string) || '';
        let url = (webviewUrl || '').toString().trim() || (urlInput?.value || '').trim();

        if (!url) {
            return;
        }

        // If we've already successfully extracted this exact URL, skip re-extraction
        if (this.isContentExtracted && this.lastExtractedUrl && this.lastExtractedUrl === url) {
            // Keep status up to date but avoid duplicate notifications
            this.updateExtractStatus('Content ready');
            return;
        }

        // If an extraction for this URL is already in-flight, skip to avoid duplicate API calls
        if (this.extractingUrls.has(url)) {
            // Another extraction is running; avoid duplicate notifications
            return;
        }

        // Keep the URL input in sync with the actual webview URL
        if (urlInput && urlInput.value !== url) {
            urlInput.value = url;
        }

    this.updateExtractStatus('Extracting content...');

        // Mark as extracting to prevent concurrent work for the same URL
        this.extractingUrls.add(url);
        try {
            const result = await this.api.extractWebContent(url);

            if (result.success && result.content) {
                this.isContentExtracted = true;
                this.updateExtractStatus('Content ready');
                // Only notify the user when the extracted URL changes
                if (this.lastExtractedUrl !== url) {
                    this.addChatMessage('system', `Content extracted! You can now ask questions about this page.`);
                    this.lastExtractedUrl = url;
                }
            } else {
                this.isContentExtracted = false;
                this.updateExtractStatus('Extract failed');
                this.addChatMessage('system', `Failed to extract content: ${result.error}`);
            }
        } catch (error) {
            this.isContentExtracted = false;
            this.updateExtractStatus('Error');
            this.addChatMessage('system', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            // Clear in-flight marker
            this.extractingUrls.delete(url);
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
            this.addChatMessage('system', 'Please wait for content extraction to complete, or load a website first.');
            return;
        }

        // Add user message
        this.addChatMessage('user', message);
        chatInput.value = '';

        // Show loading
    const loadingId = this.addChatMessage('assistant', 'Thinking...');

        try {
            const result = await this.api.sendChatMessage(message);
            
            // Remove loading message
            this.removeChatMessage(loadingId);

            if (result.success && result.response) {
                this.addChatMessage('assistant', result.response);
            } else {
                this.addChatMessage('system', `Error: ${result.error}`);
            }
        } catch (error) {
            this.removeChatMessage(loadingId);
            this.addChatMessage('system', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
