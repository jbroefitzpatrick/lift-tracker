# Lift Tracker

A workout, cardio and nutrition tracker that runs as a web page saved to your iPhone home screen. Plain HTML/CSS/JS — no build step, no backend. All data stays on the phone.

See [SPEC.md](SPEC.md) for the original requirements.

## What it does

- **Train:** log sets with steppers, rest timer (supersets aware), double progression with automatic weight jumps, deloads, pain flags, PR detection, warm-up sets with plates per side, effort targets that ramp through each block, quick check-ins ("easy / about right / too much / joint pain") that adjust next week's sets, notes, reordering, adding exercises, freestyle workouts, and editing past workouts.
- **Plan:** a plan builder from your age, body composition, experience, equipment and goal mix (strength, size, physique, muscular endurance, cardio endurance, fat loss), with suggested days and splits. A **year planner** lays bulk / cut / maintenance / mini-cut / diet-break phases over 52 weeks, lined up with training blocks and deloads.
- **Exercises:** 122-exercise library grouped by muscle, compound vs accessory, similarity-based swaps, form cues, step-by-step instructions and photos, favorite / never / "not at this gym" marks, multiple gyms with their own bars, plates and dumbbell steps.
- **Cardio:** day types, a cardio bank, muscle-freshness tracking, and suggestions that respect fatigue and upcoming lift days.
- **Nutrition:** calorie and macro targets from your phase, adaptive maintenance from your logs, weekly check-ins with suggested adjustments, a 138-food USDA database plus your own foods, meal logging, saved meals and scaled meal ideas.
- **Body:** bodyweight with 7-day average and target rate, measurements, and private progress photos.
- **Data:** IndexedDB + localStorage mirror, daily snapshots, encrypted backups. See [docs/DATA-SECURITY.md](docs/DATA-SECURITY.md).
- **Design:** simple cards with details on demand, four tabs, 44 pt targets, WCAG AA contrast, Dynamic Type. See [docs/DESIGN.md](docs/DESIGN.md).

Every recommendation links to its sources in the app (Plan builder → Why these numbers, Food → How these are set).

## Files

| Path | What it is |
|---|---|
| `index.html` | App shell, home-screen meta tags, Content-Security-Policy |
| `styles.css` | All styles (dark by default, light option) |
| `js/app.js` | Main screens, workout logging and event handling |
| `js/drag.js` | Drag-to-reorder with keyboard alternative |
| `js/icons.js` | Line icon set |
| `js/ui-food.js` | Food tab |
| `js/ui-year.js` | Plan → Year view |
| `js/ui-extra.js` | Exercise detail, gyms, data & security, measurements & photos, weekly volume |
| `js/engine.js` | Progression engine: double progression, adaptation, deloads |
| `js/builder.js` | Plan builder: goals → prescription, days, splits, exercise selection, volume balancing |
| `js/nutrition.js` | Energy and macro targets, adaptive maintenance, check-ins, meal templates |
| `js/year.js` | Year phases, projections, phase guidance |
| `js/records.js` | Personal records and check-in adjustments |
| `js/gym.js` | Plate math, rounding to real weights, warm-ups, availability |
| `js/fatigue.js` | Muscle fatigue / freshness model |
| `js/cardio-bank.js`, `js/cardio.js` | Cardio options and fatigue-aware suggestions |
| `js/bank.js` | Exercise library classification and similarity |
| `js/exercise-info.js` | Form cues, steps and photo links (generated) |
| `js/foods.js` | USDA food data (generated) |
| `js/science.js` | References shown in the app |
| `js/store.js` | Storage, snapshots, schema migrations, import/export |
| `js/crypto.js` | Encrypted backups (AES-256-GCM) |
| `js/plan.js` | The original sample plan |
| `js/chart.js` | Small SVG line chart |
| `tools/` | Scripts that regenerate `foods.js` and `exercise-info.js` from the source datasets |
| `docs/` | Data & security notes, native iPhone app plan |
| `sw.js` | Service worker for offline use |

## Run it locally

The service worker and ES modules need a web server (opening the file directly won't work). From this folder:

```
npx serve .
```

## Deploy (GitHub Pages)

1. Push this folder to a GitHub repo.
2. **Settings → Pages → Deploy from a branch**, pick `main` and `/ (root)`.
3. The site goes live at `https://<your-username>.github.io/<repo-name>/`.

## Install on iPhone

1. Open the site in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Open it from the home screen once while online. After that it works offline. Installing to the Home Screen also protects your data better than using it in a Safari tab.

## Shipping updates

When you change any file, bump `VERSION` in `sw.js` before deploying. Phones pick up the new version on the next launch or two.

## Backups

Settings → Data & security. Export an **encrypted backup** to Files regularly (the app reminds you weekly). Automatic snapshots on the device cover mistakes like a bad import.

## Credits & data sources

- Exercise photos and step-by-step instructions: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) by yuhonas — The Unlicense (public domain).
- Food nutrients: [USDA FoodData Central](https://fdc.nal.usda.gov/), SR Legacy — public domain.
- Training and nutrition recommendations: see `js/science.js` (shown in the app with links).

## Known iPhone limits

- The screen stays awake during a workout so the rest timer can beep; the silent switch still mutes it.
- iOS Safari doesn't support vibration from web pages.
- No Apple Health or Watch — see [docs/NATIVE-APP.md](docs/NATIVE-APP.md) for the native app plan.
