# Lift Tracker — Build Spec

A personal workout tracker that runs as a web page saved to an iPhone home screen. It logs daily lifts, calculates the next session's targets with built-in progression, adapts to performance, and leaves room for nutrition tracking later.

## How to use this file (for Claude Code)

Build the app described here in this folder. Ask before making choices this spec doesn't cover. Start with a working MVP (sections 1–5), then iterate.

## 1. Tech requirements

- **Static site, no backend, no build step required.** Plain HTML/CSS/JS, or a light framework only if it stays a static build.
- **Installable on iPhone:** `manifest.webmanifest` (name, icons, `display: standalone`, theme color), apple-touch-icon, `apple-mobile-web-app-capable` meta tags, safe-area insets for the notch/home bar.
- **Works offline:** a service worker caches the app shell so it opens in the gym with no signal.
- **Storage:** IndexedDB (or localStorage for MVP) on the device. All data stays on the phone.
- **Backup:** Export all data to a JSON file and import it back. Also export history as CSV. (iOS can clear site data, so backups matter.)
- **Hosting:** free static hosting such as GitHub Pages, Netlify or Cloudflare Pages. Include short deploy instructions in a README.
- **Mobile first:** designed for one-handed use at ~390px width; big tap targets (44px+); dark mode by default with a light option.
- **Units:** pounds.

## 2. Screens

1. **Today** — opens to the day of the week's session (Mon–Fri), with a day switcher. Shows exercises in order with superset/circuit groups visually linked (e.g. 3a/3b). Each exercise shows target sets × reps, target weight, last session's result, and a note.
2. **Logging a set** — tap a set row, enter weight (prefilled with target) and reps (prefilled with the top of the last result), and an optional RIR (reps in reserve, 0–5). Steppers (+/−) for weight and reps; no keyboard needed for typical use. Check off sets as done.
3. **Rest timer** — starts automatically when a set is checked. Uses the exercise's rest time; in a superset, starts only after the last exercise of the round. Vibrates/sounds when done (where iOS allows).
4. **Finish workout** — summary of the session, which lifts progressed, which stalled, and next session's targets.
5. **History** — per exercise: list of past sessions and a simple chart of estimated 1RM (Epley: weight × (1 + reps/30)) and top-set weight over time.
6. **Plan editor** — add, remove, reorder or swap exercises; edit sets, rep range, rest, increment and notes. Swaps keep history per exercise.
7. **Settings** — deload interval, increments, units, theme, export/import.
8. **Nutrition (placeholder)** — an empty tab with a "coming later" state. Design the data model so daily entries (calories, protein, carbs, fat, bodyweight) can be added without migrations breaking workout data.
9. **Bodyweight** — optional daily weigh-in with a 7-day average, since the bulk targets 0.25–0.5% of bodyweight gain per week.

## 3. Progression engine

