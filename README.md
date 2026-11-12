# Lift Tracker

A workout, cardio and nutrition tracker that runs on your phone like an app.

## Start here (no setup needed)

**Open this on your phone: https://jbroefitzpatrick.github.io/lift-tracker/**

Then add it to your home screen: on iPhone, Safari → Share → Add to Home Screen; on Android, Chrome → ⋮ → Add to Home screen. Step-by-step help for anyone, no tech knowledge needed: [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md).

Everything below is for people changing the app's code. You don't need any of it to use the app.

---

Plain HTML/CSS/JS, no build step and no backend. All data stays on the phone (optional encrypted cloud backup). See [SPEC.md](SPEC.md) for the original requirements.

## What it does

- **Train:** log sets with steppers, rest timer (supersets aware), double progression with automatic weight jumps, deloads, pain flags, PR detection, warm-up sets with plates per side, effort targets that ramp through each block, quick check-ins ("easy / about right / too much / joint pain") that adjust next week's sets, notes, reordering, adding exercises, freestyle workouts, and editing past workouts.
- **Plan:** a plan builder from your age, body composition, experience, equipment and goal mix (strength, size, physique, muscular endurance, cardio endurance, fat loss), with suggested days and splits. A **year planner** lays bulk / cut / maintenance / mini-cut / diet-break phases over 52 weeks, lined up with training blocks and deloads.
- **Exercises:** 155-exercise library grouped by muscle, compound, accessory and conditioning, similarity-based swaps, form cues, step-by-step instructions and photos, favorite / never / "not at this gym" marks, multiple gyms with their own bars, plates and dumbbell steps.
- **Cardio:** day types, a cardio bank, muscle-freshness tracking, and suggestions that respect fatigue and upcoming lift days.
- **Conditioning:** sprints, erg intervals, plyometrics and circuit moves log rounds by time, distance, calories or reps, and link into circuits just like lifts. Built-in templates (Tabata, sprint intervals, 10 × 1 min, 4 × 4 min, the 7-minute circuit, kettlebell and plyometric circuits and more) follow published protocols. Timed rounds have a work timer that rolls into rest.
- **Fast logging:** each set row shows last time's result next to weight and reps (tap it to reuse the numbers), with warm-up, drop and failure set types, swipe to delete, a pinned workout bar with elapsed time, and an optional expanded list for logging every exercise from one screen.
- **Apple Health:** send a workout's active calories to Health with one tap, through a one-time iOS Shortcut (setup steps are in the app).
- **Edit the plan in place:** move or swap days, remove a day (its main lifts move to your other days), add a day by copying another, or change sets, reps and rest for a whole group of exercises at once. Exercises you chose by hand are kept when you rebuild the plan. Long lists have search.
- **Your own exercises:** create any exercise from the exercise picker (or straight from a search with no results): name, equipment, type, tap the muscles it works on a body map, and notes. Built-in exercises can have their muscles and notes edited too.
- **Core in every week:** one core exercise finishes each lifting day by default, rotating through flexion, anti-extension, anti-rotation, leg raises, rotation and side planks, alternating weighted and bodyweight. Or put core in the warm-up (light activation), in finishers, or in conditioning sessions only.
- **Exercise variety:** choose consistent lifts, accessories that rotate each block, or high variety (accessories weekly, secondary compounds each block). Focus lifts never rotate; swaps keep the same movement and muscle.
- **Flexible weeks:** tell it how many days you can train this week and how long each day; every main lift still gets done and accessories fit your time. Per day: short on time, extra time, a different gym (limited equipment), or two shorter sessions. Missed a day? It offers to fit it into the rest of the week.
- **Recovery that learns:** the day after hard training it asks how those muscles feel. Not recovered by the next session? Swap days, do a recovery routine, easy cardio, or train lighter, and next week that muscle group gets a set less. Timed stretching and foam-rolling routines are built in.
- **Finishers and conditioning scores:** add a 5–15 minute finisher that burns out (or spares) what you trained. Sprints, air bike and circuits remember your results and set the next target.
- **Running goal:** train for a faster 5k alongside lifting, with paces from your current time, hard runs kept away from heavy leg days, and lifting at maintenance if you want.
- **Weighted pullups and grip rotation:** any lift can be a focus lift; rotate variations (grips) each block or each workout. Bodyweight lifts count body weight in strength estimates.
- **Pain and injuries:** tap where it hurts on the body map (muscles or joints, left and right separately) and how bad it is. Exercises that load it are flagged with a lighter weight or gentler alternatives, cardio suggestions steer around it, and a daily check-in tracks it until it clears. Guidance follows the pain-monitoring model used in sports rehab.
- **Calories burned:** each workout and cardio session gets an active-calorie estimate (Compendium METs scaled to your own resting rate; heart rate or pace when logged). The Food tab shows eaten vs burned, and the estimate is tuned to your actual weight trend.
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
| `js/conditioning.js` | Interval and circuit templates, round measures |
| `js/bank.js` | Exercise library classification and similarity |
| `js/exercise-info.js` | Form cues, steps and photo links (generated) |
| `js/foods.js` | USDA food data (generated) |
| `js/science.js` | References shown in the app |
| `js/store.js` | Storage, snapshots, schema migrations, import/export |
| `js/crypto.js` | Encrypted backups (AES-256-GCM) |
| `js/week.js`, `js/recovery.js`, `js/running.js`, `js/ui-train.js` | Week planner, recovery check-ins, running goal, finishers and sharing |
| `js/ui-plantools.js` | Move, remove, add and bulk-edit plan days; keep hand-picked exercises on rebuild |
| `js/groups.js` | Muscle groups and parts for display |
| `js/core.js` | Core placement and weekly core rotation |
| `js/ui-exercise.js` | Create and edit your own exercises |
| `js/variety.js`, `js/swipe.js` | Exercise rotation levels; swipe actions on rows |
| `js/energy.js` | Resting rate, workout and cardio calorie estimates |
| `js/pain.js`, `js/ui-pain.js` | Pain reports on the body map and lighter alternatives |
| `js/cloud.js`, `js/ui-cloud.js` | Optional encrypted cloud backup (client and settings) |
| `cloud/` | The Cloudflare Worker for cloud backup and its config |
| `js/plan.js` | The original sample plan |
| `js/chart.js` | Small SVG line chart |
| `tools/` | Scripts that regenerate `foods.js` and `exercise-info.js` from the source datasets |
| `docs/` | Data & security notes, native iPhone app plan |
| `sw.js` | Service worker for offline use |

