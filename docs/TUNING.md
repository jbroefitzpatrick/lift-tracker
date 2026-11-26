# Tuning records: what is pooled, why, and how to read it

A running research note, alongside `docs/ESTIMATES.md`, which covers the one-rep max.

Finished workouts leave small, pre-aggregated records on the phone (`js/tuning.js`, `db.tuneQueue`).
When the person is signed in and hasn't turned off Settings → Help improve the app's estimates, they
are sent to the server (`POST /v2/tune`, `cloud/tune.js`, table `tune`). Each record is numbers plus
exercise ids and a few labels. Records never include names, notes, photos, pain or health data. The
person is a one-way hash of the account id, kept so the records can be deleted. Turning the switch off
deletes them (along with tested-max checks), and so does deleting the account. Read them with
`POST /v2/tune/summary`, which returns aggregates only, for groups of at least 5.

| Kind | Recorded when | Fields | Tunes |
|---|---|---|---|
| `start` | A lift is logged for the first time (and had no fixed start) | guess, used, reps, rir, pattern, type, exp, sex, ageBand | The starting-weight ratio table in `js/start-weights.js` (BY_PATTERN, BY_ID) and the experience levels |
| `prog` | The app raised a lift's target over last time | inc, pct, hit (all working sets at the new weight reached the bottom of the range), repMin, repMax, sets, type, exp | Increment sizes by equipment, and when to add weight (`js/engine.js` progressions) |
| `session` | Any planned (not freestyle) workout, with a plausible clock (5–240 min) | planMin (from `estimateMinutes`), actualMin, planSets, doneSets, exercises, deload, exp | Minutes per set and rest assumptions in `js/builder.js`, and how much fits in a session |
| `rir` | Sets with logged RIR, within 8 weeks of a tested max | logged, implied (reps possible at that load from the tested max, by Epley, minus reps done), reps, load % | How much to trust logged RIR in `js/estimate.js` (`rirMax`, weighting by load) |
| `skip` | A planned workout with skipped or swapped exercises | planned, skipped ids, swapped pairs | Default exercise choices: what people won't do |
| `trend` | At most every 4 weeks, per main lift (squat, bench, deadlift, overhead press) | change % in estimated max over 28 days, weekly hard sets for the lift's main muscle, deload in window, exp, sex | Deload frequency, and weekly set targets by experience |

## Rationale and evidence

- **Starting weights** are built from Strength Level standards and rough ratios (see the header of
  `js/start-weights.js`). The ratios for lifts without published standards are the weakest part. The
  first logged set is the best available check: people adjust it on the spot.
- **Progression.** Double progression and small increments are standard for intermediates (ACSM 2009
  position stand on progression models). How often an increase succeeds, by equipment and increment,
  tells us whether the steps are too big. Dumbbell and machine jumps are often proportionally large.
- **Session length.** Plans are fitted to the time people say they have. If real sessions run long,
  plans get cut short or skipped.
- **RIR.** Lifters judge RIR to within about a rep on sets under ~12 reps near failure, and
  underestimate it more at lighter loads (Zourdos 2016; Refalo 2023; see docs/ESTIMATES.md). Comparing
  logged RIR against a recent tested max, not the estimate, avoids circular checking.
- **Deloads and volume** are confounded by everything else people do, so they are the least certain
  metrics. Read them only with large numbers, and compare like with like (same lift, experience and
  deload flag). Weekly set targets currently follow published dose-response findings (Schoenfeld et
  al. 2017; Pelland et al. 2024).

## Reading the summary

- `start`: `medianRatio` = used ÷ guess. Below 1 means guesses run heavy for that equipment and pattern.
- `prog`: `hitRate` (%) by equipment and increment size, and by rep range.
- `session`: `medianRatio` = actual ÷ planned minutes, by planned length; also the share of planned
  sets done.
- `rir`: `medianUnderestimate` = implied − logged reps in reserve, by load. Positive means people had
  more left than they logged.
- `skipped` / `swapped`: counts by exercise id and swap pair.
- `trend`: median 4-week change (%) with and without a deload, and by weekly set range and experience.

## Changing defaults from it

Same rule as estimates: evidence first. Note the change and the numbers behind it in a dated Log entry
below, and keep each change small enough to see its effect in the next round of records.

## Log

- **2026-11-26.** Collection started: the six kinds above, the server endpoint and the shared opt-out.
