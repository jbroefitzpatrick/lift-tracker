# Data storage & security

How Lift Tracker stores data today, what protects it, and what's left to do.

## Where data lives

Everything stays on the device. There is no server, account or analytics.

| Layer | What | Why |
|---|---|---|
| **IndexedDB** (`lift` → `kv`) | The whole record (workouts, plan, food log, settings) as one JSON document | Main store. Larger quota than localStorage, and the right place for structured data. |
| **localStorage** (`lift.db`) | A mirror of the same document, written on every save | A second copy. On launch, whichever copy was saved most recently is used. |
| **IndexedDB** (`snapshots`) | A daily copy (last 7) plus a copy before every import, erase, plan change or workout deletion (last 5) | Undo for mistakes and bad imports. Settings → Data & security → Restore an automatic snapshot. |
| **IndexedDB** (`photos`) | Progress photos, resized to 1280 px JPEG | Kept out of the main record so saving stays fast. |
| **Cache Storage** | App files, plus exercise photos once viewed | Offline use. |

Saves write the localStorage mirror right away and IndexedDB shortly after (batched). Pending writes are flushed when the app is hidden or closed.

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

- **Content-Security-Policy** (`index.html`): scripts only from the app's own origin; no inline scripts and no `eval`; images limited to the app, blob/data URLs and the exercise-photo host; `object-src 'none'`; `form-action 'none'`; `base-uri 'self'`.
- **No third-party scripts or trackers.** No libraries are loaded from CDNs.
- **Referrer policy `no-referrer`**, so loading exercise photos doesn't tell GitHub which page asked for them.
- **All user text is HTML-escaped** before rendering (exercise names, notes, food names, imported backups).
- **Import checks:**
  - Rejects anything over 60 MB, anything that isn't an object, and backups missing the required fields or with damaged arrays.
  - Rejects backups from a newer schema version.
  - Takes a snapshot before replacing anything.
- **Schema versioning:** every upgrade is a numbered migration (`js/store.js`). Old backups import into the current version.

## Known limits (web app)

- **No sync between devices**, and no account.
- **Possible clearing:** iOS may still clear storage under heavy storage pressure. Backups mitigate this.
- **Exercise photos load from GitHub** the first time each one is viewed (then they're cached). Text data is bundled.
- **CSP comes from a `<meta>` tag** because GitHub Pages can't set response headers. That means `frame-ancestors`, which blocks the app being shown inside another site, isn't enforced. Hosting on Netlify or Cloudflare Pages would allow real headers.

## Next steps (native app)

See [NATIVE-APP.md](NATIVE-APP.md). The native version would add:
- **iCloud sync (CloudKit):** sync through the user's own private iCloud database, so there's no server to run.
- **Encryption with Data Protection:** an on-device database (SQLite or SwiftData) that iOS encrypts while the phone is locked.
- **Sign in with Apple**, only if shared or social features are ever added.
- **Keychain** for any secrets.