## Run it locally (developers only)

Only needed to test code changes on a computer. The service worker and ES modules need a web server (opening the file directly won't work). From the project folder:

```
npx serve .
```

## Deploy (GitHub Pages)

Already set up: pushing to `main` publishes to the link above within a minute or two. To set it up from scratch:

1. Push the project to a GitHub repo.
2. **Settings → Pages → Deploy from a branch**, pick `main` and `/ (root)`.
3. The site goes live at `https://<your-username>.github.io/<repo-name>/`.

## Install on iPhone

1. Open the site in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Open it from the home screen once while online. After that it works offline. Installing to the Home Screen also protects your data better than using it in a Safari tab.

## Shipping updates

When you change any file, bump `VERSION` in `sw.js` before deploying. Phones pick up the new version on the next launch or two.

## Backups

Settings → Data & security. Export an **encrypted backup** to Files regularly; the finished-workout screen offers it in one tap, and "Check a backup file" confirms a backup opens. Automatic snapshots on the device cover mistakes like a bad import or a bad update. For automatic off-phone copies, set up the free, end-to-end encrypted **cloud backup**: [docs/CLOUD-BACKUP.md](docs/CLOUD-BACKUP.md).

## Credits & data sources

- Exercise photos and step-by-step instructions: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) by yuhonas — The Unlicense (public domain).
- Food nutrients: [USDA FoodData Central](https://fdc.nal.usda.gov/), SR Legacy — public domain.
- Training and nutrition recommendations: see `js/science.js` (shown in the app with links).

## Known iPhone limits

- The screen stays awake during a workout so the rest timer can beep; the silent switch still mutes it.
- iOS Safari doesn't support vibration from web pages.
- No Apple Health or Watch — see [docs/NATIVE-APP.md](docs/NATIVE-APP.md) for the native app plan.
