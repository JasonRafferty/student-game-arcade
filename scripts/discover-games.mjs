import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const gamesDirectory = join(projectRoot, 'public', 'games');
const manifestPath = join(projectRoot, 'public', 'games.json');

function decodeHtml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function pathToTitle(path) {
  return path
    .replace(/\.html$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getTitle(html, path) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtml(match[1]) : pathToTitle(path);
}

function getDescription(html) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const descriptionTag = tags.find((tag) => /\bname\s*=\s*["']description["']/i.test(tag));
  const match = descriptionTag?.match(/\bcontent\s*=\s*["']([^"']*)["']/i);
  return match ? decodeHtml(match[1]) : '';
}

await mkdir(gamesDirectory, { recursive: true });
const entries = await readdir(gamesDirectory, { withFileTypes: true });
const games = [];

for (const entry of entries) {
  if (entry.name.startsWith('.')) continue;

  const isStandaloneGame = entry.isFile() && entry.name.toLowerCase().endsWith('.html');
  const isGameFolder = entry.isDirectory();
  if (!isStandaloneGame && !isGameFolder) continue;

  const gamePath = isStandaloneGame ? entry.name : `${entry.name}/index.html`;
  const indexPath = isStandaloneGame
    ? join(gamesDirectory, entry.name)
    : join(gamesDirectory, entry.name, 'index.html');
  try {
    const html = await readFile(indexPath, 'utf8');
    games.push({
      folder: isStandaloneGame ? entry.name.replace(/\.html$/i, '') : entry.name,
      path: gamePath,
      title: getTitle(html, entry.name),
      description: getDescription(html),
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`Skipped "${entry.name}": no index.html found.`);
      continue;
    }
    throw error;
  }
}

games.sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));
await writeFile(manifestPath, `${JSON.stringify(games, null, 2)}\n`);
console.log(`Discovered ${games.length} ${games.length === 1 ? 'game' : 'games'}.`);
