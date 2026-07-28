const WHATSAPP_NUMBER = '447897348436';
const baseUrl = import.meta.env.BASE_URL;

document.querySelectorAll('.js-whatsapp').forEach((link) => {
  const message = link.dataset.waMessage || "Hi Jason, I'd like to ask about tutoring.";
  link.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
});

const nav = document.querySelector('.nav');
const toggle = document.querySelector('.nav__toggle');

if (nav && toggle) {
  toggle.addEventListener('click', () => {
    const willOpen = nav.dataset.open !== 'true';
    nav.dataset.open = String(willOpen);
    toggle.setAttribute('aria-expanded', String(willOpen));
    toggle.setAttribute('aria-label', willOpen ? 'Close navigation' : 'Open navigation');
  });
}

document.querySelectorAll('.nav__links a').forEach((link) => {
  link.addEventListener('click', () => {
    if (nav) nav.dataset.open = 'false';
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation');
    }
  });
});

document.querySelectorAll('.js-year').forEach((element) => {
  element.textContent = new Date().getFullYear();
});

function controllerIcon() {
  const icon = document.createElement('span');
  icon.className = 'text-6xl';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '🎮';
  return icon;
}

function createGameCard(game) {
  const article = document.createElement('article');
  article.className = 'game-card flex flex-col';

  const art = document.createElement('div');
  art.className = 'game-card__art';
  art.append(controllerIcon());

  const content = document.createElement('div');
  content.className = 'flex flex-1 flex-col p-6';

  const title = document.createElement('h3');
  title.className = 'font-display text-xl font-bold text-ink mb-2';
  title.textContent = game.title;

  const description = document.createElement('p');
  description.className = 'font-body text-sm leading-relaxed text-gray-600 mb-6 flex-1';
  description.textContent = game.description || 'A game created by one of Jason’s students.';

  const link = document.createElement('a');
  link.className = 'inline-flex items-center justify-center rounded-lg bg-gold px-5 py-3 font-body font-bold text-navy transition-colors hover:bg-gold-deep focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2';
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
        <div class="text-5xl mb-4" aria-hidden="true">🕹️</div>
        <h3 class="font-display text-2xl font-bold text-ink mb-2">The arcade is ready</h3>
        <p class="font-body text-gray-600">Drop a game folder containing an <code>index.html</code> file into <code>public/games/</code>, then run the site.</p>
      `;
      grid.append(empty);
      if (status) status.textContent = 'No games have been added yet.';
      return;
    }

    games.forEach((game) => grid.append(createGameCard(game)));
    if (status) status.textContent = `${games.length} ${games.length === 1 ? 'game' : 'games'} available.`;
  } catch (error) {
    grid.replaceChildren();
    const message = document.createElement('p');
    message.className = 'col-span-full rounded-lg bg-red-50 p-5 font-body text-red-800';
    message.textContent = 'The game list could not be loaded. Run npm run discover and refresh the page.';
    grid.append(message);
    if (status) status.textContent = 'The game list could not be loaded.';
    console.error(error);
  }
}

loadGames();
