/**
 * LLM Service - Clean & Production Ready
 * 
 * Handles communication with Google Gemini API
 * 
 * Features:
 * - Environment-based configuration (.env file)
 * - Automatic retry with exponential backoff
 * - Clean markdown formatting for responses
 * - Client-side chat history management
 * - Automatic context injection from website content
 * 
 * @see https://ai.google.dev/gemini-api/docs
 */

import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/* eslint-disable @typescript-eslint/naming-convention */

/**
 * Configuration from environment variables
 */
interface LLMConfig {
    apiKey: string;
    modelName: string;
    maxRetries: number;
    requestTimeout: number;
    contextMaxChars: number;
    maxOutputTokens: number;
    temperature: number;
}

/**
 * Chat message interface
 */
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * LLM Service class
 */
export class LLMService {
    private readonly config: LLMConfig;
    private genAI!: GoogleGenerativeAI;
    private model!: GenerativeModel;
    private chatHistory: ChatMessage[] = [];
    private websiteContext: string = '';

    constructor() {
        // Load configuration from environment
        this.config = {
            apiKey: process.env.GEMINI_API_KEY || '',
            modelName: process.env.GEMINI_MODEL || 'gemini-pro',
            maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
            requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
            contextMaxChars: parseInt(process.env.CONTEXT_MAX_CHARS || '5000', 10),
            maxOutputTokens: 2048,
            temperature: 0.7
        };

        if (!this.config.apiKey) {
            throw new Error('GEMINI_API_KEY not found in .env file');
        }

        this.initializeModel();
    }

