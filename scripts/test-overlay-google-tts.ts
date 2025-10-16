import https from 'https';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { exec } from 'child_process';

function sanitizeTextForGoogleTts(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

function splitText(text: string, maxLength = 180): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const word of words) {
    if (word.length === 0) {
      continue;
    }
    if ((currentChunk + ' ' + word).trim().length <= maxLength) {
      currentChunk += (currentChunk ? ' ' : '') + word;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = word;
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

function speakChunk(chunk: string, lang: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const encodedText = encodeURIComponent(chunk);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodedText}`;

    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    }, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const chunks: Buffer[] = [];
      response.on('data', (chunkData) => chunks.push(chunkData));
      response.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    }).on('error', reject);
  });
}

async function main(): Promise<void> {
  const inputText = (process.argv.slice(2).join(' ') || 'Testing the Google TTS chunk synthesis with The Way of Code, chapter 19.').trim();
  const langCode = 'en';
  const sanitized = sanitizeTextForGoogleTts(inputText);

  if (!sanitized) {
    console.error('Texto a sintetizar está vacío después de sanitizar.');
    process.exit(1);
  }

  console.log(`Original length: ${inputText.length}, sanitized length: ${sanitized.length}`);
  const chunks = splitText(sanitized);
  console.log(`Chunks (${chunks.length}):`);
  for (const chunk of chunks) {
    console.log(`- "${chunk}" (${chunk.length} chars)`);
  }

  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    console.log(`Solicitando chunk: "${chunk.substring(0, 50)}..."`);
    try {
      const buffer = await speakChunk(chunk, langCode);
      buffers.push(buffer);
      // Evitar throttling
      await new Promise((resolve) => setTimeout(resolve, 250));
    } catch (error) {
      console.error(`Chunk failed: ${(error as Error).message}`);
    }
  }

  if (buffers.length === 0) {
    console.error('No se pudo sintetizar ningún chunk.');
    process.exit(1);
  }

  const tempFile = path.join(os.tmpdir(), `google_tts_test_${Date.now()}.mp3`);
  fs.writeFileSync(tempFile, Buffer.concat(buffers));
  console.log(`Audio guardado en: ${tempFile}`);

  exec(`start "" "${tempFile}"`, (error) => {
    if (error) {
      console.error('No se pudo reproducir el audio con start.', error);
    } else {
      console.log('Reproducción iniciada.');
    }
  });
}

void main();



