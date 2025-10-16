"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const https_1 = __importDefault(require("https"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const jsdom_1 = require("jsdom");
const readability_1 = require("@mozilla/readability");
function fetchHtml(url) {
    return new Promise((resolve, reject) => {
        https_1.default.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
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
async function main() {
    const url = process.argv[2] ?? 'https://www.thewayofcode.com/#19';
    console.log(`Fetching ${url}...`);
    const html = await fetchHtml(url);
    const dom = new jsdom_1.JSDOM(html, {
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
    const reader = new readability_1.Readability(dom.window.document);
    const parsed = reader.parse();
    const rawText = parsed?.textContent ?? articleNode.textContent ?? '';
    const sanitized = sanitizeText(rawText);
    const outPath = path_1.default.join(os_1.default.tmpdir(), `wayofcode_${Date.now()}.txt`);
    fs_1.default.writeFileSync(outPath, sanitized, 'utf8');
    console.log(`Extracted text (${sanitized.length} chars) saved to: ${outPath}`);
}
void main().catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
});
