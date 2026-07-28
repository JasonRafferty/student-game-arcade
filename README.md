# Student Game Arcade

A gallery for HTML, CSS, and JavaScript games created by Jason's students.

## Add a game

1. Put the complete game folder inside `public/games/`.
2. Make sure the folder has an `index.html` at its top level.
3. Run `npm run dev`.

That is all. The discovery script reads the game's `<title>` and description automatically and
adds it to the gallery. CSS, JavaScript, images, sounds, and nested folders stay with the game.

Example:

```text
public/games/
└── space-quiz/
    ├── index.html
    ├── style.css
    ├── game.js
    └── images/
```

Use relative paths inside each game, such as `style.css` or `images/planet.png`. Avoid paths that
start with `/`, because the published site lives under `/student-game-arcade/`.

Folders without an `index.html` are ignored and reported in the terminal.

## Work locally

```bash
npm install
npm run dev
```

The site will print its local address in the terminal. The game list is regenerated whenever the
development server starts.

To refresh the list without restarting:

```bash
npm run discover
```

## Build

```bash
npm run build
npm run preview
```

The production site is written to `dist/`. Pushing to `main` will eventually deploy through the
included GitHub Pages workflow, once the repository is created and Pages is configured.