### Core rule: double progression
Each exercise has a rep range (e.g. 8–12) and a target weight.
- If **every working set** reaches the **top** of the range (and logged RIR ≥ the exercise's minimum, if logged) → next session's weight goes up by the exercise's increment, and target reps reset to the bottom of the range.
- If reps land **inside** the range → keep the weight; the target becomes beating last session's total reps.
- If **any set falls below the bottom** of the range → keep the weight once. If it happens **two sessions in a row** → reduce weight ~5% (rounded to the nearest available increment).

### Adaptation
- **Too easy:** if all sets hit the top of the range with logged RIR ≥ 4 → double the increment for that jump.
- **Too hard:** if the first set misses the bottom of the range by 3+ reps → reduce weight ~10%.
- **Stall detection:** no increase in weight or total reps for 3 consecutive sessions → flag the exercise, and suggest either dropping a set for a week or swapping to a variation at the next block.
- **Pain flag:** a "pain" button on any set. It ends that exercise for the day, shows the listed substitute, and excludes the session from progression math. Two pain flags in two weeks → show a warning on the exercise.
- **Bodyweight exercises:** progress reps first; once the top of the range is hit on all sets, suggest adding 5–10 lb of load.

### Default increments
| Type | Increment |
|---|---|
| Upper-body barbell compound | +5 lb |
| Lower-body barbell compound | +10 lb |
| Dumbbells | +5 lb (next DB) |
| Machines / cables | +5 lb, or one plate/stack step (user editable per exercise) |
| Bodyweight | reps, then +5–10 lb load |

### Deloads
- Default: every 5th week (setting: every 4 or 5 weeks).
- Deload week: same exercises, sets cut roughly in half (round up), same weight or up to 10% lighter, target RIR 3–4.
- Deload sessions don't count toward progression or stall detection.
- After a deload, prompt to rotate the Thursday row compound (cable row → lat pulldown → bent-over barbell row → repeat).

### Special rules
- **Bench press (shoulder rehab):** stay in the 8–12 range; increase only after all sets hit 12 *and* the user confirms "pain-free" at the end of the exercise. Increment +5 lb.
- **Preacher curl:** supports an optional drop-set mode (each set ~10 lb lighter with more reps). Progress the top set.

## 4. Training plan (preload this)

Superset/circuit groups share a number (3a, 3b). Rest is after the full round. "TBD" means the user hasn't logged a weight yet, so the first session sets the baseline.

### Monday — Upper
| # | Exercise | Sets × reps | Rest | Start weight | Notes |
|---|---|---|---|---|---|
| 1 | Hammer Strength iso row | 3–4 × 6–10 | 2–3 min | 105 | Pull compound |
| 2 | DB incline bench | 3 × 8–12 | 2 min | 95 (per DB) | Push compound; current range 85–95 |
| 3a | Behind-the-back cable curl | 3 × 8–12 | — | 35 | |
| 3b | One-arm cable tricep side extension (or pushdown) | 3 × 8–12 | 90 s | 35 | |
| 4a | Neutral-grip pullup | 3 × 8–12 | — | Bodyweight | |
| 4b | Cable lateral raise | 4 × 12–20 | 90 s | TBD | 4th set alone after last round |
| 5a | Machine rear delt fly | 3 × 10–15 | — | 160 | |
| 5b | Machine fly | 3 × 10–15 | 90 s | 200 | Stop at chest level |
| 6a | Handstand pushup | 3 × 18–22 | — | Bodyweight | Deficit or slower tempo past 22 |
| 6b | Exercise ball crunch (weighted) | 3 × 15–25 | 90 s | TBD | |

### Tuesday — Lower
| # | Exercise | Sets × reps | Rest | Start weight | Notes |
|---|---|---|---|---|---|
| 1 | Back squat | 3–4 × 5–8 | 3 min | 365 | |
| 2a | Calf press | 4 × 8–12 | — | 360 | Full stretch, pause at bottom |
| 2b | Machine hip adductor | 3 × 10–15 | 90 s | 190 | 4th calf set alone after last round |
| 3a | Lying hamstring curl | 3 × 8–12 | — | 160 | |
| 3b | Leg extension | 3 × 8–12 | 90 s | 190 | |
| 4a | Cable pull-through | 3 × 10–15 | — | 105 | |
| 4b | Weighted cable crunch | 3 × 10–15 | 90 s | 110 | |

### Wednesday — Push
| # | Exercise | Sets × reps | Rest | Start weight | Notes |
|---|---|---|---|---|---|
| 1 | Barbell bench press | 3–4 × 8–12 | 2–3 min | 285 | Rehab rule; substitute: machine chest press |
| 2a | DB shoulder press | 3 × 8–12 | — | 55 | Do first each round |
| 2b | Skullcrusher | 3 × 8–12 | 2 min | 100 | |
| 3a | DB incline fly | 3 × 10–15 | — | 30 | Stop at chest level |
| 3b | DB lateral raise | 4 × 12–20 | 90 s | 30 | |
| 4a | Dip | 3 × 8–16 | — | Bodyweight | Substitute: close-grip bench or weighted pushup |
| 4b | Vertical leg raise | 3 × 8–16 | 90 s | 20 | |

### Thursday — Pull
| # | Exercise | Sets × reps | Rest | Start weight | Notes |
|---|---|---|---|---|---|
| 1 | Row compound (rotates: cable row / lat pulldown / bent-over BB row) | 3–4 × 5–8 | 2–3 min | 190 | Rotate at each deload |
| 2 | Preacher curl | 3–4 × 8–14 | 90 s | 90 | Alternate wide/narrow grip weekly; drop-set mode. Last: 8×90, 12×80, 12×80, 14×70 |
| 3a | Lat pulldown (cable row when pulldown is the compound) | 3 × 10–12 | — | 165 | Do first each round |
| 3b | Hammer curl / cross-body hammer curl | 3 × 8–12 | 2 min | 30 | |
| 4a | Barbell shrug | 3 × 8–12 | — | 225 | |
| 4b | Cable face pull | 3 × 12–15 | 90 s | 80 | |
| 5 | Ab crunch machine | 3 × 10–20 | 60–90 s | TBD | No superset |

### Friday — Legs
| # | Exercise | Sets × reps | Rest | Start weight | Notes |
|---|---|---|---|---|---|
| 1 | Deadlift | 3–4 × 5–8 | 3 min | 385 | |
| 2 | Barbell hip thrust (Smith bar + bench) | 3 × 8–12 | 2 min | 275 | |
| 3 | Leg press | 3–4 × 8–12 | 2 min | 410 | |
| 4a | Standing calf raise | 4 × 10–15 | — | 360 | Full stretch, pause at bottom |
| 4b | Machine hip abductor | 3 × 10–15 | 90 s | 190 | |
| 5a | Glute ham raise | 3 × 8–16 | — | 20 | |
| 5b | Leg raise | 3 × 15–30 | 90 s | Bodyweight | Ankle weights once 30 is easy |

Saturday: yoga/breathwork (optional log). Sunday: rest.

For ranges like 3–4 sets, default to 3 and let the user add a 4th.

### Race-block toggle (settings)
When on, swap Monday's iso row compound slot to include deadlifts and Friday's deadlift to RDL (3–4 × 8–12), and hide glute ham raises.

## 5. Data model (suggested)

- `exercises`: id, name, type (barbell/dumbbell/machine/cable/bodyweight), increment, substitute, notes
- `planDays`: day, ordered list of { exerciseId, group (e.g. "3a"), sets, repMin, repMax, restSec, rules }
- `sessions`: id, date, day, isDeload, sets: [{ exerciseId, setIndex, weight, reps, rir?, pain? }]
- `state`: per exercise → currentTargetWeight, consecutiveMisses, stallCount, lastIncreaseDate
- `bodyweight`: date, weight
- `nutrition` (future): date, calories, protein, carbs, fat, notes
- Schema version number for migrations.

## 6. Nice to have (after MVP)
- Plate calculator for barbell lifts (45 lb bar).
- Weekly volume per muscle group (sets per week) vs target ranges.
- Warm-up set suggestions for the first compound (e.g. 40/60/80% ramp).
- Cardio log after lifts (type, minutes), with a reminder that sprints/runs go after Mon/Wed/Thu only.
- Haptic feedback on set completion.
