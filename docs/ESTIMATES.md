# Estimated one-rep max: method, evidence and tuning

This is a running research note. It describes how the app estimates a one-rep max (1RM), why, and how
the estimate is being checked against real tests so it can be tuned. Code: `js/estimate.js`.

## Method (version 2, November 2026)

**One set.** Epley's formula, `1RM = weight × (1 + reps / 30)`, with two changes:

1. **Reps in reserve.** When a set has RIR logged, the formula uses reps + RIR (RIR capped at 5). A set
   of 8 with 2 left in the tank is treated like a set of 10 taken to failure.
2. **Easing off above 5 reps.** Each effective rep above 5 takes off 0.5%, so 10 reps reads 2.5% lower.
   A single with nothing left counts as its weight.

Only working sets of 10 reps or fewer count. Warm-ups and sets marked painful are left out.

**A lift's current max.** This is the best session, with two guards:

- **Standing alone.** If the best session is more than 3% above every other session, it is met halfway
  until another session backs it up. This stops one great day, a short rep or a typo from defining
  the max.
- **Tests reset it.** A tested max (a max-test workout, or a one-rep max logged by hand) resets the
  estimate to the weight lifted. The test also counts as a session that later sets must agree with.

**Personal correction.** Every test records what the estimate was just before. After 3 tests, the median
ratio of tested to predicted becomes a personal factor, clamped to ±10% and applied to estimates. Tested
values themselves are never adjusted.

**Lifted.** Separately, the app tracks the heaviest weight actually logged for each lift, at any reps.
The strength-total goal shows both. A club gets a gold ring once the lifted total reaches it.

Parameters (`P` in `js/estimate.js`): `damp 0.005`, `dampFrom 5`, `rirMax 5`, `maxReps 10`,
`alone 0.03`, `minChecks 3`, `clamp 0.1`. `METHOD` is bumped whenever the rules change, so checks made
under different rules can be told apart.

## Evidence

- **Epley tracks true maxes well across people, but the absolute error varies by lift.** LeSuer et al.
  (1997) tested seven equations on bench, squat and deadlift in 67 untrained students. Correlations
  were r > 0.95, and every equation underestimated the deadlift.
- **At failure, people do more reps at a given %1RM than Epley assumes.** This is why the formula eases
  off. Nuzzo et al. (2023, Sports Medicine) is a meta-regression of 962 tests from 92 studies (more
  than 7,000 people). Bench at 80% averaged 8.8 reps (Epley assumes 7.5), at 85% 6.2 (Epley 5.3), and at
  70% 14.1 (Epley 12.9). Leg press at 70% averaged 19 reps. Fed back into Epley, these read about 3% high
  for bench at failure, and more for leg press. Exercise was the only moderator that mattered; sex,
  age and training status did not. There was not enough squat or deadlift data for separate figures.
- **Individual variation is large.** For example, in Cooke et al., trained lifters squatting at 70% did
  14 ± 4 reps, ranging from 6 to 28. So no formula is better than about ±5–10% for one person. This is
  why tested maxes and personal correction matter more than choosing a formula.
- **Low reps estimate best.** Accuracy falls as reps rise. In one 2006 comparison a 5RM predicted best,
  and other work recommends 10 or fewer reps.
- **RIR is judged well near failure.** Within about a rep on sets under ~12 reps and within ~3 reps of
  failure (Zourdos et al. 2016, RIR-based RPE scale; Refalo et al. 2023, bench press). It is less
  accurate far from failure and at light loads, so RIR is capped at 5.
- **Why keep Epley.** Brzycki and Lombardi read lower than Epley at some rep counts and about the same
  at others. None was clearly better across lifts in the studies above. The gains come from how sets
  are chosen and from checking against tests.
- **Not used yet:** a 2026 preprint (Marzagao, arXiv 2603.17495) fits a load-dependent formula to
  ~300,000 app sets. It is not peer reviewed and has no measured maxes, so it is a lead, not a basis.

