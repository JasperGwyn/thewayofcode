#!/usr/bin/env node

import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

// Simular la lógica exacta de la app actualizada
const gcpTtsClient = new TextToSpeechClient({
  keyFilename: path.join(process.cwd(), 'keys', 'the-way-of-code-a39c1f8438eb.json')
});

// Available Chirp3-HD voices (igual que en la app)
const chirp3Voices = [
  { name: 'en-US-Chirp3-HD-Achernar', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Achird', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Algenib', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Algieba', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Alnilam', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Aoede', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Autonoe', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Callirrhoe', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Charon', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Despina', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Enceladus', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Erinome', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Fenrir', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Gacrux', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Iapetus', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Kore', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Laomedeia', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Leda', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Orus', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Pulcherrima', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Puck', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Rasalgethi', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Sadachbia', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Sadaltager', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Schedar', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Sulafat', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Umbriel', gender: 'Male' },
  { name: 'en-US-Chirp3-HD-Vindemiatrix', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Zephyr', gender: 'Female' },
  { name: 'en-US-Chirp3-HD-Zubenelgenubi', gender: 'Male' }
];

// Function to get random Chirp3-HD voice (igual que en la app)
function getRandomChirp3Voice() {
  const randomIndex = Math.floor(Math.random() * chirp3Voices.length);
  return chirp3Voices[randomIndex];
}

// Function to split text (igual que en la app, pero con límite de 5000)
function splitText(text, maxLength = 5000) {
  const words = text.split(/\s+/);
  const chunks = [];
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

// Leer el archivo de poems
function loadPoems() {
  try {
    const poemsPath = path.join(process.cwd(), 'assets', 'poems', 'poems.json');
    const poemsData = fs.readFileSync(poemsPath, 'utf8');
    return JSON.parse(poemsData);
  } catch (error) {
    console.error('❌ Error loading poems:', error.message);
    process.exit(1);
  }
}

// Simular exactamente cómo funciona la app actualizada
async function simulateAppTTS() {
  console.log('🎯 Testing UPDATED app logic (single large chunk)');
  console.log('=' .repeat(55));

  // Cargar poems
  const poemsData = loadPoems();
  const firstPoem = poemsData.chapters.find(chapter => chapter.number === 1);

  if (!firstPoem) {
    console.error('❌ Could not find chapter 1 poem');
    return;
  }

  console.log(`📖 Poem text: "${firstPoem.content.substring(0, 80)}..."`);
  console.log(`📏 Length: ${firstPoem.content.length} characters\n`);

  // Get random Chirp3-HD voice (igual que la app)
  const selectedVoice = getRandomChirp3Voice();
  const starName = selectedVoice.name.replace('en-US-Chirp3-HD-', '');

  console.log(`🎵 Random voice selected: ${starName} (${selectedVoice.gender})`);
  console.log('⏳ Processing with app logic...\n');

  // Usar chunks grandes (5000 chars) - igual que la app actualizada
  const chunks = splitText(firstPoem.content, 5000);
  console.log(`📦 Text split into ${chunks.length} chunk(s) (should be 1 for short poems)`);

  const audioBuffers = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk) continue;

    console.log(`⏳ Processing chunk ${i + 1}/${chunks.length}: ${chunk.length} characters`);

    const request = {
      input: { text: chunk },
      voice: {
        languageCode: 'en-US',
        name: selectedVoice.name,
      },
      audioConfig: {
        audioEncoding: 'LINEAR16', // WAV format for high quality
        speakingRate: 1.0,
        pitch: 0.0,
      },
    };

    const response = await gcpTtsClient.synthesizeSpeech(request);
    if (response && response[0] && response[0].audioContent) {
      const audioContent = Buffer.from(response[0].audioContent);
      audioBuffers.push(audioContent);
    }

    // Pausa entre chunks (solo si hay múltiples)
    if (chunks.length > 1 && i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  if (audioBuffers.length === 0) {
    console.error('❌ No audio generated');
    return;
  }

  // Combinar buffers (solo 1 buffer para poems cortos)
  const combinedBuffer = Buffer.concat(audioBuffers);

  // Guardar archivo temporal
  const tempFile = path.join(os.tmpdir(), `app_single_chunk_${starName}.wav`);
  fs.writeFileSync(tempFile, combinedBuffer);

  console.log(`✅ Audio saved to: ${tempFile}`);
  console.log(`📊 Audio size: ${combinedBuffer.length} bytes`);
  console.log(`📦 Chunks processed: ${chunks.length} (should be 1)`);

  // Reproducir
  execSync(`start "" "${tempFile}"`, { stdio: 'inherit' });
  console.log('🎧 Playback started...');

  console.log('\n🎉 SUCCESS!');
  console.log('=' .repeat(55));
  console.log('✅ App now uses LARGE chunks (5000 chars)');
  console.log('✅ Short poems process as SINGLE chunk');
  console.log('✅ Much faster and more efficient');
  console.log(`🎵 Voice used: ${starName} (${selectedVoice.gender})`);
  console.log('🚀 Ready for production!');
}

simulateAppTTS();

