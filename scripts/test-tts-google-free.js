#!/usr/bin/env node

import https from 'https';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

const text = process.argv.slice(2).join(' ') || 'Hello, this is Google Translate TTS test in English.';

// Función para dividir texto largo (Google Translate tiene límites)
function splitText(text, maxLength = 200) {
  const words = text.split(' ');
  const chunks = [];
  let currentChunk = '';

  for (const word of words) {
    if ((currentChunk + ' ' + word).length <= maxLength) {
      currentChunk += (currentChunk ? ' ' : '') + word;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = word;
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

async function speakChunk(chunk) {
  return new Promise((resolve, reject) => {
    const encodedText = encodeURIComponent(chunk);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodedText}`;

    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    }).on('error', reject);
  });
}

async function speak() {
  try {
    const chunks = splitText(text);
    const audioBuffers = [];

    for (const chunk of chunks) {
      console.log(`Synthesizing chunk: "${chunk}"`);
      const buffer = await speakChunk(chunk);
      audioBuffers.push(buffer);

      // Pequeña pausa entre chunks para no sobrecargar
      if (chunks.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Combinar buffers (simple concatenación, no perfecto para WAV pero funciona)
    const combinedBuffer = Buffer.concat(audioBuffers);

    // Guardar a archivo temporal
    const tempFile = path.join(os.tmpdir(), 'google_tts_free_test.mp3');
    fs.writeFileSync(tempFile, combinedBuffer);
    console.log(`Audio saved to: ${tempFile}`);

    // Reproducir
    execSync(`start "" "${tempFile}"`, { stdio: 'inherit' });
    console.log('Playback started...');
  } catch (error) {
    console.error('TTS failed:', error.message);
    process.exit(1);
  }
}

speak();
