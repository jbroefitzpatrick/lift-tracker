# Roadmap: ideas for later

Not built yet. Roughly in order of how soon they make sense.

## Coach notes for each workout
A short note at the top of each day's workout ("Squat is your focus today. Last week 275×6, so aim for 7 reps or 280 lb. Legs were still sore on Tuesday, so the accessories are a set lighter.").
- **Rule-based version (no cost):** built from data the app already has (focus lift targets, last results, PRs within reach, recovery check-ins, pain, week adjustments, deload). Fully offline. Roughly a day of work.
- **AI-written version:** the same facts sent to an AI model through the existing Cloudflare Worker, so the API key stays off the phone. Reads more naturally and can answer follow-up questions. Costs a fraction of a cent per note, needs an API key and a usage limit, and only works online (the rule-based note is the fallback).

## Gamification and a gym rival
- Pick a **gym rival** (another tester) and compare progress side by side: workouts this month, streaks, percentage gains on focus lifts (percentages keep it fair between different body weights).
- Weekly challenges (most sets on a muscle group, longest streak), badges for milestones (first 300 lb squat, 100 workouts), and a shareable weekly report.
- Needs accounts and sharing between phones: either the Cloudflare Worker (sharing only the comparison numbers, never the full log) or iCloud in the native app.

## From Fitbod and other apps
- Hexagon set markers joined by a vertical line on the exercise screen.
- A floating, pill-shaped tab bar.
- Workout summary as a shareable image (muscle map, time, volume, PRs).
- A celebration animation when a PR is set or a ring closes.

## Native iPhone app
See [NATIVE-APP.md](NATIVE-APP.md): lock-screen rest timer (Live Activity), widgets, Apple Health, haptics, iCloud sync, barcode scanning for food.
