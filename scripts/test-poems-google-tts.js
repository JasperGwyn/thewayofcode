"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const https_1 = __importDefault(require("https"));
const os_1 = __importDefault(require("os"));
const child_process_1 = require("child_process");
const poemsJsonPath = path_1.default.join(process.cwd(), 'assets', 'poems', 'poems.json');
const poemsMarkdownPath = path_1.default.join(process.cwd(), 'assets', 'poems', 'poems.md');
function sanitizeTextForGoogleTts(text) {
    return text
        .replace(/\s+/g, ' ')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim();
}
function splitText(text, maxLength = 180) {
    const words = text.split(/\s+/);
    const chunks = [];
    let currentChunk = '';
    for (const word of words) {
        if (word.length === 0) {
            continue;
        }
        if ((currentChunk + ' ' + word).trim().length <= maxLength) {
            currentChunk += (currentChunk ? ' ' : '') + word;
        }
        else {
            if (currentChunk) {
                chunks.push(currentChunk);
            }
            currentChunk = word;
        }
    }
    if (currentChunk) {
        chunks.push(currentChunk);
    }
    return chunks;
}
function speakChunk(chunk, lang) {
    return new Promise((resolve, reject) => {
        const encodedText = encodeURIComponent(chunk);
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodedText}`;
        https_1.default.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        }, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
            }
            const buffers = [];
            response.on('data', (chunkData) => buffers.push(chunkData));
            response.on('end', () => {
                resolve(Buffer.concat(buffers));
            });
        }).on('error', reject);
    });
}
function readChapterFromJson(chapterNumber) {
    if (!fs_1.default.existsSync(poemsJsonPath)) {
        throw new Error(`No se encontró el archivo JSON en ${poemsJsonPath}`);
    }
    const raw = fs_1.default.readFileSync(poemsJsonPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const chapters = parsed.chapters ?? [];
    const chapter = chapters.find((item) => item.number === chapterNumber);
    if (!chapter) {
        throw new Error(`Capítulo ${chapterNumber} no encontrado en poems.json`);
    }
    return chapter.content;
}
function readChapterFromMarkdown(chapterNumber) {
    if (!fs_1.default.existsSync(poemsMarkdownPath)) {
        throw new Error(`No se encontró el archivo Markdown en ${poemsMarkdownPath}`);
    }
    const raw = fs_1.default.readFileSync(poemsMarkdownPath, 'utf-8');
    const chapterHeader = `**Chapter ${chapterNumber}**`;
    const startIndex = raw.indexOf(chapterHeader);
    if (startIndex === -1) {
        throw new Error(`Capítulo ${chapterNumber} no encontrado en poems.md`);
    }
    const rest = raw.slice(startIndex + chapterHeader.length);
    const nextChapterIndex = rest.indexOf('**Chapter');
    const contentSection = nextChapterIndex === -1 ? rest : rest.slice(0, nextChapterIndex);
    return contentSection;
}
async function main() {
    const [, , sourceArg = 'json', chapterArg = '19'] = process.argv;
    const chapterNumber = Number.parseInt(chapterArg, 10);
    if (Number.isNaN(chapterNumber) || chapterNumber <= 0) {
        throw new Error(`Número de capítulo inválido: ${chapterArg}`);
    }
    const source = sourceArg.toLowerCase();
    let rawText;
    if (source === 'json') {
        rawText = readChapterFromJson(chapterNumber);
    }
    else if (source === 'md' || source === 'markdown') {
        rawText = readChapterFromMarkdown(chapterNumber);
    }
    else {
        throw new Error(`Origen desconocido "${source}". Usa "json" o "md".`);
    }
    const sanitized = sanitizeTextForGoogleTts(rawText);
    if (!sanitized) {
        throw new Error('El texto sanitizado está vacío.');
    }
    console.log(`Origen: ${source} | Capítulo: ${chapterNumber}`);
    console.log(`Longitud original: ${rawText.length}, longitud sanitizada: ${sanitized.length}`);
    const chunks = splitText(sanitized);
    console.log(`Chunks (${chunks.length}):`);
    for (const chunk of chunks) {
        console.log(`- "${chunk}" (${chunk.length} chars)`);
    }
    const buffers = [];
    for (const chunk of chunks) {
        console.log(`Solicitando chunk: "${chunk.substring(0, 60)}${chunk.length > 60 ? '...' : ''}"`);
        try {
            const buffer = await speakChunk(chunk, 'en');
            buffers.push(buffer);
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
        catch (error) {
            console.error(`Chunk falló: ${error.message}`);
        }
    }
    if (buffers.length === 0) {
        throw new Error('No se pudo sintetizar ningún chunk.');
    }
    const tempFile = path_1.default.join(os_1.default.tmpdir(), `poem_tts_${Date.now()}.mp3`);
    fs_1.default.writeFileSync(tempFile, Buffer.concat(buffers));
    console.log(`Audio guardado en: ${tempFile}`);
    (0, child_process_1.exec)(`start "" "${tempFile}"`, (error) => {
        if (error) {
            console.error('No se pudo reproducir el audio con start.', error);
        }
        else {
            console.log('Reproducción iniciada.');
        }
    });
}
void main();
