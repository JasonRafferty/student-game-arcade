import './main.js';

const baseUrl = import.meta.env.BASE_URL;
const params = new URLSearchParams(window.location.search);
const requestedFolder = params.get('game');

const title = document.querySelector('[data-game-title]');
const frame = document.querySelector('[data-game-frame]');
const directLink = document.querySelector('[data-direct-link]');
const message = document.querySelector('[data-player-message]');
const fullscreenButton = document.querySelector('[data-fullscreen]');

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
      return;
    }

    const gameUrl = `${baseUrl}games/${encodeURIComponent(game.folder)}/index.html`;
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
    console.error(error);
  }
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
