import fs from 'fs';
import https from 'https';
import path from 'path';
import { chromium } from 'playwright';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

interface PoemData {
  id: number;
  url: string;
  title?: string;
  content: string;
  error?: string;
}

function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    }).on('error', reject);
  });
}

function sanitizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

async function scrapePoem(id: number, browser: any): Promise<PoemData> {
  const url = `https://www.thewayofcode.com/#${id}`;
  console.log(`Fetching poem ${id}: ${url}`);

  // First try with simple HTTPS request (worked for some poems before)
  try {
    const html = await fetchHtml(url);

    const dom = new JSDOM(html, {
      url,
      referrer: url,
      contentType: 'text/html',
    });

    // Check if we got the security checkpoint page
    const doc = dom.window.document;
    const title = doc.title || '';
    if (title.includes('Security Checkpoint') || title.includes('Vercel')) {
      throw new Error('Blocked by security checkpoint');
    }

    // Remove the left navigation (numbers)
    const nav = doc.querySelector('nav, aside');
    if (nav && nav.parentNode) {
      nav.parentNode.removeChild(nav);
    }

    const articleNode = doc.querySelector('article') ?? doc.body;
    const reader = new Readability(dom.window.document);
    const parsed = reader.parse();
    const rawText = parsed?.textContent ?? articleNode.textContent ?? '';
    const sanitized = sanitizeText(rawText);

    // Extract title
    const titleElement = doc.querySelector('h1, h2, h3, title');
    const poemTitle = titleElement?.textContent?.trim() || title;

    if (sanitized.length > 50) { // If we got meaningful content
      return {
        id,
        url,
        title: poemTitle,
        content: sanitized,
      };
    }
  } catch (error) {
    console.log(`HTTPS method failed for poem ${id}, trying Playwright...`);
  }

  // Fallback to Playwright if HTTPS method fails
  try {
    const page = await browser.newPage();

    // Set realistic user agent and headers
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0',
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait and check if we got the security page
    await page.waitForTimeout(2000);
    const currentTitle = await page.title();
    if (currentTitle.includes('Security Checkpoint') || currentTitle.includes('Vercel')) {
      await page.close();
      throw new Error('Blocked by Vercel security checkpoint');
    }

    // Try to find the main content - look for common selectors
    const contentSelectors = [
      'article',
      '.poem-content',
      '.content',
      'main',
      '.main-content',
      '[data-poem-content]',
      '.prose',
      '.text-content'
    ];

    let content = '';
    for (const selector of contentSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          content = await element.textContent() || '';
          if (content.trim().length > 10) { // More meaningful content check
            break;
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    // If no content found with selectors, try to get all text from body excluding navigation
    if (!content.trim()) {
      // Remove navigation/sidebar elements
      await page.evaluate(() => {
        const navElements = document.querySelectorAll('nav, aside, .sidebar, .navigation, .menu');
        navElements.forEach(el => el.remove());
      });

      content = await page.evaluate(() => {
        const body = document.body;
        return body ? body.textContent || '' : '';
      });
    }

    // Try to extract title
    const title = await page.evaluate(() => {
      const titleSelectors = ['h1', 'h2', 'h3', '.title', '.poem-title'];
      for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent?.trim()) {
          return element.textContent?.trim();
        }
      }
      return document.title || `Poem ${window.location.hash.replace('#', '')}`;
    });

    await page.close();

    const sanitized = sanitizeText(content);

    return {
      id,
      url,
      title,
      content: sanitized,
    };
  } catch (error) {
    console.error(`Error fetching poem ${id}:`, error);
    return {
      id,
      url,
      content: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function main(): Promise<void> {
  const startId = 19;
  const endId = 19; // Test with poem 19 that we know worked before
  const poems: PoemData[] = [];
  const delay = 2000; // 2 second delay between requests to be respectful

  console.log(`Starting to scrape poems from ${startId} to ${endId}...`);

  // Launch browser
  const browser = await chromium.launch({ headless: true });

  try {
    for (let id = startId; id <= endId; id++) {
      const poem = await scrapePoem(id, browser);
      poems.push(poem);

      // Add delay between requests
      if (id < endId) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  } finally {
    await browser.close();
  }

  // Save to JSON file
  const outputPath = path.join(process.cwd(), 'poems.json');
  const jsonContent = JSON.stringify({
    metadata: {
      source: 'https://www.thewayofcode.com/',
      scrapedAt: new Date().toISOString(),
      totalPoems: poems.length,
      successful: poems.filter(p => !p.error).length,
      failed: poems.filter(p => p.error).length,
    },
    poems,
  }, null, 2);

  fs.writeFileSync(outputPath, jsonContent, 'utf8');
  console.log(`\nScraping completed!`);
  console.log(`Total poems: ${poems.length}`);
  console.log(`Successful: ${poems.filter(p => !p.error).length}`);
  console.log(`Failed: ${poems.filter(p => p.error).length}`);
  console.log(`Results saved to: ${outputPath}`);
}

void main().catch((error) => {
  console.error('Failed:', error);
  process.exit(1);
});
