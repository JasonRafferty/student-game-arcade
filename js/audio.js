const audioButton = document.querySelector('[data-audio-toggle]');

if (audioButton) {
  const audioIcon = audioButton.querySelector('[data-audio-icon]');
  const audioLabel = audioButton.querySelector('[data-audio-label]');
  const preferenceKey = 'student-arcade-music';
  const music = new Audio(`${import.meta.env.BASE_URL}audio/arcade-theme.mp3`);

  let enabled = true;

  music.autoplay = true;
  music.loop = true;
  music.preload = 'auto';
  music.volume = 0.85;

  try {
    enabled = localStorage.getItem(preferenceKey) !== 'off';
  } catch {
    // Music still works when storage is unavailable.
  }

  function updateButton() {
    const isPlaying = enabled && !music.paused;
    audioButton.classList.toggle('music-button--muted', !isPlaying);
    audioButton.setAttribute('aria-pressed', String(isPlaying));
    audioButton.setAttribute('aria-label', isPlaying ? 'Pause arcade music' : 'Play arcade music');
    if (audioIcon) audioIcon.textContent = isPlaying ? '♫' : '♪̸';
    if (audioLabel) audioLabel.textContent = isPlaying ? 'Pause music' : 'Play music';
  }

  async function startPlayback() {
    if (!enabled || !music.paused) return;
    try {
      await music.play();
    } catch {
      // Browsers that block autoplay will start it on the first interaction.
    }
  }

  async function setEnabled(nextEnabled) {
    enabled = nextEnabled;
    music.muted = !enabled;

    try {
      localStorage.setItem(preferenceKey, enabled ? 'on' : 'off');
    } catch {
      // Keep the current session preference when storage is unavailable.
    }

    if (enabled) {
      await startPlayback();
    } else {
      music.pause();
    }
    updateButton();
  }

  function activateMusic(event) {
    if (!enabled || event.target.closest('[data-audio-toggle]')) return;
    startPlayback();
  }

  music.muted = !enabled;
  updateButton();
  startPlayback();
  document.addEventListener('pointerdown', activateMusic, { once: true });

  audioButton.addEventListener('click', () => {
    setEnabled(!enabled || music.paused);
  });

  music.addEventListener('play', updateButton);
  music.addEventListener('pause', updateButton);

  window.addEventListener('arcade:game-launch', () => {
    music.pause();
  });

  music.addEventListener('error', () => {
    audioButton.disabled = true;
    audioButton.setAttribute('aria-label', 'Arcade music unavailable');
    if (audioLabel) audioLabel.textContent = 'Music unavailable';
  });
}
