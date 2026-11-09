# Cloud backup setup

Automatic, end-to-end encrypted backups for you and a few testers, on Cloudflare's free plan. About 15 minutes, once.

## How it works

- **Server:** a tiny server (a Cloudflare Worker, [`cloud/worker.js`](../cloud/worker.js)) stores backups in Workers KV, Cloudflare's key-value storage.
- **Encryption:** the app encrypts each backup on the phone before uploading (AES-256-GCM), using that person's **recovery code** as the key. The server only ever holds unreadable data, and it never sees the code.
- **When it backs up:** after every workout, when the app opens (if the last backup is over 12 hours old), and when you leave the app (if something changed and the last backup is over 2 hours old).
- **What's kept:** the latest backup, plus one per day for 60 days. A bad day can be rolled back.
- **Guard:** the app won't upload a copy that has lost most of its history compared with the last upload.
- **Access key:** every request needs this shared key, so strangers can't use your server.

**Cost: $0.** The free Workers plan has no overage charges. Past a limit, requests fail for the rest of the day; nothing is billed. Each upload uses 2 of the 1,000 daily free storage writes, so three people backing up several times a day stay under 5% of the limit. No credit card is needed.

## 1. Create a Cloudflare account

Sign up at https://dash.cloudflare.com/sign-up (email and password only). You don't need to add a website or domain.

## 2. Log in from this computer

From the project folder in a terminal (VS Code's terminal works):

```sh
cd cloud
npx wrangler login
```

`npx` downloads Cloudflare's command-line tool (`wrangler`) the first time. A browser window opens; click **Allow**.

## 3. Create the storage

```sh
npx wrangler kv namespace create BACKUPS
```

The command prints a block containing `id = "…"`. Copy that id into [`cloud/wrangler.toml`](../cloud/wrangler.toml), replacing `PASTE_KV_NAMESPACE_ID_HERE`.

## 4. Create the access key

Generate a random key:

```sh
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

Save it to Cloudflare as a secret; paste the key when prompted:

```sh
npx wrangler secret put ACCESS_KEY
```

Keep a copy of the key in your password manager. Testers will need it.

## 5. Deploy

```sh
npx wrangler deploy
```

The first time, you may be asked to pick a `workers.dev` subdomain; any name is fine. At the end it prints the server address, something like:

```
https://lift-backup.YOUR-NAME.workers.dev
```

Quick check. Swap in your address and key; the 64 a's are a dummy id:

```sh
curl -H "X-Access-Key: YOUR_KEY" https://lift-backup.YOUR-NAME.workers.dev/v1/backups/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
```

It should print `{"versions":[]}`. With a wrong key you get `{"error":"Wrong access key."}`.

**Optional:** put the address in `DEFAULT_URL` in [`js/cloud.js`](../js/cloud.js) and push. Testers then only need the access key. (Or send me the address and I'll do it.)

## 6. Turn it on in the app

1. On your phone, open the app (from the Home Screen), then **Settings → Data & security → Cloud backup**.
2. Paste the server address and the access key, then tap **Turn on**.
3. **Save the recovery code** it shows: password manager, Notes, or a screenshot. Without it, the cloud copies can't be opened by anyone.
4. The first backup runs right away. The card shows when the last backup happened.

## 7. Add testers

In the app: **Cloud backup → Share with a tester**.

- **Hasn't installed the app yet:** send the setup link. They open it in Safari, then **Share → Add to Home Screen**. In the installed app, they go to Settings → Data & security → Cloud backup and tap **Turn on**.
- **Already installed it:** links open in Safari, which keeps separate data from Home Screen apps. Send the address and access key instead (the sheet has copy buttons); they paste them in Settings.

Each tester gets their own recovery code and their own private backups. Nobody can see anyone else's data, including you.

## Restoring

New phone, wiped data, or a bad update:

1. Install the app and open **Settings → Data & security → Cloud backup → Restore from cloud**.
2. Enter the address and key (if asked) and the recovery code.
3. Choose **Latest** or an earlier day, then confirm. The current data is snapshotted first, so a restore can be undone.

## Maintenance

| Task | How |
|---|---|
| Change the access key | `npx wrangler secret put ACCESS_KEY` again, then update it in each phone's Settings |
| See usage | Cloudflare dashboard → Workers & Pages → lift-backup → Metrics, or Storage & Databases → KV |
| Update the server code | Edit `cloud/worker.js`, then `npx wrangler deploy` from the `cloud` folder |
| Delete someone's backups | Dashboard → KV → BACKUPS: keys start with their 64-character id. They expire on their own after 60 days, except "latest" |

## Limits and trade-offs

- **The recovery code is the only key.** That keeps the server blind, but a lost code means lost cloud copies. File backups still work alongside cloud backup.
- **Progress photos aren't uploaded,** to keep backups small. Use a file backup with "Include progress photos" for those.
- **Anyone with the access key can use the free quota.** The worst case is that backups stop for the rest of the day; no data is exposed, because everything stored is encrypted. Change the key if it leaks.
- **This is for the beta.** The native iPhone app plan ([NATIVE-APP.md](NATIVE-APP.md)) replaces it with iCloud sync, which needs no server at all.