    /**
     * Initialize Gemini model
     */
    private initializeModel(): void {
        this.genAI = new GoogleGenerativeAI(this.config.apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: this.config.modelName,
            generationConfig: {
                maxOutputTokens: this.config.maxOutputTokens,
                temperature: this.config.temperature,
            }
        });
    }

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
     * Send message with full chat history and get formatted response
     */
    public async sendMessage(userMessage: string): Promise<string> {
        this.chatHistory.push({
            role: 'user',
            content: userMessage
        });

        try {
            const messages: ChatMessage[] = [];
            
            // Add system prompt with website context and formatting instructions
            if (this.websiteContext) {
                messages.push({
                    role: 'system',
                    content: this.buildSystemPrompt()
                });
            }
            
            messages.push(...this.chatHistory);

            const response = await this.callAPI(messages);
            const formattedResponse = this.formatResponse(response);
            
            this.chatHistory.push({
                role: 'assistant',
                content: formattedResponse
            });

            return formattedResponse;
        } catch (error) {
            this.chatHistory.pop(); // Remove failed user message
            throw error;
        }
    }

    /**
     * Build system prompt with formatting instructions
     */
    private buildSystemPrompt(): string {
        const truncatedContext = this.truncateContent(this.websiteContext, this.config.contextMaxChars);
        
        return `You are a helpful AI assistant. Answer questions based on the website content provided below.

FORMATTING RULES:
- Use clean, readable formatting
- Use bullet points (•) instead of asterisks (*)
- Use proper line breaks between sections
- Keep responses concise and well-organized
- Use emojis sparingly and appropriately
- For Vietnamese content, respond in Vietnamese
- For English content, respond in English

WEBSITE CONTENT:
${truncatedContext}

Please provide clear, accurate answers based on this content.`;
    }

    /**
     * Format AI response for better readability
     */
    private formatResponse(text: string): string {
        let formatted = text;

        // Remove excessive markdown formatting
        formatted = formatted.replace(/\*\*\*/g, ''); // Remove triple asterisks
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '$1'); // Remove bold formatting
        formatted = formatted.replace(/\*([^*]+)\*/g, '$1'); // Remove italic formatting
        
        // Clean up bullet points
        formatted = formatted.replace(/^\* /gm, '• '); // Replace * with •
        formatted = formatted.replace(/^- /gm, '• '); // Replace - with •
        
        // Clean up numbered lists
        formatted = formatted.replace(/^\d+\.\s+/gm, (match) => {
            const num = match.match(/^\d+/)?.[0];
            return `${num}. `;
        });
        
        // Remove excessive line breaks (more than 2)
        formatted = formatted.replace(/\n{3,}/g, '\n\n');
        
        // Ensure proper spacing after sections
        formatted = formatted.replace(/([.!?])\n(?=[A-Z•\d])/g, '$1\n\n');
        
        return formatted.trim();
    }

    /**
     * Call Google Gemini API with retry logic and exponential backoff
     */
    private async callAPI(messages: ChatMessage[]): Promise<string> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
            try {
                const prompt = this.buildPrompt(messages);
                
                // Call API with timeout
                const result = await Promise.race([
                    this.model.generateContent(prompt),
                    this.createTimeout(this.config.requestTimeout)
                ]);

                const response = await (result as Awaited<ReturnType<typeof this.model.generateContent>>).response;
                const text = response.text();

                if (!text) {
                    throw new Error('Empty response from Gemini API');
                }

                return text.trim();
            } catch (error: unknown) {
                lastError = error instanceof Error ? error : new Error(String(error));
                
                console.error(`[LLM] Attempt ${attempt + 1}/${this.config.maxRetries} failed:`, lastError.message);
                
                // Handle specific errors
                const shouldRetry = this.handleError(lastError, attempt);
                
                if (!shouldRetry || attempt === this.config.maxRetries - 1) {
                    break;
                }
                
                // Exponential backoff: 1s, 2s, 4s
                const waitTime = Math.pow(2, attempt) * 1000;
                console.log(`[LLM] Retrying in ${waitTime/1000}s...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        
        throw new Error(`Gemini API Error (after ${this.config.maxRetries} retries): ${lastError?.message || 'Unknown error'}`);
    }

    /**
     * Build prompt from messages
     */
    private buildPrompt(messages: ChatMessage[]): string {
        let prompt = '';
        
        const systemMsg = messages.find(m => m.role === 'system');
        if (systemMsg) {
            prompt += systemMsg.content + '\n\n';
        }
        
        const chatMessages = messages.filter(m => m.role !== 'system');
        if (chatMessages.length > 0) {
            prompt += 'Conversation:\n';
            chatMessages.forEach(msg => {
                const role = msg.role === 'user' ? 'User' : 'Assistant';
                prompt += `${role}: ${msg.content}\n`;
            });
        }
        
        return prompt;
    }

    /**
     * Create timeout promise
     */
    private createTimeout(ms: number): Promise<never> {
        return new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Request timeout after ${ms/1000}s`)), ms)
        );
    }

    /**
     * Handle API errors and determine if retry is needed
     */
    private handleError(error: Error, attempt: number): boolean {
        const errorMsg = error.message.toLowerCase();
        const isLastAttempt = attempt === this.config.maxRetries - 1;
        
        // Non-retryable errors
        if (errorMsg.includes('api key') || errorMsg.includes('api_key_invalid')) {
            throw new Error('Invalid API key. Check GEMINI_API_KEY in .env file\nGet your key at: https://aistudio.google.com/app/apikey');
        }
        
        if (errorMsg.includes('model not found')) {
            throw new Error(`Model "${this.config.modelName}" not found.\nAvailable: gemini-pro, gemini-1.5-pro, gemini-1.5-flash`);
        }
        
        if (errorMsg.includes('billing') || errorMsg.includes('payment')) {
            throw new Error('Billing not enabled. Enable at: https://console.cloud.google.com/billing');
        }
        
        // Retryable errors
        if (errorMsg.includes('quota') || errorMsg.includes('resource_exhausted')) {
            if (isLastAttempt) {
                throw new Error('API quota exceeded.\n• Free tier: 15 req/min, 1,500 req/day\n• Upgrade at: https://ai.google.dev/pricing');
            }
            return true;
        }
        
        if (errorMsg.includes('rate limit') || errorMsg.includes('too many requests')) {
            if (isLastAttempt) {
                throw new Error('Rate limit reached. Please wait 1 minute.');
            }
            return true;
        }
        
        if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('timeout')) {
            if (isLastAttempt) {
                throw new Error('Network error. Check:\n1. Internet connection\n2. Firewall settings\n3. Try again later');
            }
            return true;
        }
        
        // Unknown errors - retry
        return true;
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
