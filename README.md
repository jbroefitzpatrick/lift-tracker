# Lift Tracker

A personal workout tracker that runs as a web page saved to your iPhone home screen. Plain HTML/CSS/JS — no build step, no backend. All data stays on the phone.

See [SPEC.md](SPEC.md) for the full requirements.

## Files

| Path | What it is |
|---|---|
| `index.html` | App shell and iPhone home-screen meta tags |
| `styles.css` | All styles (dark by default, light option) |
| `js/plan.js` | Preloaded exercises and the Mon–Fri plan |
| `js/bank.js` | Exercise bank (~120 lifts): compound/accessory, movement, primary and secondary muscles, similarity scoring for swaps |
| `js/engine.js` | Progression engine: double progression, adaptation, deloads, race block, row rotation |
| `js/store.js` | Storage (localStorage), schema version + migrations, JSON/CSV export and import |
| `js/chart.js` | Small SVG line chart |
| `js/app.js` | Screens and interactions |
| `sw.js` | Service worker for offline use |
| `manifest.webmanifest`, `icons/` | Install metadata and icons |

## Run it locally

The service worker and ES modules need a web server (opening the file directly won't work). From this folder:

```
npx serve .
```

or any static server, then open the printed URL.

## Deploy (GitHub Pages)

1. Create a new GitHub repo and push this folder to it.
2. In the repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, pick `main` and `/ (root)`, save.
3. After a minute the site is live at `https://<your-username>.github.io/<repo-name>/`.

Netlify or Cloudflare Pages also work: drag the folder onto Netlify Drop, or point Cloudflare Pages at the repo with no build command and output directory `/`.

## Install on iPhone

1. Open the site in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Open it from the home screen once while online. After that it works offline.

## Shipping updates

When you change any file, bump `VERSION` in `sw.js` (e.g. `lift-v2`) before deploying. Phones pick up the new version on the next launch after it downloads (sometimes it takes two launches).

## Backups

iOS can clear a web app's storage if it isn't used for a while. Use **Settings → Export backup (JSON)** regularly and save it to Files. **Import backup** restores it. **Export history (CSV)** gives a spreadsheet-friendly copy.

## Known iPhone limits

- Rest timer sound plays only while the app is open, and the phone's silent switch mutes it.
- iOS Safari doesn't support vibration from web pages, so there's no haptic buzz on iPhone.
