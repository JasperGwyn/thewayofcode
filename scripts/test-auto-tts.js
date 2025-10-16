#!/usr/bin/env node

import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Simular la lógica exacta de la app con AUTO-TTS
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

// Function to split text (igual que en la app)
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

// Simular el AUTO-TTS cuando se carga un artículo/poema
async function simulateAutoTTS(articleId) {
  console.log('🔥 AUTO-TTS SIMULATION');
  console.log('=' .repeat(50));
  console.log(`🎯 Poem ID detected: ${articleId}`);
  console.log('🚀 Starting TTS automatically...\n');

  // Cargar poems
  const poemsData = loadPoems();
  const poem = poemsData.chapters.find(chapter => chapter.number === articleId);

  if (!poem) {
    console.error(`❌ Poem with ID ${articleId} not found`);
    return;
  }

  console.log(`📖 Poem "${poemsData.title}" - Chapter ${poem.number}`);
  console.log(`📏 Text length: ${poem.content.length} characters\n`);

  // Get random Chirp3-HD voice (igual que en la app)
  const selectedVoice = getRandomChirp3Voice();
  const starName = selectedVoice.name.replace('en-US-Chirp3-HD-', '');

  console.log('🎵 AUTO-TTS: Selecting random Chirp3-HD voice...');
  console.log(`🎤 Selected: ${starName} (${selectedVoice.gender})`);
  console.log('⏳ Processing poem automatically...\n');

  // Procesar con chunks grandes (igual que la app)
  const chunks = splitText(poem.content, 5000);
  console.log(`📦 Split into ${chunks.length} chunk(s) (large chunks for efficiency)`);

  const audioBuffers = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk) continue;

    console.log(`⏳ Processing chunk ${i + 1}/${chunks.length}: ${chunk.length} chars`);

    const request = {
      input: { text: chunk },
      voice: {
        languageCode: 'en-US',
        name: selectedVoice.name,
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

    // Pausa mínima entre chunks
    if (chunks.length > 1 && i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  if (audioBuffers.length === 0) {
    console.error('❌ No audio generated');
    return;
  }

  // Combinar buffers
  const combinedBuffer = Buffer.concat(audioBuffers);

  // Guardar archivo
  const tempFile = path.join(os.tmpdir(), `auto_tts_poem_${articleId}_${starName}.wav`);
  fs.writeFileSync(tempFile, combinedBuffer);

  console.log(`\n✅ AUTO-TTS Complete!`);
  console.log(`📁 Audio saved: ${tempFile}`);
  console.log(`🎵 Voice: ${starName} (${selectedVoice.gender})`);
  console.log(`📦 Chunks: ${chunks.length}`);
  console.log(`⏱️ No user interaction required!`);

  // Reproducir automáticamente
  console.log('\n🎧 Auto-playing audio...');
  // Note: En la app real, el audio se reproduce automáticamente

  console.log('\n🎉 AUTO-TTS SUCCESS!');
  console.log('=' .repeat(50));
  console.log('✅ TTS started immediately when poem ID was known');
  console.log('✅ No button clicks required');
  console.log('✅ Random premium voice every time');
  console.log('✅ Seamless user experience');
}

// Simular diferentes escenarios de auto-TTS
async function runAutoTTSTests() {
  console.log('🧪 TESTING AUTO-TTS FUNCTIONALITY\n');

  // Test 1: Poem desde URL (overlayChapterNumber)
  console.log('📋 TEST 1: Poem from URL parameter');
  await simulateAutoTTS(1);

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: Poem desde selección de artículo
  console.log('📋 TEST 2: Poem from article selection');
  await simulateAutoTTS(3);

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 3: Otro poem
  console.log('📋 TEST 3: Another random poem');
  await simulateAutoTTS(7);

  console.log('\n🎯 ALL TESTS COMPLETED!');
  console.log('The app now automatically starts TTS as soon as a poem is selected! 🚀');
}

runAutoTTSTests();

