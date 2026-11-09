# Interface design notes

The principles behind the interface, and the guidance they come from.

## Principles

1. **Cards stay simple.** An exercise card shows the name, today's target and the set rows. Everything else — type, muscles, form cues, last time, plates, warm-up, notes, swap, reordering — is one tap away in the details sheet (tap the exercise name). This is *progressive disclosure*: show what's needed for the task, reveal the rest on request ([Nielsen Norman Group](https://www.nngroup.com/articles/progressive-disclosure/)).
2. **Fewer, larger choices.** Four tabs (Train, Plan, Food, Progress). Settings sits behind a gear because it's used rarely. Fewer options make decisions faster (Hick's law), and bottom navigation works best with 3–5 destinations ([Material Design](https://m3.material.io/components/navigation-bar/guidelines)).
3. **Reachable controls.** Most phone use is one-thumbed ([Hoober, 2013](https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php)), so the frequent actions — checking off sets, the rest timer, tabs, Finish workout — are large and low on the screen. Rare actions (day options, settings) sit at the top.
4. **Big targets.** Every control is at least 44 × 44 pt ([Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/accessibility)); WCAG 2.2 sets 24 × 24 px as the minimum (2.5.8). Set check buttons are 48 px. Larger, closer targets are faster to hit (Fitts's law).
5. **One accent colour.** Blue marks what's tappable or selected (exercise names, primary buttons, the current day). Green only means done; amber and red only mean caution. Colour is never the only signal — text always says the same thing (WCAG 1.4.1).
6. **Readable contrast.** All text meets WCAG 2.2 AA (4.5:1) in both themes; the palette was checked numerically.
7. **Consistent language.** Sentence case for every title, button and label; plain words over jargon; no emoji or decorative symbols. Units are written the same way everywhere ("90 sec", "2 min", "105 lb").

## Patterns

- **Workout list → exercise screen.** Train shows each exercise as a row (photo, name, sets · reps · weight). Tapping opens the exercise screen to log sets inline (reps and weight fields, check to complete), with How-to, History, Replace, Rest and Link controls and a Next button that walks through the workout.
- **Linking.** Supersets (2) and circuits (3+) are made by selecting exercises in Edit mode and tapping Link, or with “Link with next” on an exercise. Unlink works the same way. Before a workout starts, changes apply to that weekday's plan; during a workout, to today only.
- **Body map.** Muscle recovery is shown on a front/back body diagram (fatigue in one warm hue, with a scale), followed by only the muscles still recovering. Every coloured state is repeated in text.
- **Blocks.** Each training block (the weeks up to a deload) has focus lifts. Plan shows block progress; the deload week brings a check-in to review the block and choose the next focus.

## Accessibility

- **Text size:** type is set in rem from the iOS body text style, so the app follows Settings → Display & Brightness → Text Size.
- **Screen readers:** buttons have descriptive labels; set rows announce weight and reps; tabs, segmented controls and toggles expose their state (`aria-selected`, `aria-pressed`, `aria-expanded`); moving an exercise is announced.
- **Dragging is optional:** reorder by dragging the handle, with the arrow keys on a focused handle, or with Move up / Move down in the details sheet (WCAG 2.2, 2.5.7 Dragging Movements).
- **Sheets:** focus moves to the sheet title (not a text field, so the keyboard doesn't open uninvited), Escape or a tap outside closes it, and focus returns to where it was.
- **Motion:** animations are switched off when Reduce Motion is on.
- **Focus:** a visible focus ring for keyboard and switch users.
