# Uncharted — AR Puzzle Verifier

A WebAR experience built on [8th Wall](https://www.8thwall.com/) and A-Frame. Point your camera at the puzzle image target; when detected, a frame is automatically captured and sent to a verification API that checks whether the puzzle is fully assembled. Results appear in a card overlay at the bottom of the screen.

## Features

- Image-target tracking with animated bracket reticle
- Auto-triggers verification on target detection (no button tap required)
- Indeterminate progress bar during API call
- Success / failure result card with optional leaderboard submission
- Camera feed runs continuously — no pause/resume on overlay

## Setup

Requires Node/npm ([nvm](https://github.com/nvm-sh/nvm) or [nodejs.org](https://nodejs.org/en/download)).

```bash
npm install
```

## Development

```bash
npm run serve
```

To test on a mobile device (required for camera/AR), expose the local server over HTTPS with [ngrok](https://ngrok.com/):

```javascript
// config/webpack.config.js — devServer section
allowedHosts: ['.ngrok-free.dev']
```

## Build & Deploy

```bash
npm run build   # output → dist/
```

The `dist/` folder is a static bundle that can be hosted anywhere. The project is configured for [Vercel](https://vercel.com/) via `vercel.json`.

## Project Structure

```
src/
  index.html              # entry point, all UI markup and inline styles
  app.js                  # registers A-Frame components, wires image targets
  components/
    verifyOverlay.js      # bracket reticle, auto-verify flow, result overlay
    spawn.js              # shows/hides 3D content on target found/lost
    postprocessing.js     # bloom / post-fx on the 3D scene
    ...
  assets/                 # models, textures, thumbnails
image-targets/            # 8th Wall image target JSON (puzzle.json)
config/                   # webpack config and TypeScript definitions
external/                 # vendored scripts (A-Frame, 8th Wall engine)
```

## Verification API

On target detection the app POSTs a JPEG frame (base64) to the Lambda endpoint in `verifyOverlay.js`. The response is `{ complete: boolean, reason: string }`. If `complete`, an optional leaderboard submission is available via the session API.
