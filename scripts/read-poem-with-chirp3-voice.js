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

// Voces Chirp3-HD disponibles para inglés (lista corregida)
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

// Función para dividir texto largo en chunks (Google TTS tiene límites)
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

async function speakWithChirp3Voice(text, voice) {
  try {
    const voiceName = voice.name;
    const starName = voiceName.replace('en-US-Chirp3-HD-', '');

    console.log(`🎵 Synthesizing with Chirp3-HD voice: ${starName} (${voice.gender})`);
    console.log(`📖 Text length: ${text.length} characters`);

    const chunks = splitText(text);
    console.log(`📦 Split into ${chunks.length} chunks for synthesis`);

    const audioBuffers = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`⏳ Processing chunk ${i + 1}/${chunks.length}: "${chunk.substring(0, 50)}${chunk.length > 50 ? '...' : ''}"`);

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

      // Pausa entre chunks para no sobrecargar
      if (chunks.length > 1 && i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Combinar buffers de audio
    const combinedBuffer = Buffer.concat(audioBuffers);

    // Guardar a archivo temporal
    const tempFile = path.join(os.tmpdir(), `poem_chirp3_${starName}.wav`);
    fs.writeFileSync(tempFile, combinedBuffer);

    console.log(`✅ Poem audio saved to: ${tempFile}`);

    // Reproducir
    execSync(`start "" "${tempFile}"`, { stdio: 'inherit' });
    console.log('🎧 Playback started...');

    return true;
  } catch (error) {
    const starName = voice.name.replace('en-US-Chirp3-HD-', '');
    console.error(`❌ Error synthesizing with voice ${starName}:`, error.message);
    return false;
  }
}

async function main() {
  // Cargar poems
  const poemsData = loadPoems();

  // Obtener el primer poema (capítulo 1)
  const firstPoem = poemsData.chapters.find(chapter => chapter.number === 1);

  if (!firstPoem) {
    console.error('❌ Could not find chapter 1 poem');
    process.exit(1);
  }

  console.log('📚 THE WAY OF CODE - Chapter 1');
  console.log('=' .repeat(40));
  console.log(firstPoem.content);
  console.log('=' .repeat(40));
  console.log('');

  // Mostrar opciones de voz
  console.log('🎤 Available Chirp3-HD Voices:');
  console.log('=' .repeat(50));
  chirp3Voices.forEach((voice, index) => {
    const starName = voice.name.replace('en-US-Chirp3-HD-', '');
    const gender = voice.gender === 'Female' ? '♀️' : '♂️';
    console.log(`${(index + 1).toString().padStart(2)}. ${starName} ${gender}`);
  });
  console.log('');

  // Leer entrada del usuario
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise(resolve => rl.question(query, resolve));

  try {
    const answer = await question('🎯 Choose a voice number (1-30) or press Enter for Achernar: ');

    let selectedVoiceIndex;
    if (answer.trim() === '') {
      selectedVoiceIndex = 0; // Default to Achernar
    } else {
      selectedVoiceIndex = parseInt(answer) - 1;
    }

    if (isNaN(selectedVoiceIndex) || selectedVoiceIndex < 0 || selectedVoiceIndex >= chirp3Voices.length) {
      console.log('❌ Invalid voice number. Using default voice Achernar.');
      selectedVoiceIndex = 0;
    }

    const selectedVoice = chirp3Voices[selectedVoiceIndex];
    const starName = selectedVoice.name.replace('en-US-Chirp3-HD-', '');

    console.log(`\n🎵 Selected voice: ${starName} (${selectedVoice.gender})`);
    console.log('⏳ Synthesizing poem with ultra-premium Chirp3-HD voice...\n');

    const success = await speakWithChirp3Voice(firstPoem.content, selectedVoice);

    if (success) {
      console.log('\n🎉 Poem reading completed!');
      console.log(`   Voice: ${starName} (${selectedVoice.gender})`);
      console.log('   Quality: Ultra Premium Chirp3-HD');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
  }
}

main();
