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

// Mapa de números a voces Chirp3-HD (estructura corregida)
const voiceMap = {
  1: { name: 'en-US-Chirp3-HD-Achernar', gender: 'Female' },
  2: { name: 'en-US-Chirp3-HD-Achird', gender: 'Male' },
  3: { name: 'en-US-Chirp3-HD-Algenib', gender: 'Male' },
  4: { name: 'en-US-Chirp3-HD-Algieba', gender: 'Male' },
  5: { name: 'en-US-Chirp3-HD-Alnilam', gender: 'Male' },
  6: { name: 'en-US-Chirp3-HD-Aoede', gender: 'Female' },
  7: { name: 'en-US-Chirp3-HD-Autonoe', gender: 'Female' },
  8: { name: 'en-US-Chirp3-HD-Callirrhoe', gender: 'Female' },
  9: { name: 'en-US-Chirp3-HD-Charon', gender: 'Male' },
  10: { name: 'en-US-Chirp3-HD-Despina', gender: 'Female' },
  11: { name: 'en-US-Chirp3-HD-Enceladus', gender: 'Male' },
  12: { name: 'en-US-Chirp3-HD-Erinome', gender: 'Female' },
  13: { name: 'en-US-Chirp3-HD-Fenrir', gender: 'Male' },
  14: { name: 'en-US-Chirp3-HD-Gacrux', gender: 'Female' },
  15: { name: 'en-US-Chirp3-HD-Iapetus', gender: 'Male' },
  16: { name: 'en-US-Chirp3-HD-Kore', gender: 'Female' },
  17: { name: 'en-US-Chirp3-HD-Laomedeia', gender: 'Female' },
  18: { name: 'en-US-Chirp3-HD-Leda', gender: 'Female' },
  19: { name: 'en-US-Chirp3-HD-Orus', gender: 'Male' },
  20: { name: 'en-US-Chirp3-HD-Pulcherrima', gender: 'Female' },
  21: { name: 'en-US-Chirp3-HD-Puck', gender: 'Male' },
  22: { name: 'en-US-Chirp3-HD-Rasalgethi', gender: 'Male' },
  23: { name: 'en-US-Chirp3-HD-Sadachbia', gender: 'Male' },
  24: { name: 'en-US-Chirp3-HD-Sadaltager', gender: 'Male' },
  25: { name: 'en-US-Chirp3-HD-Schedar', gender: 'Male' },
  26: { name: 'en-US-Chirp3-HD-Sulafat', gender: 'Female' },
  27: { name: 'en-US-Chirp3-HD-Umbriel', gender: 'Male' },
  28: { name: 'en-US-Chirp3-HD-Vindemiatrix', gender: 'Female' },
  29: { name: 'en-US-Chirp3-HD-Zephyr', gender: 'Female' },
  30: { name: 'en-US-Chirp3-HD-Zubenelgenubi', gender: 'Male' }
};

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

// Función para dividir texto largo en chunks
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

async function speakPoemWithVoice(voiceNumber) {
  const voice = voiceMap[voiceNumber];
  if (!voice) {
    console.error(`❌ Invalid voice number: ${voiceNumber}`);
    console.log('Available voices: 1-30');
    return;
  }

  // Cargar poems
  const poemsData = loadPoems();
  const firstPoem = poemsData.chapters.find(chapter => chapter.number === 1);

  if (!firstPoem) {
    console.error('❌ Could not find chapter 1 poem');
    return;
  }

  const voiceName = voice.name;
  const starName = voiceName.replace('en-US-Chirp3-HD-', '');

  try {
    console.log(`🎵 Reading "The Way of Code - Chapter 1" with voice: ${starName} (${voice.gender}) (Chirp3-HD)`);
    console.log(`📖 Text length: ${firstPoem.content.length} characters`);

    const chunks = splitText(firstPoem.content);
    console.log(`📦 Split into ${chunks.length} chunks`);

    const audioBuffers = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      const request = {
        input: { text: chunk },
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
      audioBuffers.push(response.audioContent);

      // Pausa entre chunks
      if (chunks.length > 1 && i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // Combinar buffers de audio
    const combinedBuffer = Buffer.concat(audioBuffers);

    // Guardar a archivo temporal
    const tempFile = path.join(os.tmpdir(), `poem_voice_${voiceNumber}_${starName}.wav`);
    fs.writeFileSync(tempFile, combinedBuffer);

    console.log(`✅ Audio saved to: ${tempFile}`);

    // Reproducir
    execSync(`start "" "${tempFile}"`, { stdio: 'inherit' });
    console.log('🎧 Playback started...');

    console.log(`\n🎉 Completed! Voice: ${starName} (${voice.gender}) - #${voiceNumber}`);

  } catch (error) {
    console.error(`❌ Error with voice ${starName}:`, error.message);
  }
}

function showUsage() {
  console.log('🎯 Quick Poem Voice Test - Chirp3-HD Voices');
  console.log('Usage: node scripts/quick-poem-voice-test.js <voice_number>');
  console.log('');
  console.log('Available Chirp3-HD voices:');
  Object.entries(voiceMap).forEach(([num, voice]) => {
    const starName = voice.name.replace('en-US-Chirp3-HD-', '');
    const gender = voice.gender === 'Female' ? '♀️' : '♂️';
    console.log(`${num.toString().padStart(2)}. ${starName} ${gender}`);
  });
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/quick-poem-voice-test.js 1    # Achernar (Female)');
  console.log('  node scripts/quick-poem-voice-test.js 9    # Charon (Male)');
  console.log('  node scripts/quick-poem-voice-test.js 16   # Kore (Female)');
}

async function main() {
  const voiceNumber = parseInt(process.argv[2]);

  if (!voiceNumber || isNaN(voiceNumber)) {
    showUsage();
    return;
  }

  if (voiceNumber < 1 || voiceNumber > 30) {
    console.error('❌ Voice number must be between 1 and 30');
    showUsage();
    return;
  }

  await speakPoemWithVoice(voiceNumber);
}

main();
