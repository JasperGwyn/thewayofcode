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

// Probar TTS con un solo chunk (todo el texto de una vez)
async function testSingleChunk() {
  console.log('🧪 Testing TTS with SINGLE chunk (no splitting)...');

  // Cargar poems
  const poemsData = loadPoems();
  const firstPoem = poemsData.chapters.find(chapter => chapter.number === 1);

  if (!firstPoem) {
    console.error('❌ Could not find chapter 1 poem');
    return;
  }

  console.log(`📖 Poem text length: ${firstPoem.content.length} characters`);
  console.log(`📖 Full text:\n"${firstPoem.content}"\n`);

  // Seleccionar una voz aleatoria
  const voiceName = 'en-US-Chirp3-HD-Achernar'; // Usar una voz fija para comparación
  const starName = voiceName.replace('en-US-Chirp3-HD-', '');

  console.log(`🎵 Using voice: ${starName}`);
  console.log('⏳ Processing ENTIRE poem as single chunk...');

  try {
    const request = {
      input: { text: firstPoem.content },
      voice: {
        languageCode: 'en-US',
        name: voiceName,
      },
      audioConfig: {
        audioEncoding: 'LINEAR16', // WAV format for high quality
        speakingRate: 1.0,
        pitch: 0.0,
      },
    };

    const startTime = Date.now();
    const response = await gcpTtsClient.synthesizeSpeech(request);
    const endTime = Date.now();

    if (response && response[0] && response[0].audioContent) {
      const audioContent = Buffer.from(response[0].audioContent);

      // Guardar archivo
      const tempFile = path.join(os.tmpdir(), `single_chunk_test_${starName}.wav`);
      fs.writeFileSync(tempFile, audioContent);

      console.log(`✅ Single chunk audio saved to: ${tempFile}`);
      console.log(`⏱️ Processing time: ${endTime - startTime}ms`);
      console.log(`📊 Audio size: ${audioContent.length} bytes`);

      // Reproducir
      execSync(`start "" "${tempFile}"`, { stdio: 'inherit' });
      console.log('🎧 Playback started...');

      console.log('\n🎉 Single chunk test completed successfully!');
      console.log(`   Voice: ${starName}`);
      console.log(`   Method: Single chunk (no splitting)`);
      console.log(`   Text length: ${firstPoem.content.length} characters`);
    } else {
      console.error('❌ No audio content received');
    }

  } catch (error) {
    console.error(`❌ Error with single chunk: ${error.message || error}`);
    console.error('\n💡 This might happen if text is too long or contains unsupported characters');
  }
}

testSingleChunk();

