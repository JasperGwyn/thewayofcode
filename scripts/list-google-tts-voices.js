#!/usr/bin/env node

import https from 'https';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

// Lista de idiomas comunes disponibles en Google Translate TTS
const languages = [
  { code: 'en', name: 'English', testText: 'Hello, this is English voice test.' },
  { code: 'es', name: 'Spanish', testText: 'Hola, esta es una prueba de voz en español.' },
  { code: 'fr', name: 'French', testText: 'Bonjour, ceci est un test de voix française.' },
  { code: 'de', name: 'German', testText: 'Hallo, dies ist ein deutscher Sprachtest.' },
  { code: 'it', name: 'Italian', testText: 'Ciao, questo è un test vocale italiano.' },
  { code: 'pt', name: 'Portuguese', testText: 'Olá, este é um teste de voz em português.' },
  { code: 'ru', name: 'Russian', testText: 'Привет, это тест русского голоса.' },
  { code: 'ja', name: 'Japanese', testText: 'こんにちは、これは日本語の音声テストです。' },
  { code: 'ko', name: 'Korean', testText: '안녕하세요, 이것은 한국어 음성 테스트입니다.' },
  { code: 'zh', name: 'Chinese (Mandarin)', testText: '你好，这是一个中文语音测试。' },
  { code: 'ar', name: 'Arabic', testText: 'مرحبا، هذا اختبار صوت عربي.' },
  { code: 'hi', name: 'Hindi', testText: 'नमस्ते, यह हिंदी वॉयस टेस्ट है।' },
  { code: 'nl', name: 'Dutch', testText: 'Hallo, dit is een Nederlandse stemtest.' },
  { code: 'sv', name: 'Swedish', testText: 'Hej, detta är ett svenskt rösttest.' },
  { code: 'da', name: 'Danish', testText: 'Hej, dette er en dansk stemmetest.' },
  { code: 'no', name: 'Norwegian', testText: 'Hei, dette er en norsk stemmetest.' },
  { code: 'fi', name: 'Finnish', testText: 'Hei, tämä on suomenkielinen äänentesti.' },
  { code: 'pl', name: 'Polish', testText: 'Cześć, to jest test głosu polskiego.' },
  { code: 'tr', name: 'Turkish', testText: 'Merhaba, bu bir Türkçe ses testidir.' },
  { code: 'th', name: 'Thai', testText: 'สวัสดี นี่คือการทดสอบเสียงภาษาไทย' },
];

async function testLanguage(lang) {
  return new Promise((resolve, reject) => {
    const encodedText = encodeURIComponent(lang.testText);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang.code}&client=tw-ob&q=${encodedText}`;

    console.log(`Testing ${lang.name} (${lang.code})...`);

    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 5000
    }, (response) => {
      if (response.statusCode === 200) {
        console.log(`✅ ${lang.name} (${lang.code}) - Available`);
        resolve(true);
      } else {
        console.log(`❌ ${lang.name} (${lang.code}) - Not available (Status: ${response.statusCode})`);
        resolve(false);
      }
    }).on('error', (err) => {
      console.log(`❌ ${lang.name} (${lang.code}) - Error: ${err.message}`);
      resolve(false);
    }).on('timeout', () => {
      console.log(`⏰ ${lang.name} (${lang.code}) - Timeout`);
      resolve(false);
    });
  });
}

async function testAllLanguages() {
  console.log('🔍 Testing Google Translate TTS voices availability...\n');

  const results = [];
  for (const lang of languages) {
    const available = await testLanguage(lang);
    results.push({ ...lang, available });

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n📊 Summary:');
  console.log('===========');

  const available = results.filter(r => r.available);
  const unavailable = results.filter(r => !r.available);

  console.log(`✅ Available voices: ${available.length}`);
  available.forEach(lang => {
    console.log(`   - ${lang.name} (${lang.code})`);
  });

  if (unavailable.length > 0) {
    console.log(`\n❌ Unavailable voices: ${unavailable.length}`);
    unavailable.forEach(lang => {
      console.log(`   - ${lang.name} (${lang.code})`);
    });
  }

  console.log('\n💡 Note: Google Translate TTS provides one voice per language,');
  console.log('   typically a female voice with neutral accent.');
  console.log('   Quality and availability may vary over time.');
}

async function testSpecificLanguage() {
  const langCode = process.argv[2];
  if (!langCode) {
    console.error('Usage: node list-google-tts-voices.js <lang_code> [text]');
    console.error('Example: node list-google-tts-voices.js es "Hola mundo"');
    process.exit(1);
  }

  const testText = process.argv[3] || `Test text for language ${langCode}`;
  const lang = languages.find(l => l.code === langCode) || { code: langCode, name: langCode.toUpperCase(), testText };

  try {
    const encodedText = encodeURIComponent(testText);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang.code}&client=tw-ob&q=${encodedText}`;

    console.log(`Testing ${lang.name} (${lang.code}) with text: "${testText}"`);

    const response = await new Promise((resolve, reject) => {
      https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    });

    // Save to temp file and play
    const tempFile = path.join(os.tmpdir(), `tts_test_${lang.code}.mp3`);
    fs.writeFileSync(tempFile, response);
    console.log(`Audio saved to: ${tempFile}`);

    execSync(`start "" "${tempFile}"`, { stdio: 'inherit' });
    console.log('Playback started...');

  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

if (process.argv[2]) {
  testSpecificLanguage();
} else {
  testAllLanguages();
}
