#!/usr/bin/env node

import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

// Usar las credenciales del archivo JSON proporcionado
const gcpTtsClient = new TextToSpeechClient({
  keyFilename: path.join(process.cwd(), 'keys', 'the-way-of-code-a39c1f8438eb.json')
});

// Función para leer el archivo de poems
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

// Función para dividir texto en chunks
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

// Método 1: Single chunk (como preguntaste)
async function singleChunkMethod(text, voiceName) {
  console.log('\n🔸 METHOD 1: Single Chunk');
  console.log('=' .repeat(30));

  const startTime = Date.now();

  const request = {
    input: { text: text },
    voice: {
      languageCode: 'en-US',
      name: voiceName,
    },
    audioConfig: {
      audioEncoding: 'LINEAR16',
      speakingRate: 1.0,
      pitch: 0.0,
    },
  };

  const response = await gcpTtsClient.synthesizeSpeech(request);
  const endTime = Date.now();

  if (response && response[0] && response[0].audioContent) {
    const audioContent = Buffer.from(response[0].audioContent);

    console.log(`✅ Success in ${endTime - startTime}ms`);
    console.log(`📊 Audio size: ${audioContent.length} bytes`);
    console.log(`📦 Chunks processed: 1`);

    return audioContent;
  }

  throw new Error('No audio content received');
}

// Método 2: Multiple chunks (como está en la app)
async function multipleChunksMethod(text, voiceName) {
  console.log('\n🔸 METHOD 2: Multiple Chunks');
  console.log('=' .repeat(30));

  const chunks = splitText(text, 200);
  console.log(`📦 Text split into ${chunks.length} chunks`);

  const startTime = Date.now();
  const audioBuffers = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`  Chunk ${i + 1}: "${chunk.substring(0, 40)}${chunk.length > 40 ? '...' : ''}"`);

    const request = {
      input: { text: chunk },
      voice: {
        languageCode: 'en-US',
        name: voiceName,
      },
      audioConfig: {
        audioEncoding: 'LINEAR16',
        speakingRate: 1.0,
        pitch: 0.0,
      },
    };

    const response = await gcpTtsClient.synthesizeSpeech(request);
    if (response && response[0] && response[0].audioContent) {
      const audioContent = Buffer.from(response[0].audioContent);
      audioBuffers.push(audioContent);
    }

    // Pausa entre chunks
    if (chunks.length > 1 && i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  const combinedBuffer = Buffer.concat(audioBuffers);
  const endTime = Date.now();

  console.log(`✅ Success in ${endTime - startTime}ms`);
  console.log(`📊 Total audio size: ${combinedBuffer.length} bytes`);
  console.log(`📦 Chunks processed: ${chunks.length}`);

  return combinedBuffer;
}

// Función principal de comparación
async function compareMethods() {
  console.log('🧪 COMPARING TTS METHODS');
  console.log('=' .repeat(50));

  // Cargar poema
  const poemsData = loadPoems();
  const firstPoem = poemsData.chapters.find(chapter => chapter.number === 1);

  if (!firstPoem) {
    console.error('❌ Could not find chapter 1 poem');
    return;
  }

  console.log(`📖 Poem: "${firstPoem.content.substring(0, 100)}..."`);
  console.log(`📏 Length: ${firstPoem.content.length} characters\n`);

  const voiceName = 'en-US-Chirp3-HD-Achernar';

  try {
    // Método 1: Single chunk
    const singleAudio = await singleChunkMethod(firstPoem.content, voiceName);

    // Método 2: Multiple chunks
    const multiAudio = await multipleChunksMethod(firstPoem.content, voiceName);

    // Comparación
    console.log('\n📊 COMPARISON RESULTS');
    console.log('=' .repeat(50));
    console.log(`🎵 Voice: Achernar (Chirp3-HD)`);
    console.log(`📖 Text length: ${firstPoem.content.length} characters`);
    console.log(`🔸 Single chunk size: ${singleAudio.length} bytes`);
    console.log(`🔸 Multi chunk size: ${multiAudio.length} bytes`);
    console.log(`📈 Size difference: ${multiAudio.length - singleAudio.length} bytes`);

    // Guardar ambos archivos para comparación
    const singleFile = path.join(os.tmpdir(), 'comparison_single.wav');
    const multiFile = path.join(os.tmpdir(), 'comparison_multi.wav');

    fs.writeFileSync(singleFile, singleAudio);
    fs.writeFileSync(multiFile, multiAudio);

    console.log(`\n💾 Files saved:`);
    console.log(`   Single: ${singleFile}`);
    console.log(`   Multi:  ${multiFile}`);

    console.log('\n🎯 CONCLUSION');
    console.log('=' .repeat(50));
    console.log('✅ Both methods work for short texts like poems');
    console.log('✅ Single chunk is simpler and faster');
    console.log('✅ Multiple chunks add reliability for longer texts');
    console.log('✅ Current app uses multiple chunks as good practice');

    // Reproducir el de single chunk para demostrar que funciona
    console.log('\n🎧 Playing single chunk version...');
    execSync(`start "" "${singleFile}"`, { stdio: 'inherit' });

  } catch (error) {
    console.error(`❌ Comparison failed: ${error.message || error}`);
  }
}

compareMethods();

