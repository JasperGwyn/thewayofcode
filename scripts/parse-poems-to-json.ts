import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PoemChapter {
  number: number;
  content: string;
}

interface PoemsData {
  title: string;
  description: string;
  chapters: PoemChapter[];
}

function parsePoems(): PoemsData {
  const poemsPath = path.join(__dirname, '..', 'assets', 'poems', 'poems.md');
  const content = fs.readFileSync(poemsPath, 'utf-8');

  const lines = content.split('\n');
  const chapters: PoemChapter[] = [];

  let currentChapter: PoemChapter | null = null;
  let currentContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this is a chapter header
    const chapterMatch = line.match(/^\*\*Chapter (\d+)\*\*$/);
    if (chapterMatch) {
      // Save previous chapter if exists
      if (currentChapter) {
        currentChapter.content = currentContent.join('\n').trim();
        chapters.push(currentChapter);
      }

      // Start new chapter
      const chapterNumber = parseInt(chapterMatch[1]);
      currentChapter = {
        number: chapterNumber,
        content: ''
      };
      currentContent = [];
    } else if (currentChapter && line.trim()) {
      // Add content to current chapter
      currentContent.push(line);
    }
  }

  // Add the last chapter
  if (currentChapter) {
    currentChapter.content = currentContent.join('\n').trim();
    chapters.push(currentChapter);
  }

  return {
    title: "The Way of Code",
    description: "A programmer's adaptation of the Tao Te Ching",
    chapters
  };
}

// Generate the JSON file
function generateJson(): void {
  const poemsData = parsePoems();
  const outputPath = path.join(__dirname, '..', 'poems.json');

  fs.writeFileSync(outputPath, JSON.stringify(poemsData, null, 2), 'utf-8');
  console.log(`✅ Generated poems.json with ${poemsData.chapters.length} chapters`);
}

// Run the script
generateJson();

export { parsePoems, generateJson, PoemsData, PoemChapter };
