const baseUrl = import.meta.env.BASE_URL;

document.querySelectorAll('.js-year').forEach((element) => {
  element.textContent = new Date().getFullYear();
});

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.append(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('Copy command failed');
}

document.querySelectorAll('[data-share-button]').forEach((button) => {
  const label = button.querySelector('[data-share-label]');
  let resetTimer;

  button.addEventListener('click', async () => {
    clearTimeout(resetTimer);

    try {
      const arcadeUrl = new URL(baseUrl, window.location.origin).href;
      await copyText(arcadeUrl);
      if (label) label.textContent = 'Link copied!';
      button.classList.add('share-button--success');
    } catch {
      if (label) label.textContent = 'Copy failed';
    }

    resetTimer = window.setTimeout(() => {
      if (label) {
        label.innerHTML = '<span class="sm:hidden">Share</span><span class="hidden sm:inline">Share with friends</span>';
      }
      button.classList.remove('share-button--success');
    }, 2200);
  });
});

const stageLabels = {
  sats: 'SATs · Year 6',
  ks3: 'KS3 · Years 7–9',
  gcse: 'GCSE · Years 10–11',
  uncategorised: 'Stage TBC',
};

const subjectLabels = {
  maths: 'Maths',
  english: 'English',
  biology: 'Biology',
  science: 'Science',
  general: 'General',
};

function gameLogo(game) {
  if (!game.logo) {
    const fallback = document.createElement('span');
    fallback.className = 'game-icon text-6xl';
    fallback.setAttribute('aria-hidden', 'true');
    fallback.textContent = '🎮';
    return fallback;
  }

  const logo = document.createElement('img');
  logo.className = 'game-logo';
  logo.src = `${baseUrl}${game.logo}`;
  logo.alt = '';
  logo.setAttribute('aria-hidden', 'true');
  logo.width = 112;
  logo.height = 112;
  return logo;
}

function createTag(text, modifier) {
  const tag = document.createElement('span');
  tag.className = `game-tag game-tag--${modifier}`;
  tag.textContent = text;
  return tag;
}

function createGameCard(game, index) {
  const article = document.createElement('article');
  article.className = 'game-card game-card--enter flex flex-col';
  article.style.setProperty('--card-order', index);

  const art = document.createElement('div');
  art.className = 'game-card__art';
  art.append(gameLogo(game));

  const content = document.createElement('div');
  content.className = 'flex flex-1 flex-col p-6';

  const tags = document.createElement('div');
  tags.className = 'game-tags';
  tags.append(
    createTag(stageLabels[game.stage] || stageLabels.uncategorised, 'stage'),
    createTag(
      subjectLabels[game.subject] || game.subject || subjectLabels.general,
      `subject-${game.subject || 'general'}`,
    ),
  );

  const title = document.createElement('h3');
  title.className = 'font-arcade text-xs leading-relaxed text-gold mb-3 mt-4';
  title.textContent = game.title;

  const description = document.createElement('p');
  description.className = 'font-body text-sm leading-relaxed text-slate-300 mb-6 flex-1';
  description.textContent = game.description || 'A game created by one of Jason’s students.';

  const link = document.createElement('a');
  link.className = 'arcade-button inline-flex items-center justify-center px-5 py-3 font-arcade text-[0.55rem] leading-relaxed focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-4 focus:ring-offset-arcade-screen';
  link.href = `${baseUrl}play.html?game=${encodeURIComponent(game.folder)}`;
  link.textContent = 'Play game →';
  link.setAttribute('aria-label', `Play ${game.title}`);

  content.append(tags, title, description, link);
  article.append(art, content);
  return article;
}

async function loadGames() {
  const grid = document.querySelector('[data-games-grid]');
  const gameCount = document.querySelector('[data-games-count]');
  const filterButtons = [...document.querySelectorAll('[data-stage-filter]')];
  if (!grid) return;

  try {
    const response = await fetch(`${baseUrl}games.json`);
    if (!response.ok) throw new Error(`Game list returned ${response.status}`);
    const games = await response.json();

    if (games.length === 0) {
      grid.replaceChildren();
      const empty = document.createElement('div');
      empty.className = 'empty-state col-span-full px-6 py-12 text-center';
      empty.innerHTML = `
        <div class="game-icon text-5xl mb-5" aria-hidden="true">🕹️</div>
        <h3 class="font-arcade text-sm leading-relaxed text-gold mb-4">Arcade Ready</h3>
        <p class="font-body text-slate-300">Drop a game folder containing an <code class="text-arcade-blue">index.html</code> file into <code class="text-arcade-blue">public/games/</code>, then run the site.</p>
      `;
      grid.append(empty);
      if (gameCount) gameCount.textContent = '0 games available';
      return;
    }

    const renderGames = (stage = 'all') => {
      const visibleGames = stage === 'all'
        ? games
        : games.filter((game) => game.stage === stage);

      grid.replaceChildren();
      if (visibleGames.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state col-span-full px-6 py-12 text-center';
        empty.innerHTML = `
          <div class="game-icon text-5xl mb-5" aria-hidden="true">🕹️</div>
          <h3 class="font-arcade text-sm leading-relaxed text-gold mb-4">More Games Coming Soon</h3>
          <p class="font-body text-slate-300">There are no games in this learning stage yet.</p>
        `;
        grid.append(empty);
      } else {
        visibleGames.forEach((game, index) => grid.append(createGameCard(game, index)));
      }

      if (gameCount) {
        gameCount.textContent = `${visibleGames.length} ${visibleGames.length === 1 ? 'game' : 'games'} available`;
      }
    };

    filterButtons.forEach((button) => {
      button.addEventListener('click', () => {
        filterButtons.forEach((item) => {
          const selected = item === button;
          item.classList.toggle('stage-filter--active', selected);
          item.setAttribute('aria-pressed', String(selected));
        });
        renderGames(button.dataset.stageFilter);
      });
    });

    renderGames();
  } catch (error) {
    grid.replaceChildren();
    const message = document.createElement('p');
    message.className = 'col-span-full border-2 border-arcade-pink bg-arcade-pink/10 p-5 font-body text-pink-100';
    message.textContent = 'The game list could not be loaded. Run npm run discover and refresh the page.';
    grid.append(message);
    if (gameCount) gameCount.textContent = 'Game count unavailable';
    console.error(error);
  }
}

loadGames();
