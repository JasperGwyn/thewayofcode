#!/usr/bin/env node

import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

const text = process.argv.slice(2).join(' ') || 'Hello, this is the ultra-premium Chirp3-HD voice from Google Cloud Text-to-Speech. This is the highest quality voice available, with incredibly natural and human-like speech synthesis.';

// Usar las credenciales del archivo JSON proporcionado
const client = new TextToSpeechClient({
  keyFilename: path.join(process.cwd(), 'keys', 'the-way-of-code-a39c1f8438eb.json')
});

async function speak() {
  try {
    console.log('🎵 Synthesizing speech with Google Cloud TTS (Service Account)...');
    console.log(`Text: "${text}"`);
    console.log(`Voice: en-US-Chirp3-HD-Achernar (Female, Ultra Premium, Chirp3-HD)`);

    const request = {
      input: { text: text },
      voice: {
        languageCode: 'en-US',
        name: 'en-US-Chirp3-HD-Achernar', // Voz Chirp3-HD ultra premium
        ssmlGender: 'FEMALE',
      },
      audioConfig: {
        audioEncoding: 'LINEAR16', // WAV format
        speakingRate: 1.0,
        pitch: 0.0,
      },
    };

    console.log('⏳ Sending request to Google Cloud TTS...');
    const [response] = await client.synthesizeSpeech(request);

    // Guardar a archivo temporal
    const tempFile = path.join(os.tmpdir(), 'google_tts_service_account_test.wav');
    fs.writeFileSync(tempFile, response.audioContent);
    console.log(`✅ Audio saved to: ${tempFile}`);

    // Reproducir con Windows Media Player
    execSync(`start "" "${tempFile}"`, { stdio: 'inherit' });
    console.log('🎧 Playback started...');

    console.log('\n🎉 Success! You are now using Google Cloud TTS with Chirp3-HD ultra premium voices.');
    console.log('Available Chirp3-HD voices include:');
    console.log('  - en-US-Chirp3-HD-Achernar (Female, ultra natural)');
    console.log('  - en-US-Chirp3-HD-Achird (Female, different style)');
    console.log('  - en-US-Chirp3-HD-Algenib (Female, another variant)');
    console.log('  - And many more Chirp3-HD voices across different languages...');

  } catch (error) {
    console.error('❌ TTS failed:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('1. Verifica que el archivo de credenciales existe en keys/the-way-of-code-a39c1f8438eb.json');
    console.error('2. Asegúrate de que Text-to-Speech API esté habilitada en Google Cloud Console');
    console.error('3. Verifica que tengas cuota disponible');
    console.error('4. Confirma que el service account tenga permisos para Text-to-Speech API');
    process.exit(1);
  }
}

speak();
