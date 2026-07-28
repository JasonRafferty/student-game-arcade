const baseUrl = import.meta.env.BASE_URL;

document.querySelectorAll('.js-year').forEach((element) => {
  element.textContent = new Date().getFullYear();
});

function controllerIcon() {
  const icon = document.createElement('span');
  icon.className = 'game-icon text-6xl';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '🎮';
  return icon;
}

function createGameCard(game, index) {
  const article = document.createElement('article');
  article.className = 'game-card game-card--enter flex flex-col';
  article.style.setProperty('--card-order', index);

  const art = document.createElement('div');
  art.className = 'game-card__art';
  art.append(controllerIcon());

  const content = document.createElement('div');
  content.className = 'flex flex-1 flex-col p-6';

  const title = document.createElement('h3');
  title.className = 'font-arcade text-xs leading-relaxed text-gold mb-3';
  title.textContent = game.title;

  const description = document.createElement('p');
  description.className = 'font-body text-sm leading-relaxed text-slate-300 mb-6 flex-1';
  description.textContent = game.description || 'A game created by one of Jason’s students.';

  const link = document.createElement('a');
  link.className = 'arcade-button inline-flex items-center justify-center px-5 py-3 font-arcade text-[0.55rem] leading-relaxed focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-4 focus:ring-offset-arcade-screen';
  link.href = `${baseUrl}play.html?game=${encodeURIComponent(game.folder)}`;
  link.textContent = 'Play game →';
  link.setAttribute('aria-label', `Play ${game.title}`);

  content.append(title, description, link);
  article.append(art, content);
  return article;
}

async function loadGames() {
  const grid = document.querySelector('[data-games-grid]');
  const status = document.querySelector('[data-games-status]');
  if (!grid) return;

  try {
    const response = await fetch(`${baseUrl}games.json`);
    if (!response.ok) throw new Error(`Game list returned ${response.status}`);
    const games = await response.json();

    grid.replaceChildren();
    if (games.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state col-span-full px-6 py-12 text-center';
      empty.innerHTML = `
        <div class="game-icon text-5xl mb-5" aria-hidden="true">🕹️</div>
        <h3 class="font-arcade text-sm leading-relaxed text-gold mb-4">Arcade Ready</h3>
        <p class="font-body text-slate-300">Drop a game folder containing an <code class="text-arcade-blue">index.html</code> file into <code class="text-arcade-blue">public/games/</code>, then run the site.</p>
      `;
      grid.append(empty);
      if (status) status.textContent = 'No games have been added yet.';
      return;
    }

    games.forEach((game, index) => grid.append(createGameCard(game, index)));
    if (status) status.textContent = `${games.length} ${games.length === 1 ? 'game' : 'games'} available.`;
  } catch (error) {
    grid.replaceChildren();
    const message = document.createElement('p');
    message.className = 'col-span-full border-2 border-arcade-pink bg-arcade-pink/10 p-5 font-body text-pink-100';
    message.textContent = 'The game list could not be loaded. Run npm run discover and refresh the page.';
    grid.append(message);
    if (status) status.textContent = 'The game list could not be loaded.';
    console.error(error);
  }
}

loadGames();
