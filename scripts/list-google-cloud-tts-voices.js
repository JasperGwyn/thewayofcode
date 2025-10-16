#!/usr/bin/env node

// Script to list available Google Cloud Text-to-Speech voices
// Note: This requires Google Cloud credentials to work fully

import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import fs from 'fs';

// Initialize the client (you'll need GOOGLE_APPLICATION_CREDENTIALS set)
const client = new TextToSpeechClient();

// Common languages and their voice options
const languageExamples = {
  'en-US': ['en-US-Neural2-C', 'en-US-Neural2-D', 'en-US-Neural2-F', 'en-US-Standard-C', 'en-US-Standard-D', 'en-US-Standard-F'],
  'en-GB': ['en-GB-Neural2-A', 'en-GB-Neural2-B', 'en-GB-Neural2-C', 'en-GB-Neural2-D', 'en-GB-Neural2-F'],
  'es-ES': ['es-ES-Neural2-A', 'es-ES-Neural2-B', 'es-ES-Neural2-C', 'es-ES-Neural2-D', 'es-ES-Neural2-E', 'es-ES-Neural2-F'],
  'es-US': ['es-US-Neural2-A', 'es-US-Neural2-B', 'es-US-Neural2-C'],
  'fr-FR': ['fr-FR-Neural2-A', 'fr-FR-Neural2-B', 'fr-FR-Neural2-C', 'fr-FR-Neural2-D', 'fr-FR-Neural2-E'],
  'de-DE': ['de-DE-Neural2-A', 'de-DE-Neural2-B', 'de-DE-Neural2-C', 'de-DE-Neural2-D', 'de-DE-Neural2-F'],
  'it-IT': ['it-IT-Neural2-A', 'it-IT-Neural2-C'],
  'pt-BR': ['pt-BR-Neural2-A', 'pt-BR-Neural2-B', 'pt-BR-Neural2-C'],
  'ja-JP': ['ja-JP-Neural2-B', 'ja-JP-Neural2-C', 'ja-JP-Neural2-D'],
  'ko-KR': ['ko-KR-Neural2-A', 'ko-KR-Neural2-B', 'ko-KR-Neural2-C'],
  'zh-CN': ['zh-CN-Neural2-A', 'zh-CN-Neural2-B', 'zh-CN-Neural2-C', 'zh-CN-Neural2-D'],
  'ar-XA': ['ar-XA-Standard-A', 'ar-XA-Standard-B', 'ar-XA-Standard-C', 'ar-XA-Standard-D'],
  'ru-RU': ['ru-RU-Standard-A', 'ru-RU-Standard-B', 'ru-RU-Standard-C', 'ru-RU-Standard-D'],
  'hi-IN': ['hi-IN-Neural2-A', 'hi-IN-Neural2-B', 'hi-IN-Neural2-C', 'hi-IN-Neural2-D'],
  'th-TH': ['th-TH-Neural2-C'],
  'sv-SE': ['sv-SE-Standard-A'],
  'da-DK': ['da-DK-Neural2-D'],
  'no-NO': ['no-NO-Standard-A', 'no-NO-Standard-B', 'no-NO-Standard-C', 'no-NO-Standard-D'],
  'nl-NL': ['nl-NL-Standard-A', 'nl-NL-Standard-B', 'nl-NL-Standard-C', 'nl-NL-Standard-D', 'nl-NL-Standard-E'],
  'pl-PL': ['pl-PL-Standard-A', 'pl-PL-Standard-B', 'pl-PL-Standard-C', 'pl-PL-Standard-D', 'pl-PL-Standard-E'],
  'tr-TR': ['tr-TR-Standard-A', 'tr-TR-Standard-B', 'tr-TR-Standard-C', 'tr-TR-Standard-D', 'tr-TR-Standard-E'],
  'fi-FI': ['fi-FI-Standard-A'],
};

const testTexts = {
  'en-US': 'Hello, this is a high-quality neural voice from Google Cloud Text-to-Speech.',
  'en-GB': 'Hello, this is a British English neural voice test.',
  'es-ES': 'Hola, esta es una voz neuronal de alta calidad en español de España.',
  'es-US': 'Hola, esta es una voz neuronal en español de Estados Unidos.',
  'fr-FR': 'Bonjour, ceci est une voix neurale de haute qualité en français.',
  'de-DE': 'Hallo, dies ist eine hochwertige neuronale Stimme auf Deutsch.',
  'it-IT': 'Ciao, questa è una voce neurale di alta qualità in italiano.',
  'pt-BR': 'Olá, esta é uma voz neural de alta qualidade em português brasileiro.',
  'ja-JP': 'こんにちは、これはGoogle Cloud Text-to-Speechの高品質なニューラルボイスです。',
  'ko-KR': '안녕하세요, 이것은 Google Cloud Text-to-Speech의 고품질 신경망 음성입니다.',
  'zh-CN': '你好，这是Google Cloud Text-to-Speech的高质量神经语音。',
  'ar-XA': 'مرحبا، هذا صوت عصبي عالي الجودة من Google Cloud Text-to-Speech.',
  'ru-RU': 'Привет, это высококачественный нейронный голос от Google Cloud Text-to-Speech.',
  'hi-IN': 'नमस्ते, यह Google Cloud Text-to-Speech का उच्च गुणवत्ता वाला तंत्रिका वॉयस है।',
  'th-TH': 'สวัสดี นี่คือเสียงประสาทคุณภาพสูงจาก Google Cloud Text-to-Speech',
  'sv-SE': 'Hej, detta är en högkvalitativ neural röst från Google Cloud Text-to-Speech.',
  'da-DK': 'Hej, dette er en højkvalitets neural stemme fra Google Cloud Text-to-Speech.',
  'no-NO': 'Hei, dette er en høykvalitets neural stemme fra Google Cloud Text-to-Speech.',
  'nl-NL': 'Hallo, dit is een hoogwaardige neurale stem van Google Cloud Text-to-Speech.',
  'pl-PL': 'Cześć, to jest wysokiej jakości głos neuronowy z Google Cloud Text-to-Speech.',
  'tr-TR': 'Merhaba, bu Google Cloud Text-to-Speech\'ten yüksek kaliteli bir nöral sestir.',
  'fi-FI': 'Hei, tämä on korkealaatuinen neuroään Google Cloud Text-to-Speech -palvelusta.',
};

