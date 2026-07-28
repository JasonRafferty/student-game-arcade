# Student Game Arcade

A gallery for HTML, CSS, and JavaScript games created by Jason's students.

## Add a game

1. Put a standalone `.html` game or a complete game folder inside `public/games/`.
2. For a folder-based game, make sure it has an `index.html` at its top level.
3. Run `npm run dev`.

That is all. The discovery script reads the game's `<title>` and description automatically and
adds it to the gallery. CSS, JavaScript, images, sounds, and nested folders stay with the game.

Standalone game:

```text
public/games/
└── space-quiz.html
```

Game with separate CSS, JavaScript, or assets:

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

Add these metadata tags inside the game's `<head>` so its learning stage, subject, and pixel logo
appear in the gallery:

```html
<meta name="game-stage" content="ks3">
<meta name="game-subject" content="science">
<meta name="game-logo" content="logos/my-game.svg">
```

Supported stages are `sats`, `ks3`, and `gcse`. Current subjects include `maths`, `english`,
`biology`, and `science`. Logos live in `public/logos/`.

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
