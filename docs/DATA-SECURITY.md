# Data storage & security

How Lift Tracker stores data today, what protects it, and what's left to do.

## Where data lives

Everything stays on the device. There is no server, account or analytics.

| Layer | What | Why |
|---|---|---|
| **IndexedDB** (`lift` → `kv`) | The whole record (workouts, plan, food log, settings) as one JSON document | Main store. Larger quota than localStorage, and the right place for structured data. |
| **localStorage** (`lift.db`) | A mirror of the same document, written on every save | A second copy. On launch, whichever copy was saved most recently is used. |
| **IndexedDB** (`snapshots`) | A daily copy (last 7), a copy before every import, erase, plan change or workout deletion (last 5), and the untouched data before each app update changes the storage format (last 3) | Undo for mistakes, bad imports and bad updates. Settings → Data & security → Restore an automatic snapshot. |
| **Cloud backup** (optional) | End-to-end encrypted copies on a free Cloudflare Worker: latest plus one per day for 60 days | An off-phone copy without manual exports. Setup: [CLOUD-BACKUP.md](CLOUD-BACKUP.md). |
| **IndexedDB** (`photos`) | Progress photos, resized to 1280 px JPEG | Kept out of the main record so saving stays fast. |
| **Cache Storage** | App files, plus exercise photos once viewed | Offline use. |

Saves write the localStorage mirror right away and IndexedDB shortly after (batched). Pending writes are flushed when the app is hidden or closed.

## Protection against bugs

During the beta, the likeliest way to lose data is a bug in an update. `js/store.js` guards against that:

- **Snapshot before upgrades:** before stored data is converted to a new schema version, the untouched copy is saved as a snapshot ("Before update (data v5 → v6)").
- **No silent fresh start:** if stored data can't be read or upgraded, or was written by a newer version, the app shows a recovery screen instead of starting empty. It saves nothing. The screen offers "Download my data", snapshot restore and "Reopen app".
- **Save guard:** a save is refused if the record is incomplete, or if workouts, cardio, food entries, body weight or exercises would drop by more than half (from at least 5). A banner explains, and the stored copy stays intact. Deliberate replacements (import, snapshot restore, erase) are allowed explicitly.
- **The same guard on uploads:** cloud backup won't upload a copy that has lost most of its history compared with the last upload.
- **Backups that are known to work:** "Check a backup file" opens a backup (decrypting it if needed), runs the import checks and shows what's inside, without changing anything.
- **Backups that actually happen:**
  - The finished-workout screen offers a one-tap backup when the last one is over a day old.
  - The passphrase can be remembered on the device so the backup really is one tap. It's stored outside the data record, so it never ends up inside a backup.
  - Cancelling the share sheet doesn't count as a backup.

## How iOS treats this data

- Safari can wipe data written by scripts for sites that haven't been visited in 7 days. A web app **added to the Home Screen** keeps its own count of days of use, separate from Safari ([WebKit storage policy](https://webkit.org/?p=14403)). That's why the README says to install it.
- The app calls `navigator.storage.persist()` once. WebKit decides by heuristics, and Home Screen apps are favoured. Reports of `persist()` on iOS are mixed, so the app doesn't rely on it.
- Because neither of those is a guarantee, **backups are the real safety net**:
  - **Weekly reminder:** after 7 days without a backup, Today shows a banner (it can be snoozed for 3 days).
  - **Encrypted backup:** passphrase-protected, saved to Files through the share sheet.
  - **Plain backup and CSV:** a readable JSON backup, plus a CSV export for spreadsheets.

## Encryption

Encrypted backups (`*.enc.json`) use only the browser's built-in Web Crypto API:

- **Key derivation:** PBKDF2-HMAC-SHA256, 600,000 iterations (the current [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) figure for PBKDF2-SHA256), with a random 16-byte salt per file.
- **Cipher:** AES-256-GCM with a random 12-byte IV per file. GCM is authenticated, so a wrong passphrase or a tampered file fails to open; it doesn't produce garbage.
- The passphrase is never stored. If it's lost, the backup can't be recovered.

Data at rest inside the browser isn't separately encrypted. It relies on the phone's own encryption (iOS Data Protection while the phone is locked) and on the browser keeping each site's storage separate from other sites.

## Hardening in the app

- **Content-Security-Policy** (`index.html`): scripts only from the app's own origin; no inline scripts and no `eval`; images limited to the app, blob/data URLs and the exercise-photo host; network requests limited to the app, the exercise-photo host and `*.workers.dev` (cloud backup); `object-src 'none'`; `form-action 'none'`; `base-uri 'self'`.
- **No third-party scripts or trackers.** No libraries are loaded from CDNs.
- **Referrer policy `no-referrer`**, so loading exercise photos doesn't tell GitHub which page asked for them.
- **All user text is HTML-escaped** before rendering (exercise names, notes, food names, imported backups).
- **Import checks:**
  - Rejects anything over 60 MB, anything that isn't an object, and backups missing the required fields or with damaged arrays.
  - Rejects backups from a newer schema version.
  - Takes a snapshot before replacing anything.
- **Schema versioning:** every upgrade is a numbered migration (`js/store.js`). Old backups import into the current version.

## Known limits (web app)

- **No live sync between devices**, and no account. Cloud backup (optional) handles moving to a new phone and recovery; it isn't two-way sync.
- **Possible clearing:** iOS may still clear storage under heavy storage pressure. Backups mitigate this.
- **Exercise photos load from GitHub** the first time each one is viewed (then they're cached). Text data is bundled.
- **CSP comes from a `<meta>` tag** because GitHub Pages can't set response headers. That means `frame-ancestors`, which blocks the app being shown inside another site, isn't enforced. Hosting on Netlify or Cloudflare Pages would allow real headers.

## Next steps (native app)

See [NATIVE-APP.md](NATIVE-APP.md). The native version would add:
- **iCloud sync (CloudKit):** sync through the user's own private iCloud database, so there's no server to run.
- **Encryption with Data Protection:** an on-device database (SQLite or SwiftData) that iOS encrypts while the phone is locked.
- **Sign in with Apple**, only if shared or social features are ever added.
- **Keychain** for any secrets.