async function listVoices() {
  try {
    console.log('🔍 Fetching available Google Cloud TTS voices...\n');

    const [result] = await client.listVoices({});
    const voices = result.voices;

    if (!voices || voices.length === 0) {
      console.log('❌ No voices found. Check your Google Cloud credentials.');
      return;
    }

    console.log(`📊 Found ${voices.length} voices across ${new Set(voices.map(v => v.languageCodes[0].split('-')[0])).size} languages\n`);

    // Group by language
    const byLanguage = {};
    voices.forEach(voice => {
      const lang = voice.languageCodes[0];
      if (!byLanguage[lang]) {
        byLanguage[lang] = [];
      }
      byLanguage[lang].push(voice);
    });

    // Display summary
    Object.keys(byLanguage).sort().forEach(lang => {
      const langVoices = byLanguage[lang];
      const neuralCount = langVoices.filter(v => v.name.includes('Neural2')).length;
      const standardCount = langVoices.filter(v => v.name.includes('Standard')).length;
      const waveNetCount = langVoices.filter(v => v.name.includes('Wavenet')).length;

      console.log(`🌍 ${lang} (${langVoices.length} voices)`);
      console.log(`   Neural2: ${neuralCount}, Standard: ${standardCount}, WaveNet: ${waveNetCount}`);

      // Show sample voices
      const samples = langVoices.slice(0, 3).map(v => v.name).join(', ');
      console.log(`   Sample: ${samples}${langVoices.length > 3 ? '...' : ''}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error listing voices:', error.message);
    console.log('\n💡 Note: This requires Google Cloud credentials.');
    console.log('   Set GOOGLE_APPLICATION_CREDENTIALS environment variable');
    console.log('   or create a key.json file and pass it to the client.');
    console.log('\n🆓 Alternative: Use the free Google Translate TTS (limited voices)');
    console.log('   Run: node scripts/list-google-tts-voices.js');
  }
}

async function testVoice(voiceName, text) {
  try {
    console.log(`🎵 Testing voice: ${voiceName}`);

    const request = {
      input: { text: text },
      voice: {
        languageCode: voiceName.split('-').slice(0, 2).join('-'),
        name: voiceName,
      },
      audioConfig: {
        audioEncoding: 'LINEAR16', // WAV
        speakingRate: 1.0,
        pitch: 0.0,
      },
    };

    const [response] = await client.synthesizeSpeech(request);

    // Save to temp file
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const tempFile = path.join(os.tmpdir(), `gcloud_tts_test_${voiceName.replace(/[^a-zA-Z0-9]/g, '_')}.wav`);
    fs.writeFileSync(tempFile, response.audioContent);

    console.log(`✅ Audio saved to: ${tempFile}`);

    // Play the audio
    const { execSync } = require('child_process');
    execSync(`start "" "${tempFile}"`, { stdio: 'inherit' });
    console.log('🎧 Playback started...');

  } catch (error) {
    console.error(`❌ Error testing voice ${voiceName}:`, error.message);
  }
}

async function showVoiceExamples() {
  console.log('🎯 Google Cloud TTS Voice Examples (High Quality):\n');

  Object.entries(languageExamples).forEach(([lang, voices]) => {
    const text = testTexts[lang] || `Sample text for ${lang}`;
    console.log(`🌍 ${lang}:`);
    voices.slice(0, 2).forEach(voice => {
      console.log(`   - ${voice} (${voice.includes('Neural2') ? 'Premium' : 'Standard'})`);
    });
    console.log(`   Text: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`);
    console.log('');
  });

  console.log('💡 To test a specific voice:');
  console.log('   node scripts/list-google-cloud-tts-voices.js test en-US-Neural2-C');
  console.log('\n💰 Note: Google Cloud TTS is a paid service with high-quality neural voices.');
  console.log('   Free tier: 1 million characters/month, then $16 per 1M characters.');
}

if (process.argv[2] === 'test' && process.argv[3]) {
  const voiceName = process.argv[3];
  const lang = voiceName.split('-').slice(0, 2).join('-');
  const text = testTexts[lang] || `Testing ${voiceName} voice with sample text.`;
  await testVoice(voiceName, text);
} else if (process.argv[2] === 'examples') {
  showVoiceExamples();
} else {
  // First show examples, then try to list actual voices
  showVoiceExamples();
  console.log('🔍 Attempting to fetch actual voice list from Google Cloud...\n');
  await listVoices();
}