Sources:

- LeSuer DA et al. 1997, J Strength Cond Res.
  [ResearchGate](https://www.researchgate.net/publication/243666838_Accuracy_of_Seven_Equations_for_Predicting_1RM_Performance_of_Apparently_Healthy_Sedentary_Older_Adults)
- Nuzzo JL et al. 2023, Sports Medicine (PubMed 37792272). Summary:
  [Stronger by Science](https://www.strongerbyscience.com/reps-percentage/)
- Shimano T et al. 2006, J Strength Cond Res 20(4):819–823.
  [PDF](https://paulogentil.com/pdf/Relationship%20Between%20the%20Number%20of%20Repetitions%20and%20Selected%20Percentages%20of%20One%20Repetition%20Maximum%20in%20Free%20Weight%20Exercises%20in%20Trained%20and%20Untrained%20Men.pdf)
- Refalo MC et al. 2023, accuracy of intraset RIR predictions on the bench press.
  [ResearchGate](https://www.researchgate.net/publication/375687905_Accuracy_of_Intraset_Repetitions-in-Reserve_Predictions_During_the_Bench_Press_Exercise_in_Resistance-Trained_Male_and_Female_Subjects)
- Estimating RIR: factors affecting prediction accuracy.
  [ResearchGate](https://www.researchgate.net/publication/342346997_Estimating_Repetitions_In_Reserve_For_Resistance_Exercise_An_Analysis_Of_Factors_Which_Impact_On_Prediction_Accuracy)
- Marzagao T 2026, preprint. [arXiv 2603.17495](https://arxiv.org/abs/2603.17495)

## Tracking accuracy

`db.calib` keeps `{ id, date, exId, pred, actual, method, srcReps, srcRir, gapDays }` for each tested max,
up to 200. The goal details sheet ("How these are worked out") shows the average miss and any personal
correction.

**Pooled checks.** When signed in, and unless Settings → Help improve max estimates is off, the app
sends each check to the server (`POST /v2/calib`, `cloud/calib.js`, table `calib`). The record has no
name: the person is a one-way hash of the account id, kept so the records can be removed. Optional sex
and age by decade are included for later subgroup analysis. Turning the setting off calls
`/v2/calib/forget`, which deletes that person's records, and deleting the account removes them too. The
privacy policy section "Improving max estimates" covers this. `POST /v2/calib/summary` returns
aggregates only: bias and mean absolute error by method and by the reps the estimate came from, and
only for groups with at least 5 checks.

Each check is one person, one lift and one day, so single checks are noisy. What to look at:

- **Bias** (median of actual ÷ predicted − 1): whether estimates run high or low overall.
- **Error** (mean of |actual − predicted| ÷ actual): how far off a typical estimate is.
- Both by method version, by rep range of the set the estimate came from, and by lift.

## How to tune

1. **Per person (automatic).** The personal factor after 3 tests.
2. **For everyone (by hand).** Read `/v2/calib/summary` once enough people have tested. Then refit `damp` and `dampFrom`
   against tested maxes: minimize median absolute error, and keep bias near 0. Bump `METHOD` and note
   the change here.
3. **Next candidates to test:**
   - exercise-specific easing (leg press and machines likely need more, since people do more reps at a
     given % on them);
   - recency, for example favouring the last 8–12 weeks;
   - weighting low-rep sets above high-rep sets when they disagree.

## Log

- **2026-11-25.** Pooled checks: the server endpoint, the opt-out setting and the privacy policy section.
  A first local backtest against one long training history (heavy singles; no RIR in that data) agreed
  with the feeling that estimates run high: v2 overshot less than v1. Small sample, details kept out of
  the repo.

- **2026-11-25 · v2.** RIR added; 0.5% per rep easing above 5; the standing-alone guard; tests reset
  the estimate; calibration tracking and the personal factor. v1 was plain Epley on the single best
  set of 10 reps or fewer, ever.
