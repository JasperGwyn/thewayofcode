import { app } from 'electron';
import { randomInt } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../log.js';

export type PickedArticle = {
  id: number;
  url: string;
};

type ArticleCache = {
  lastPickedId: number | null;
  lastPickedAt: string | null;
  history: number[];
};

const MIN_ARTICLE_ID = 1;
const MAX_ARTICLE_ID = 81;
const HISTORY_LIMIT = 5;
const CACHE_FILE_NAME = 'articles.json';
const FALLBACK_URL = 'https://www.thewayofcode.com/';

function getArticlesCachePath(): string {
  if (!app.isReady()) {
    throw new Error('ArticlePicker: Electron app must be ready before resolving userData path');
  }

  const userDataDir = app.getPath('userData');
  return path.join(userDataDir, CACHE_FILE_NAME);
}

async function readCacheFile(cachePath: string): Promise<ArticleCache | null> {
  try {
    const rawContent = await fs.readFile(cachePath, 'utf-8');
    const parsedContent = JSON.parse(rawContent) as Partial<ArticleCache>;

    return {
      lastPickedId: typeof parsedContent.lastPickedId === 'number' ? parsedContent.lastPickedId : null,
      lastPickedAt: typeof parsedContent.lastPickedAt === 'string' ? parsedContent.lastPickedAt : null,
      history: Array.isArray(parsedContent.history)
        ? parsedContent.history.filter((value): value is number => typeof value === 'number')
        : [],
    };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code !== 'ENOENT') {
      logger.warn('ArticlePicker: Failed to read cache file, ignoring cache', error);
    }

    return null;
  }
}

async function writeCacheFile(cachePath: string, cache: ArticleCache): Promise<void> {
  const directory = path.dirname(cachePath);
  await fs.mkdir(directory, { recursive: true });

  const data = JSON.stringify(cache, null, 2);
  await fs.writeFile(cachePath, data, 'utf-8');
}

function generateRandomArticleId(excludedIds: Set<number>): number {
  const attempts = Math.max(MAX_ARTICLE_ID - MIN_ARTICLE_ID + 1, 10);

  for (let attemptIndex = 0; attemptIndex < attempts; attemptIndex += 1) {
    const candidate = randomInt(MIN_ARTICLE_ID, MAX_ARTICLE_ID + 1);
    if (!excludedIds.has(candidate)) {
      return candidate;
    }
  }

  return randomInt(MIN_ARTICLE_ID, MAX_ARTICLE_ID + 1);
}

function buildArticleUrl(articleId: number): string {
  return `https://www.thewayofcode.com/#${articleId}`;
}

function buildArticleCache(existingCache: ArticleCache | null, articleId: number): ArticleCache {
  const timestamp = new Date().toISOString();
  const previousHistory = existingCache?.history ?? [];

  const updatedHistory = [articleId, ...previousHistory.filter((value) => value !== articleId)].slice(0, HISTORY_LIMIT);

  return {
    lastPickedId: articleId,
    lastPickedAt: timestamp,
    history: updatedHistory,
  };
}

export async function pickRandomArticle(): Promise<PickedArticle> {
  const cachePath = getArticlesCachePath();
  const cache = await readCacheFile(cachePath);

  const excludedIds = new Set<number>(cache?.history ?? []);
  const articleId = generateRandomArticleId(excludedIds);
  const pickedArticle: PickedArticle = {
    id: articleId,
    url: buildArticleUrl(articleId),
  };

  try {
    const updatedCache = buildArticleCache(cache, articleId);
    await writeCacheFile(cachePath, updatedCache);
  } catch (error) {
    logger.warn('ArticlePicker: Failed to persist cache file', error);
  }

  return pickedArticle;
}

export function getFallbackArticle(): PickedArticle {
  return {
    id: 0,
    url: FALLBACK_URL,
  };
}


