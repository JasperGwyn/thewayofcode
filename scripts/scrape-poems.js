import fs from 'fs';
import https from 'https';
import path from 'path';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
function fetchHtml(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                return;
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        }).on('error', reject);
    });
}
function sanitizeText(text) {
    return text
        .replace(/\s+/g, ' ')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim();
}
async function scrapePoem(id) {
    const url = `https://www.thewayofcode.com/#${id}`;
    console.log(`Fetching poem ${id}: ${url}`);
    try {
        const html = await fetchHtml(url);
        const dom = new JSDOM(html, {
            url,
            referrer: url,
            contentType: 'text/html',
        });
        // Remove the left navigation (numbers)
        const doc = dom.window.document;
        const nav = doc.querySelector('nav, aside');
        if (nav && nav.parentNode) {
            nav.parentNode.removeChild(nav);
        }
        const articleNode = doc.querySelector('article') ?? doc.body;
        const reader = new Readability(dom.window.document);
        const parsed = reader.parse();
        // Try to extract title
        const titleElement = doc.querySelector('h1, h2, h3, title');
        const title = titleElement?.textContent?.trim();
        const rawText = parsed?.textContent ?? articleNode.textContent ?? '';
        const sanitized = sanitizeText(rawText);
        return {
            id,
            url,
            title,
            content: sanitized,
        };
    }
    catch (error) {
        console.error(`Error fetching poem ${id}:`, error);
        return {
            id,
            url,
            content: '',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
async function main() {
    const startId = 1;
    const endId = 81;
    const poems = [];
    const delay = 1000; // 1 second delay between requests to be respectful
    console.log(`Starting to scrape poems from ${startId} to ${endId}...`);
    for (let id = startId; id <= endId; id++) {
        const poem = await scrapePoem(id);
        poems.push(poem);
        // Add delay between requests
        if (id < endId) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    // Save to JSON file
    const outputPath = path.join(process.cwd(), 'poems.json');
    const jsonContent = JSON.stringify({
        metadata: {
            source: 'https://www.thewayofcode.com/',
            scrapedAt: new Date().toISOString(),
            totalPoems: poems.length,
            successful: poems.filter(p => !p.error).length,
            failed: poems.filter(p => p.error).length,
        },
        poems,
    }, null, 2);
    fs.writeFileSync(outputPath, jsonContent, 'utf8');
    console.log(`\nScraping completed!`);
    console.log(`Total poems: ${poems.length}`);
    console.log(`Successful: ${poems.filter(p => !p.error).length}`);
    console.log(`Failed: ${poems.filter(p => p.error).length}`);
    console.log(`Results saved to: ${outputPath}`);
}
void main().catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
});
