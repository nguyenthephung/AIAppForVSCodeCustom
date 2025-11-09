/**
 * LLM Service
 * Handles communication with API Free LLM
 * Features:
 * - Client-side chat history management
 * - Automatic context injection from website content
 * - No authentication required
 * 
 * @see https://apifreellm.com for API documentation
 */

import axios from 'axios';
import * as https from 'https';

/* eslint-disable @typescript-eslint/naming-convention */

/**
 * Chat message interface compatible with OpenAI format
 */
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * LLM Service class
 * Manages conversation history and API communication
 */
export class LLMService {
    // API Free LLM endpoint (hardcoded - no user input needed)
    private baseURL: string = 'https://apifreellm.com/api/chat';
    
    // Chat history management (since API doesn't store history)
    private chatHistory: ChatMessage[] = [];
    private websiteContext: string = '';

    /**
     * Set website context for all future chats
     * Resets chat history when website changes
     */
    public setWebsiteContext(content: string): void {
        this.websiteContext = content;
        // Reset chat history when website changes
        this.chatHistory = [];
    }

    /**
     * Clear chat history
     */
    public clearHistory(): void {
        this.chatHistory = [];
    }

    /**
     * Get current chat history
     */
    public getHistory(): ChatMessage[] {
        return [...this.chatHistory];
    }

    /**
     * Send message with full chat history
     */
    public async sendMessage(userMessage: string): Promise<string> {
        // Add user message to history
        this.chatHistory.push({
            role: 'user',
            content: userMessage
        });

        try {
            // Build messages array with context and full history
            const messages: ChatMessage[] = [];
            
            // System message with website context
            if (this.websiteContext) {
                messages.push({
                    role: 'system',
                    content: `You are a helpful assistant. Answer questions based on this website content:\n\n${this.truncateContent(this.websiteContext, 3000)}`
                });
            }
            
            // Add all chat history
            messages.push(...this.chatHistory);

            const response = await this.callAPI(messages);
            
            // Add assistant response to history
            this.chatHistory.push({
                role: 'assistant',
                content: response
            });

            return response;
        } catch (error) {
            // Remove failed user message from history
            this.chatHistory.pop();
            throw error;
        }
    }

    /**
     * Call API Free LLM endpoint
     */
    private async callAPI(messages: ChatMessage[]): Promise<string> {
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });

        try {
            // Build the message with context and chat history
            let fullMessage = '';
            
            // Add website context from system message (truncated)
            const systemMsg = messages.find(m => m.role === 'system');
            if (systemMsg) {
                // Truncate context to avoid overloading free API
                const truncatedContext = this.truncateContent(systemMsg.content, 1000);
                fullMessage += truncatedContext + '\n\n';
            }
            
            // Add only recent chat history (last 3 exchanges to keep it short)
            const chatMessages = messages.filter(m => m.role !== 'system');
            const recentMessages = chatMessages.slice(-6); // Last 3 user+assistant pairs
            if (recentMessages.length > 0) {
                fullMessage += 'Recent conversation:\n';
                recentMessages.forEach(msg => {
                    const role = msg.role === 'user' ? 'User' : 'Assistant';
                    fullMessage += `${role}: ${msg.content}\n`;
                });
            }
            
            // Get the last user message as the main question
            const lastUserMsg = messages.filter(m => m.role === 'user').pop();
            const question = lastUserMsg ? lastUserMsg.content : '';

            const response = await axios.post(
                this.baseURL,
                {
                    message: fullMessage || question
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                        // No API key needed for API Free LLM
                    },
                    httpsAgent,
                    timeout: 60000 // Increase to 60 seconds for slow API
                }
            );

            // Check response format
            if (response.data.status === 'success' && response.data.response) {
                return response.data.response.trim();
            } else if (response.data.error) {
                throw new Error(response.data.error);
            } else {
                throw new Error('No response from API');
            }
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const code = error.code;
                const status = error.response?.status;
                
                // Enhanced error messages
                if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
                    throw new Error(`Cannot connect to API Free LLM. Please check your internet connection.`);
                }
                if (code === 'ETIMEDOUT') {
                    throw new Error(`API Free LLM request timeout. The service might be slow or unavailable.`);
                }
                if (status === 429) {
                    throw new Error(`Rate limit reached. Please wait a moment and try again.`);
                }
                if (status === 503) {
                    throw new Error(`API Free LLM service is busy. Please try again later.`);
                }
                if (status === 522) {
                    throw new Error(`API Free LLM server timeout (522). The service might be overloaded. Try:\n1. Wait a few seconds and try again\n2. Ask a shorter question\n3. The API might be temporarily down`);
                }
                if (status === 524) {
                    throw new Error(`API Free LLM timeout (524). Server took too long to respond.`);
                }
                
                const message = error.response?.data?.error?.message || error.message;
                throw new Error(`API Free LLM Error: ${message}`);
            }
            if (error instanceof Error) {
                throw new Error(error.message);
            }
            throw new Error(String(error));
        }
    }

    /**
     * Truncate content to fit token limit
     */
    private truncateContent(content: string, maxChars: number): string {
        if (content.length <= maxChars) {
            return content;
        }
        return content.substring(0, maxChars) + '\n\n[Content truncated...]';
    }
}
