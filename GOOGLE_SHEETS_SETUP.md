# Google Sheets DCF — one-time setup (~10 minutes)

The "Export DCF to Google Sheets" feature builds a real, live-formula Google
Sheet for each stock. It stays **dormant** until you complete this setup. The
in-app DCF works without it.

We use a **service account** (a robot Google identity) — simpler than OAuth for
a personal tool because there's no consent screen or token refresh.

## Steps

1. **Create a Google Cloud project**
   - Go to <https://console.cloud.google.com/projectcreate>
   - Name it anything (e.g. `investingfun`), click **Create**.

2. **Enable the APIs**
   - Visit <https://console.cloud.google.com/apis/library/sheets.googleapis.com> → **Enable**
   - Visit <https://console.cloud.google.com/apis/library/drive.googleapis.com> → **Enable**

3. **Create a service account**
   - Go to <https://console.cloud.google.com/iam-admin/serviceaccounts>
   - **Create service account** → give it a name → **Done** (no roles needed).

4. **Create a key**
   - Click the service account → **Keys** tab → **Add key → Create new key → JSON**.
   - A `.json` file downloads. **Keep it secret** — it's a credential.

5. **Wire it into the app**
   - Move the JSON file somewhere safe (NOT inside the repo). For example:
     `~/.config/investingfun/google-service-account.json`
   - Add to your `.env.local`:
     ```
     GOOGLE_SERVICE_ACCOUNT_FILE=/Users/you/.config/investingfun/google-service-account.json
     GOOGLE_SHARE_WITH_EMAIL=mitchellfgibson@berkeley.edu
     ```
     (`GOOGLE_SHARE_WITH_EMAIL` auto-shares each created sheet to your account so
     it appears in your Google Drive. Optional but recommended.)
   - Alternatively, paste the whole JSON as a single line into
     `GOOGLE_SERVICE_ACCOUNT_JSON=...` instead of using a file.

6. **(Optional) Put sheets in a specific Drive folder**
   - Create/locate a Drive folder, copy its ID from the URL, and set
     `GOOGLE_DRIVE_FOLDER_ID=...`
   - **Important:** share that folder with the service account's email
     (the `client_email` in the JSON, looks like `name@project.iam.gserviceaccount.com`)
     as **Editor**, or the robot can't write into it.

7. **Restart the dev server.** The "Export to Google Sheets" button will now work.

## Notes
- Service-account-created files count against the service account's Drive
  storage, which is why we share them to your email. If you set a folder you own
  + share it to the service account, the files live in *your* Drive instead.
- The Sheets/Drive API free quota is generous (hundreds of calls/min) and free.
- Never commit the JSON key or `.env.local`. Both are gitignored.
