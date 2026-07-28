import './main.js';

const baseUrl = import.meta.env.BASE_URL;
const params = new URLSearchParams(window.location.search);
const requestedFolder = params.get('game');

const title = document.querySelector('[data-game-title]');
const frame = document.querySelector('[data-game-frame]');
const directLink = document.querySelector('[data-direct-link]');
const message = document.querySelector('[data-player-message]');
const fullscreenButton = document.querySelector('[data-fullscreen]');
const shareGameButton = document.querySelector('[data-game-share]');
const shareGameLabel = document.querySelector('[data-game-share-label]');

async function copyGameUrl() {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(window.location.href);
    return;
  }

  const input = document.createElement('textarea');
  input.value = window.location.href;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.append(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('Copy command failed');
}

async function initialisePlayer() {
  try {
    const response = await fetch(`${baseUrl}games.json`);
    if (!response.ok) throw new Error(`Game list returned ${response.status}`);
    const games = await response.json();
    const game = games.find((item) => item.folder === requestedFolder);

    if (!game) {
      if (title) title.textContent = 'Game not found';
      if (message) message.textContent = 'This game is not available. Return to the arcade and choose another game.';
      if (frame) frame.hidden = true;
      if (directLink) directLink.hidden = true;
      if (fullscreenButton) fullscreenButton.hidden = true;
      if (shareGameButton) shareGameButton.hidden = true;
      return;
    }

    const encodedPath = game.path
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const gameUrl = `${baseUrl}games/${encodedPath}`;
    document.title = `${game.title} | Student Game Arcade`;
    if (title) title.textContent = game.title;
    if (message) message.textContent = game.description || 'A game created by one of Jason’s students.';
    if (frame) {
      frame.src = gameUrl;
      frame.title = game.title;
    }
    if (directLink) directLink.href = gameUrl;
  } catch (error) {
    if (title) title.textContent = 'Unable to load game';
    if (message) message.textContent = 'The arcade could not load the game list. Please try again.';
    if (frame) frame.hidden = true;
    if (shareGameButton) shareGameButton.hidden = true;
    console.error(error);
  }
}

if (shareGameButton) {
  let resetTimer;

  shareGameButton.addEventListener('click', async () => {
    window.clearTimeout(resetTimer);

    try {
      await copyGameUrl();
      if (shareGameLabel) shareGameLabel.textContent = 'Link copied!';
      shareGameButton.classList.add('game-share-button--success');
    } catch {
      if (shareGameLabel) shareGameLabel.textContent = 'Copy failed';
    }

    resetTimer = window.setTimeout(() => {
      if (shareGameLabel) shareGameLabel.textContent = 'Share with a friend';
      shareGameButton.classList.remove('game-share-button--success');
    }, 2200);
  });
}

if (fullscreenButton && frame) {
  fullscreenButton.addEventListener('click', async () => {
    try {
      await frame.requestFullscreen();
    } catch {
      window.open(frame.src, '_blank', 'noopener,noreferrer');
    }
  });
}

initialisePlayer();
