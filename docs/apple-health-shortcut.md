# "Su Gachu Health Sync" — Apple Watch → app, via an iOS Shortcut

Apple Health has **no server API**. A native app is the only way to read
HealthKit in the background, and we don't want to pay for the Apple Developer
Program. This Shortcut is the workaround: the user runs it on their iPhone, it
reads the Watch's data from the on-device Health database and `POST`s a small
JSON payload to our ingest endpoint.

- **Trigger**: the "Sincronizează Apple Watch" button on the dashboard opens
  `shortcuts://x-callback-url/run-shortcut?name=Su%20Gachu%20Health%20Sync&x-success=<pwa url>`.
- **Auth**: a per-user bearer token (issued on `/profile` → "Conectează Apple
  Watch"). Only its SHA-256 hash is stored server-side.
- **Runs only when the iPhone is unlocked** — fine, it's button-triggered from
  the phone in hand. Must run on the iPhone paired to the Watch (not iPad/Mac).

---

## Payload contract

`POST {INGEST_URL}` — `INGEST_URL` = `https://<host>/api/apple-health/ingest`

```
Authorization: Bearer {TOKEN}
Content-Type: application/json
```

```jsonc
{
  "device_name": "Apple Watch Series 9",   // optional
  "days": [
    {
      "date": "2026-09-07",                 // REQUIRED, local calendar day, YYYY-MM-DD
      "steps": 8421,
      "active_energy_kcal": 540,
      "exercise_minutes": 32,
      "resting_hr": 52,
      "avg_hr": 74, "min_hr": 46, "max_hr": 141,
      "hrv_sdnn_ms": 68,
      "vo2max": 46.2,
      "respiratory_rate": 14.2,
      "spo2_avg": 96.5,
      "weight_kg": 78.4,
      "sleep": {                            // previous night; omit if none
        "start": "2026-09-06T23:12:00+03:00",
        "end":   "2026-09-07T07:03:00+03:00",
        "in_bed_min": 471, "asleep_min": 431,
        "core_min": 247, "deep_min": 62, "rem_min": 92, "awake_min": 40
      }
    }
  ]
}
```

Everything except `date` is optional. Sync **1–3 days** each run (today +
yesterday) so a missed day backfills — the server upserts on `(user, date)`.
Response: `{ "ok": true, "days": 1, "message": "Synced 1 day(s)" }`.

Server-side validation ranges (values outside these are rejected with 400):
steps 0–200000, active kcal 0–20000, HR 20–260, HRV 0–500, VO₂max 0–100,
weight 20–400 kg, any sleep field 0–1440 min.

---

## Build steps (Shortcuts app)

Create a new Shortcut named exactly **`Su Gachu Health Sync`**.

### 1. Config (two Text actions the user edits)
1. **Text** → paste the ingest URL. *Rename the variable* `INGEST_URL`.
2. **Text** → paste the token. *Rename the variable* `TOKEN`.

### 2. Date windows
3. **Date** (Current Date) → variable `Now`.
4. For "today": **Format Date** `Now`, format `yyyy-MM-dd` → `TodayStr`.
5. Sleep window crosses midnight, so query wide and filter in the loop:
   - **Adjust Date**: `Now` − 1 day, then set time 18:00 → `SleepFrom`.
   - **Adjust Date**: `Now`, set time 12:00 → `SleepTo`.
6. Day window for the aggregates:
   - **Adjust Date**: `Now`, set time 00:00 → `DayStart`.
   - **Adjust Date**: `Now`, set time 23:59 → `DayEnd`.

### 3. Daily aggregates
For each metric below: **Find Health Samples** where *Start Date* is after
`DayStart` **and** *Start Date* is before `DayEnd`, then **Calculate Statistics**
over the result. Put your date variables **first** in each condition (Shortcuts
compares more reliably that way). If the result is empty, skip the field.

| Field | Sample type | Statistic |
|---|---|---|
| `steps` | Steps | Sum |
| `active_energy_kcal` | Active Energy | Sum |
| `exercise_minutes` | Apple Exercise Time | Sum |
| `resting_hr` | Resting Heart Rate | Average (usually 1 sample) |
| `avg_hr` | Heart Rate | Average |
| `min_hr` | Heart Rate | Minimum |
| `max_hr` | Heart Rate | Maximum |
| `hrv_sdnn_ms` | Heart Rate Variability | Average |
| `vo2max` | VO2 Max | Latest / Average |
| `respiratory_rate` | Respiratory Rate | Average |
| `spo2_avg` | Blood Oxygen Saturation | Average |
| `weight_kg` | Body Mass | Latest (Maximum works) |

### 4. Sleep stages
7. **Find Health Samples** → *Sleep Analysis*, *Start Date* after `SleepFrom`
   and before `SleepTo`. Sort by Start Date ascending. → `SleepSamples`.
8. Init number variables `core`, `deep`, `rem`, `awake`, `inbed` = 0;
   date variables `bedStart`, `bedEnd` = empty.
9. **Repeat with Each** `SleepSamples`:
   - **Get Time Between Dates** from *Start Date* to *End Date*, units **Minutes**
     → `mins`.
   - **If** the sample's *Value*/*Category* is:
     - `In Bed` → `inbed = inbed + mins`
     - `Awake` → `awake = awake + mins`
     - `Core` (or `Asleep` on pre-iOS-16) → `core = core + mins`
     - `Deep` → `deep = deep + mins`
     - `REM` → `rem = rem + mins`
   - Track `bedStart` = min(start), `bedEnd` = max(end).
   - `asleep_min` = `core + deep + rem`.
10. If `SleepSamples` was empty, omit the whole `sleep` object.

### 5. Assemble & send
11. **Dictionary** — build one entry per non-empty field, then a nested `sleep`
    dictionary, then wrap:
    ```
    { "device_name": <Device Details: Device Model>,
      "days": [ <the day dictionary> ] }
    ```
    (Add a second day dictionary for yesterday by repeating §2–4 with
    `Now − 1 day` if you want backfill.)
12. **Get Contents of URL**:
    - URL: `INGEST_URL`
    - Method: `POST`
    - Headers: `Authorization` = `Bearer {TOKEN}`, `Content-Type` = `application/json`
    - Request Body: **JSON** → the Dictionary from step 11.
13. *(optional, for debugging)* **Show Result** / **Quick Look** the response.

### 6. First run
Running it triggers the HealthKit permission sheet — **allow all** requested
types. Tick "Always Allow" if offered so future runs don't prompt.

### 7. Distribute
Share → **Copy iCloud Link**. Put that link in
`NEXT_PUBLIC_APPLE_HEALTH_SHORTCUT_URL`. The `/profile` connect card links to it
as "Adaugă shortcut-ul".

---

## Gotchas

- **Don't trust the Find Health Samples date filter alone** for sleep — a
  session that starts before your window but ends inside it can be missed;
  querying a wide window and filtering per-sample in the Repeat loop is safer.
- **Minutes, not Duration** — compute stage length with *Get Time Between Dates*
  (Minutes); the raw Duration field is inconsistent.
- **iPhone must be unlocked** while it runs. Button-triggered from the PWA, so
  this is automatic.
- **Same iPhone as the Watch** — Health data isn't on iPad/Mac in full.
- **"Core" ≈ light sleep** — Apple renamed light → core in iOS 16. The app
  treats `core_min` as the light-sleep equivalent.
- No per-workout data, no high-res HR series — those need a native app.

---

## `public/shortcuts/su-gachu-health-sync.shortcut`

A hand-authored plist implementing the above is committed as a best-effort
convenience. The binary/plist format is finicky; importing it may require
Settings → Shortcuts → **Allow Untrusted Shortcuts** (visible only after you've
run at least one shortcut) and possibly `plutil -convert binary1`. **This build
guide is the reliable path** — treat the file as a starting point, verify every
action, then re-share your own iCloud link.
