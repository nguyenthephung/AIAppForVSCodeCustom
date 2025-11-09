/**
 * Main Process - Electron Application Entry Point
 * 
 * Architecture:
 * - Follows VSCode's main process pattern
 * - Manages application lifecycle
 * - Handles IPC communication with renderer
 * - Coordinates services (LLM, Web Content Extraction)
 * 
 * @see https://www.electronjs.org/docs/latest/tutorial/process-model
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { LLMService } from './services/llmService';
import { WebContentExtractor } from './services/webContentExtractor';

/**
 * Main Application Class
 * Orchestrates Electron app lifecycle and services
 */
class Application {
    private mainWindow: BrowserWindow | null = null;
    private llmService: LLMService;
    private webContentExtractor: WebContentExtractor;

    constructor() {
        this.llmService = new LLMService();
        this.webContentExtractor = new WebContentExtractor();
        this.registerListeners();
    }

    /**
     * Create main application window
     * Uses VSCode-like window configuration
     */
    private createWindow(): void {
        this.mainWindow = new BrowserWindow({
            width: 1400,
            height: 900,
            minWidth: 800,
            minHeight: 600,
            title: 'VSCode AI App',
            backgroundColor: '#1e1e1e',
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js'),
                webviewTag: true,
                // Disable GPU to avoid crashes on some systems
                offscreen: false
            }
        });

        this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

        // Open DevTools in development
        if (process.env.NODE_ENV === 'development') {
            this.mainWindow.webContents.openDevTools();
        }

        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });
    }

    /**
     * Register IPC handlers for renderer communication
     * Similar to VSCode's IPC pattern
     */
    private registerListeners(): void {
        // Disable GPU to avoid crashes
        app.disableHardwareAcceleration();

        app.on('ready', () => this.createWindow());

        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });

        app.on('activate', () => {
            if (this.mainWindow === null) {
                this.createWindow();
            }
        });

        // IPC Handlers
        // No API key needed - API Free LLM is hardcoded
        ipcMain.handle('set-website-context', async (_event, content: string) => {
            this.llmService.setWebsiteContext(content);
            return { success: true };
        });

        ipcMain.handle('chat-message', async (_event, message: string) => {
            try {
                const response = await this.llmService.sendMessage(message);
                return { success: true, response };
            } catch (error) {
                return { 
                    success: false, 
                    error: error instanceof Error ? error.message : 'Unknown error' 
                };
            }
        });

        ipcMain.handle('clear-chat-history', async () => {
            this.llmService.clearHistory();
            return { success: true };
        });

        ipcMain.handle('extract-content', async (_event, url: string) => {
            try {
                const content = await this.webContentExtractor.extract(url);
                // Automatically set website context after extraction
                this.llmService.setWebsiteContext(content);
                return { success: true, content };
            } catch (error) {
                return { 
                    success: false, 
                    error: error instanceof Error ? error.message : 'Failed to extract content' 
                };
            }
        });
    }

    public run(): void {
        // Application entry point
    }
}

// Start application
const application = new Application();
application.run();
