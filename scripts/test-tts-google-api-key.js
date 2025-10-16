#!/usr/bin/env node

import https from 'https';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { config } from 'dotenv';

// Cargar variables de entorno desde .env
config();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
  console.error('❌ Error: GOOGLE_API_KEY no encontrada en archivo .env');
  console.error('Por favor crea un archivo .env con:');
  console.error('GOOGLE_API_KEY=tu_api_key_aqui');
  process.exit(1);
}

const text = process.argv.slice(2).join(' ') || 'Hello, this is a Google Cloud Text-to-Speech test using API key in English.';

async function synthesizeSpeech(text, voiceName = 'en-US-Neural2-C', languageCode = 'en-US') {
  return new Promise((resolve, reject) => {
    const requestData = {
      input: { text: text },
      voice: {
        languageCode: languageCode,
        name: voiceName,
        ssmlGender: 'FEMALE',
      },
      audioConfig: {
        audioEncoding: 'LINEAR16', // WAV format
        speakingRate: 1.0,
        pitch: 0.0,
      },
    };

    const postData = JSON.stringify(requestData);

    const options = {
      hostname: 'texttospeech.googleapis.com',
      path: `/v1/text:synthesize?key=${GOOGLE_API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            // The audio content is base64 encoded
            const audioContent = Buffer.from(response.audioContent, 'base64');
            resolve(audioContent);
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        } else {
          reject(new Error(`API request failed with status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function speak() {
  try {
    console.log('🎵 Synthesizing speech with Google Cloud TTS API...');
    console.log(`Text: "${text}"`);
    console.log(`Voice: en-US-Neural2-C (Female, Neural)`);

    const audioBuffer = await synthesizeSpeech(text, 'en-US-Neural2-C', 'en-US');

    // Guardar a archivo temporal
    const tempFile = path.join(require('os').tmpdir(), 'google_tts_api_test.wav');
    fs.writeFileSync(tempFile, audioBuffer);
    console.log(`✅ Audio saved to: ${tempFile}`);

    // Reproducir con Windows Media Player
    execSync(`start "" "${tempFile}"`, { stdio: 'inherit' });
    console.log('🎧 Playback started...');

  } catch (error) {
    console.error('❌ TTS failed:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('1. Verifica que tu GOOGLE_API_KEY sea válida');
    console.error('2. Asegúrate de que Text-to-Speech API esté habilitada en Google Cloud Console');
    console.error('3. Verifica que tengas cuota disponible');
    process.exit(1);
  }
}

speak();
