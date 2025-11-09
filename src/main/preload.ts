/**
 * Preload Script
 * Bridges main and renderer processes securely
 * Following VSCode's security pattern with contextBridge
 */

import { contextBridge, ipcRenderer } from 'electron';

/**
 * API exposed to renderer process
 * No API key management needed - using API Free LLM
 */
const api = {
    /**
     * Send chat message to LLM (with managed chat history)
     */
    sendChatMessage: (message: string): Promise<{
        success: boolean;
        response?: string;
        error?: string;
    }> => {
        return ipcRenderer.invoke('chat-message', message);
    },

    /**
     * Extract content from website and set as context
     */
    extractWebContent: (url: string): Promise<{
        success: boolean;
        content?: string;
        error?: string;
    }> => {
        return ipcRenderer.invoke('extract-content', url);
    },

    /**
     * Clear chat history
     */
    clearChatHistory: (): Promise<{ success: boolean }> => {
        return ipcRenderer.invoke('clear-chat-history');
    }
};

// Expose API to renderer
contextBridge.exposeInMainWorld('electronAPI', api);

// Type definitions for renderer
export type ElectronAPI = typeof api;
