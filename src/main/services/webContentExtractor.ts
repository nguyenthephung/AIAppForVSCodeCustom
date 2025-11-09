/**
 * Web Content Extractor
 * Extracts readable text content from web pages
 * Used to provide context to the LLM
 */

import axios from 'axios';
import * as https from 'https';

/* eslint-disable @typescript-eslint/naming-convention */

export class WebContentExtractor {
    /**
     * Extract text content from a URL
     */
    public async extract(url: string): Promise<string> {
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000,
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false // Bypass SSL verification
                })
            });

            const html = response.data;
            return this.extractTextFromHTML(html);
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Failed to fetch URL: ${error.message}`);
            }
            if (error instanceof Error) {
                throw new Error(error.message);
            }
            throw new Error(String(error));
        }
    }

    /**
     * Extract text from HTML, removing scripts and styles
     * Simple implementation - can be enhanced with proper HTML parser
     */
    private extractTextFromHTML(html: string): string {
        // Remove script tags
        let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        
        // Remove style tags
        text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
        
        // Remove HTML tags
        text = text.replace(/<[^>]+>/g, ' ');
        
        // Decode HTML entities
        text = this.decodeHTMLEntities(text);
        
        // Clean up whitespace
        text = text.replace(/\s+/g, ' ').trim();
        
        return text;
    }

    /**
     * Decode common HTML entities
     */
    private decodeHTMLEntities(text: string): string {
        const entities: { [key: string]: string } = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#39;': "'",
            '&nbsp;': ' '
        };

        return text.replace(/&[^;]+;/g, (entity) => entities[entity] || entity);
    }
}
