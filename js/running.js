// Endurance sessions in the week come from an event plan (js/event-plan.js). These two hooks are how
// the rest of the app sees them: the sessions for a day, and the days that have any.
import { todayStr } from './store.js';
import { eventItemsFor, eventDays } from './event-plan.js';

export const runDays = (db) => eventDays(db);
export const runItemsFor = (db, day, date = todayStr()) => eventItemsFor(db, day, date);
