// Personal records and check-in based plan adjustments.
import { e1rm } from './engine.js';
import { weightOn } from './energy.js';

const goodSets = (sets) => sets.filter((s) => !s.pain && s.reps > 0 && (s.done ?? true));

// For bodyweight lifts the load is body weight plus added weight, so a weighted pullup's 1RM is real.
const loaded = (db, exId, sets, date) => (db.exercises[exId]?.type === 'bodyweight' ? sets.map((x) => ({ ...x, added: x.weight || 0, weight: weightOn(db, date) + (x.weight || 0) })) : sets);

function history(db, exId, beforeTs = Infinity) {
  const out = [];
  for (const s of db.sessions) {
    if ((s.finishedAt || 0) >= beforeTs) continue;
    for (const e of s.entries) if (e.exerciseId === exId) out.push({ s, sets: loaded(db, exId, goodSets(e.sets), s.date) });
  }
  return out.filter((h) => h.sets.length);
}

const volumeOf = (sets) => sets.reduce((a, x) => a + (x.weight || 0) * (x.reps || 0), 0);

// All-time bests for one exercise.
export function bestRecords(db, exId) {
  const h = history(db, exId);
  if (!h.length) return null;
  let e1 = { v: 0 }; let heavy = { v: 0 }; let reps = { v: 0 }; let vol = { v: 0 };
  for (const { s, sets } of h) {
    for (const x of sets) {
      const est = e1rm(x.weight, x.reps);
      if (est > e1.v) e1 = { v: est, w: x.weight, r: x.reps, date: s.date };
      if (x.weight > heavy.v) heavy = { v: x.weight, r: x.reps, date: s.date };
      if (x.reps > reps.v) reps = { v: x.reps, w: x.weight, date: s.date };
    }
    const v = volumeOf(sets);
    if (v > vol.v) vol = { v, date: s.date };
  }
  return { e1, heavy, reps, vol };
}

// PRs set by an entry compared with everything logged before it.
export function detectPRs(db, entry, beforeTs) {
  const bw = db.exercises[entry.exerciseId]?.type === 'bodyweight';
  const sets = loaded(db, entry.exerciseId, goodSets(entry.sets), new Date(beforeTs).toISOString().slice(0, 10));
  if (!sets.length || entry.pain) return [];
  const prior = history(db, entry.exerciseId, beforeTs);
  if (!prior.length) return [];
  const prev = prior.flatMap((p) => p.sets);
  const prs = [];
  const allBW = bw && sets.every((x) => !x.added) && prev.every((x) => !x.added);
  if (allBW) {
    const best = Math.max(...sets.map((x) => x.reps));
    const prevBest = Math.max(...prev.map((x) => x.reps));
    if (best > prevBest) prs.push({ type: 'reps', text: `${best} reps — most ever (was ${prevBest})` });
    return prs;
  }
  const bestNow = sets.reduce((a, x) => (e1rm(x.weight, x.reps) > e1rm(a.weight, a.reps) ? x : a));
  const prevE1 = Math.max(...prev.map((x) => e1rm(x.weight, x.reps)));
  if (e1rm(bestNow.weight, bestNow.reps) > prevE1 + 0.5) {
    prs.push({ type: 'e1rm', text: `Est. 1RM ${Math.round(e1rm(bestNow.weight, bestNow.reps))} lb${bw ? ' incl. body weight' : ''} (${bw ? `+${bestNow.added}` : bestNow.weight}×${bestNow.reps}), up from ${Math.round(prevE1)}` });
  }
  // Rep PR: more reps than ever at this weight or heavier (report the heaviest one).
  const repPRs = sets.filter((x) => x.weight > 0 && x.reps > Math.max(0, ...prev.filter((p) => p.weight >= x.weight).map((p) => p.reps)))
    .sort((a, b) => b.weight - a.weight);
  if (repPRs.length && !prs.length) {
    const x = repPRs[0];
    prs.push({ type: 'reps', text: `${x.reps} reps at ${x.weight} lb — most ever at that weight` });
  }
  const vNow = volumeOf(sets);
  const vPrev = Math.max(...prior.map((p) => volumeOf(p.sets)));
  if (vNow > vPrev && vPrev > 0) prs.push({ type: 'volume', text: `Session volume ${Math.round(vNow).toLocaleString()} lb (was ${Math.round(vPrev).toLocaleString()})` });
  return prs;
}

// ---------- Check-ins ----------
// After an exercise the lifter can say it felt easy, about right, or like too much, and flag joint pain.
// Two "easy" check-ins in a row add a set (up to 5, and within the weekly volume target if there is one);
// two "too much" in a row remove one (down to 2). Joint pain removes a set at once and suggests a swap.
// Deload sessions are ignored. This mirrors the feedback-driven volume adjustment popularised by
// RP-style programming, kept deliberately conservative.

export function applyCheckins(db, session, weeklyCap) {
  const out = [];
  if (session.isDeload) return out;
  for (const e of session.entries) {
    if (!e.feedback && !e.joint) continue;
    const st = db.state[e.exerciseId] || (db.state[e.exerciseId] = {});
    const fb = st.fb || { easy: 0, hard: 0 };
    const item = db.plan[session.day]?.items.find((i) => i.uid === e.uid && i.exerciseId === e.exerciseId);
    const name = e.name;
    if (e.joint) {
      fb.hard = 0; fb.easy = 0;
      if (item && item.sets > 2) { item.sets -= 1; out.push({ exerciseId: e.exerciseId, text: `${name}: −1 set after joint discomfort. If it keeps happening, swap it.` }); }
      else out.push({ exerciseId: e.exerciseId, text: `${name}: joint discomfort noted. Consider swapping it.` });
    } else if (e.feedback === 'easy') {
      fb.easy += 1; fb.hard = 0;
      if (fb.easy >= 2 && item) {
        const capped = weeklyCap && weeklyCap(e.exerciseId);
        if (item.sets < 5 && !capped) { item.sets += 1; out.push({ exerciseId: e.exerciseId, text: `${name}: +1 set — felt easy twice in a row.` }); }
        else out.push({ exerciseId: e.exerciseId, text: `${name}: felt easy twice — add weight or reps rather than sets (volume is at its target).` });
        fb.easy = 0;
      }
    } else if (e.feedback === 'hard') {
      fb.hard += 1; fb.easy = 0;
      if (fb.hard >= 2 && item) {
        if (item.sets > 2) { item.sets -= 1; out.push({ exerciseId: e.exerciseId, text: `${name}: −1 set — felt like too much twice in a row.` }); }
        fb.hard = 0;
      }
    } else { fb.easy = 0; fb.hard = 0; }
    st.fb = fb;
  }
  return out;
}
