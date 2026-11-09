# Path to a paid iPhone app (tabled)

Notes for turning Lift Tracker into an App Store app with a one-time price of about $5. Nothing here is built yet.

## Can your older Mac do it?

Since **April 28, 2026**, App Store uploads must be built with **Xcode 26** and the iOS 26 SDK ([Apple: SDK minimum requirements](https://developer.apple.com/news/upcoming-requirements/?id=04282026a)).

- Xcode 26.0–26.3 needs **macOS Sequoia 15.6 or later**. Later 26.x versions reportedly need macOS Tahoe 26.2.
- Sequoia runs on roughly: MacBook Pro 2018+, MacBook Air 2020+, Mac mini 2018+, iMac 2019+, iMac Pro, Mac Pro 2019+, Mac Studio. **Check your model** under Apple menu → About This Mac.
- **If it's too old:** you can still write and test the app's code anywhere, then build and upload from a cloud Mac. Options:
  - A cloud build service, such as Xcode Cloud (which still needs Xcode to set up), GitHub Actions macOS runners, Codemagic, or Ionic Appflow for Capacitor apps.
  - A rented Mac (MacinCloud and similar).

## Two ways to build it

| | **A. Wrap this web app (Capacitor)** | **B. Rewrite in SwiftUI** |
|---|---|---|
| Effort | Low: reuse all of `js/`, `styles.css`, `index.html` | High: rewrite the UI and logic in Swift |
| Look and feel | Same as today; good, but not fully native | Fully native, best for Watch and widgets |
| Apple Health, Watch, widgets | Through plugins (HealthKit plugins exist); a Watch app still needs Swift | First-class |
| Offline storage | Keep IndexedDB, or move to SQLite through a plugin | SwiftData / Core Data |
| iCloud sync | Plugin or a small Swift bridge to CloudKit | Built into SwiftData + CloudKit |

**Recommendation:** start with **A** to ship quickly, because the logic modules (`engine`, `builder`, `nutrition`, `year`, `cardio`, `fatigue`) are plain JavaScript with no browser-only dependencies. Add small Swift pieces (HealthKit, CloudKit) as needed. Move to **B** only if Watch or widgets become core.

## Accounts and sync

- **iCloud through CloudKit's private database** gives each user sync across their devices with **no server for you to run or pay for**. Apple bills storage against the user's own iCloud quota. That fits a one-time purchase, because there are no ongoing per-user costs.
- **No sign-in screen is needed for iCloud sync.** Apple handles identity. Add **Sign in with Apple** only if social or coach features come later.
- **A custom backend (Supabase, Firebase, etc.)** would mean recurring costs per user, which a one-time $5 price doesn't cover. Avoid it unless you move to a subscription.

## Syncing with other apps

- **HealthKit:** write workouts (strength and cardio, with duration and estimated energy), body mass, body-fat %, and dietary energy and macros. Read weight and workouts from other apps and watches. This is the main way apps share data on iPhone.
- **Exports:** keep the CSV and JSON exports; consider the Strong/Hevy CSV formats for importing history from those apps.

## Money

- **Apple Developer Program:** $99/year.
- **App Store commission:** 15% under the [Small Business Program](https://developer.apple.com/app-store/small-business-program/) (under $1M/year).
- **At $4.99 with 15% commission:** about $4.24 per sale before tax, so roughly **24 sales a year** cover the developer fee. Price tiers and taxes vary by country.
- A one-time price works if the app has **no server costs**, which is one more reason to use CloudKit.

## Before submitting

- **Exercise images:** free-exercise-db is under The Unlicense (public domain), but the project doesn't document where the original photos came from. For a paid app, either check their origin or replace them with commissioned or self-made illustrations. The text cues in `js/exercise-info.js` were written for this app.
- **Food data:** USDA FoodData Central is public domain. Keep the attribution anyway.
- **Health disclaimers:** keep "not medical advice" wording, and follow App Store guideline 1.4.1 for any health claims.
- **Privacy:** if nothing leaves the device or iCloud, the App Store privacy label can say "Data Not Collected".
