#!/usr/bin/env node

import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

// Simular la lógica de la aplicación
const gcpTtsClient = new TextToSpeechClient({
  keyFilename: path.join(process.cwd(), 'keys', 'the-way-of-code-a39c1f8438eb.json')
});

// Available Chirp3-HD voices for English (mismo que en la app)
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

// Function to split text (igual que en la app)
function splitText(text, maxLength = 200) {
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

// Simular la reproducción de un poema como lo haría la app
async function simulateAppTTS() {
  console.log('🎯 Testing App-like TTS with random Chirp3-HD voice...');

  // Texto de ejemplo (primera línea del poema)
  const poemText = "The code that can be named is not the eternal code. The function that can be defined is not the limitless function.";

  console.log(`📖 Poem text: "${poemText}"`);

  // Get random Chirp3-HD voice (como en la app)
  const selectedVoice = getRandomChirp3Voice();
  if (!selectedVoice) {
    console.error('❌ No voice available');
    return;
  }

  const starName = selectedVoice.name.replace('en-US-Chirp3-HD-', '');
  console.log(`🎵 Selected random voice: ${starName} (${selectedVoice.gender})`);

  // Split text into chunks (como en la app)
  const chunks = splitText(poemText, 200);
  console.log(`📦 Split into ${chunks.length} chunks`);

  const audioBuffers = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk) continue;

    console.log(`⏳ Processing chunk ${i + 1}/${chunks.length}...`);

    try {
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
    } catch (error) {
      console.error(`❌ Error processing chunk: ${error.message || error}`);
      return;
    }

    // Pausa entre chunks (como en la app)
    if (chunks.length > 1 && i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  if (audioBuffers.length === 0) {
    console.error('❌ No audio generated');
    return;
  }

  // Combinar buffers (como en la app)
  const combinedBuffer = Buffer.concat(audioBuffers);

  // Guardar archivo temporal
  const tempFile = path.join(os.tmpdir(), `app_tts_test_${starName}.wav`);
  fs.writeFileSync(tempFile, combinedBuffer);

  console.log(`✅ Audio saved to: ${tempFile}`);

  // Reproducir (como en la app)
  execSync(`start "" "${tempFile}"`, { stdio: 'inherit' });
  console.log('🎧 Playback started...');

  console.log(`\n🎉 App-like TTS test completed!`);
  console.log(`   Random voice: ${starName} (${selectedVoice.gender})`);
  console.log(`   Chunks processed: ${audioBuffers.length}`);
  console.log(`   This simulates exactly how the app will work.`);
}

simulateAppTTS();
