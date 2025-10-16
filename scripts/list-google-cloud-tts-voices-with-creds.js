#!/usr/bin/env node

import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import path from 'path';

// Usar las credenciales del archivo JSON proporcionado
const client = new TextToSpeechClient({
  keyFilename: path.join(process.cwd(), 'keys', 'the-way-of-code-a39c1f8438eb.json')
});

async function listVoices() {
  try {
    console.log('🔍 Fetching available Google Cloud TTS voices using service account...\n');

    const [result] = await client.listVoices({});
    const voices = result.voices;

    if (!voices || voices.length === 0) {
      console.log('❌ No voices found.');
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
  }
}

listVoices();
