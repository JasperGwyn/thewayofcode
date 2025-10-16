#!/usr/bin/env node

import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

// Usar las credenciales del archivo JSON proporcionado
const client = new TextToSpeechClient({
  keyFilename: path.join(process.cwd(), 'keys', 'the-way-of-code-a39c1f8438eb.json')
});

// Voces Chirp3-HD disponibles para inglés
const chirp3Voices = [
  'en-US-Chirp3-HD-Achernar',
  'en-US-Chirp3-HD-Achird',
  'en-US-Chirp3-HD-Algenib',
  'en-US-Chirp3-HD-Alnitak',
  'en-US-Chirp3-HD-Alphard',
  'en-US-Chirp3-HD-Altair',
  'en-US-Chirp3-HD-Ankaa',
  'en-US-Chirp3-HD-Antares',
  'en-US-Chirp3-HD-Arcturus',
  'en-US-Chirp3-HD-Betelgeuse',
  'en-US-Chirp3-HD-Canopus',
  'en-US-Chirp3-HD-Capella',
  'en-US-Chirp3-HD-Deneb',
  'en-US-Chirp3-HD-Electra',
  'en-US-Chirp3-HD-Elnath',
  'en-US-Chirp3-HD-Fomalhaut',
  'en-US-Chirp3-HD-Gacrux',
  'en-US-Chirp3-HD-Genubi',
  'en-US-Chirp3-HD-Hadar',
  'en-US-Chirp3-HD-Menkent',
  'en-US-Chirp3-HD-Mirfak',
  'en-US-Chirp3-HD-Pollux',
  'en-US-Chirp3-HD-Procyon',
  'en-US-Chirp3-HD-Regulus',
  'en-US-Chirp3-HD-Rigel',
  'en-US-Chirp3-HD-Sirius',
  'en-US-Chirp3-HD-Vega',
  'en-US-Chirp3-HD-Zubeneschamali'
];

const text = process.argv.slice(2).join(' ') || 'This is the ultra-premium Chirp3-HD voice from Google Cloud Text-to-Speech. Experience the most natural and human-like speech synthesis available.';

async function testVoice(voiceName) {
  try {
    console.log(`🎵 Testing Chirp3-HD voice: ${voiceName}`);

    const request = {
      input: { text: text },
      voice: {
        languageCode: 'en-US',
        name: voiceName,
      },
      audioConfig: {
        audioEncoding: 'LINEAR16', // WAV format
        speakingRate: 1.0,
        pitch: 0.0,
      },
    };

    const [response] = await client.synthesizeSpeech(request);

    // Guardar a archivo temporal único para cada voz
    const tempFile = path.join(os.tmpdir(), `chirp3_hd_${voiceName.replace(/[^a-zA-Z0-9]/g, '_')}.wav`);
    fs.writeFileSync(tempFile, response.audioContent);

    console.log(`✅ Audio saved to: ${tempFile}`);

    // Reproducir
    execSync(`start "" "${tempFile}"`, { stdio: 'inherit' });

    return true;
  } catch (error) {
    console.error(`❌ Error with voice ${voiceName}:`, error.message);
    return false;
  }
}

async function testAllChirp3Voices() {
  console.log('🎯 Testing all Chirp3-HD voices for English...\n');
  console.log(`Text: "${text}"\n`);

  const results = [];
  for (let i = 0; i < chirp3Voices.length; i++) {
    const voice = chirp3Voices[i];
    console.log(`\n[${i + 1}/${chirp3Voices.length}] Testing ${voice}...`);

    const success = await testVoice(voice);
    results.push({ voice, success });

    // Pausa entre voces para no sobrecargar
    if (i < chirp3Voices.length - 1) {
      console.log('⏳ Waiting 2 seconds before next voice...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n📊 Results Summary:');
  console.log('==================');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Working voices: ${successful.length}`);
  console.log(`❌ Failed voices: ${failed.length}`);

  if (successful.length > 0) {
    console.log('\nWorking Chirp3-HD voices:');
    successful.forEach(({ voice }) => console.log(`  - ${voice}`));
  }
}

async function testSpecificVoice() {
  const voiceIndex = parseInt(process.argv[2]) - 1; // User provides 1-based index

  if (isNaN(voiceIndex) || voiceIndex < 0 || voiceIndex >= chirp3Voices.length) {
    console.log('❌ Please provide a valid voice number (1-28)');
    console.log('Available Chirp3-HD voices:');
    chirp3Voices.forEach((voice, index) => {
      console.log(`  ${index + 1}. ${voice}`);
    });
    return;
  }

  const selectedVoice = chirp3Voices[voiceIndex];
  console.log(`🎯 Testing specific Chirp3-HD voice: ${selectedVoice}`);
  await testVoice(selectedVoice);
}

async function main() {
  const arg = process.argv[2];

  if (arg === 'all') {
    await testAllChirp3Voices();
  } else if (arg && /^\d+$/.test(arg)) {
    await testSpecificVoice();
  } else {
    // Test default voice
    await testVoice('en-US-Chirp3-HD-Achernar');
  }
}

main();
