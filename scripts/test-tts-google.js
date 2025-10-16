#!/usr/bin/env node

import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Configura credenciales (necesitas GOOGLE_APPLICATION_CREDENTIALS)
// Ejemplo: set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\key.json
// O usa keyFilename en el constructor

const client = new TextToSpeechClient({
  // keyFilename: 'path/to/key.json' // descomenta si tienes clave local
});

const text = process.argv.slice(2).join(' ') || 'Hello, this is a Google Cloud Text-to-Speech test in English.';

async function speak() {
  try {
    const request = {
      input: { text: text },
      voice: {
        languageCode: 'en-US',
        name: 'en-US-Neural2-C', // Voz natural en inglés
        ssmlGender: 'FEMALE',
      },
      audioConfig: {
        audioEncoding: 'LINEAR16', // WAV
        speakingRate: 1.0,
        pitch: 0.0,
      },
    };

    console.log('Synthesizing speech...');
    const [response] = await client.synthesizeSpeech(request);

    // Guardar a archivo temporal
    const tempFile = path.join(require('os').tmpdir(), 'google_tts_test.wav');
    fs.writeFileSync(tempFile, response.audioContent);
    console.log(`Audio saved to: ${tempFile}`);

    // Reproducir con Windows Media Player o similar
    execSync(`start "" "${tempFile}"`, { stdio: 'inherit' });
    console.log('Playback started...');
  } catch (error) {
    console.error('TTS failed:', error.message);
    process.exit(1);
  }
}

speak();
