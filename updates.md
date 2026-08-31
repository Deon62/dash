# Getting a new version onto a student's phone

Two mechanisms, and picking the wrong one for a given change is the usual
mistake. One of them is silent and instant; the other needs the store and a
person tapping Update.

| | OTA (EAS Update) | Store update |
| --- | --- | --- |
| Ships | JS, styles, images, most bug fixes | Anything native |
| Reaches the phone | Next launch, no app store | Only when the student updates |
| Student sees | Nothing | A modal you decide to show them |
| Needed for | ~90% of releases | New native module, permission, Expo SDK bump, icon, app.json native config |

Use OTA by default. The backend half of this document exists for the other 10% —
and for the case where a build already on ten thousand phones has to be switched
off.

---

## Part 1 — OTA, for everything that is only JavaScript

This is the "auto update" in the question, and it needs nothing from the backend.
`expo-updates` + EAS Update handles it.

```bash
npx expo install expo-updates
eas update:configure
```

In `app.json`:

```jsonc
{
  "expo": {
    "updates": {
      "url": "https://u.expo.dev/<your-project-id>",
      // ON_LOAD is the default and is what you want: check at launch, in the
      // background, without holding up the splash screen.
      "checkAutomatically": "ON_LOAD",
      // How long launch will wait for an update before giving up and starting
      // with what it has. Keep it small — on a Kenyan mobile connection this is
      // dead time the student stares at.
      "fallbackToCacheTimeout": 3000
    },
    // What makes an update *compatible* with an installed binary. Tie it to the
    // app version so a build with different native code can never be handed JS
    // that expects native modules it does not have — which crashes on launch,
    // on every device, with no way to roll back from the phone.
    "runtimeVersion": { "policy": "appVersion" }
  }
}
```

Publishing:

```bash
eas update --branch production --message "Fix quiz state loss"
```

Default behaviour is that the update downloads in the background and applies on
the **next** launch. That is usually right — swapping the bundle under someone
mid-sentence is worse than a one-launch delay. If a fix is urgent enough to
apply immediately, do it explicitly and tell them why:

```js
import * as Updates from "expo-updates";

async function applyUrgentUpdate() {
  if (__DEV__) return; // expo-updates is inert in development anyway.
  try {
    const { isAvailable } = await Updates.checkForUpdateAsync();
    if (!isAvailable) return;
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync(); // Restarts into the new bundle.
  } catch {
    // Offline, or the update server is unreachable. Silent by design: an update
    // check is not something a student asked for, and it must never be a thing
    // that interrupts them or shows an error.
  }
}
```

**The rule that matters:** `runtimeVersion` must change whenever native code
does. With `policy: "appVersion"`, bumping `version` in `app.json` does it for
you — which is exactly why that policy is the one set above. An OTA update
delivered to an incompatible binary is the one failure here that cannot be fixed
from the server.

---

## Part 2 — Store updates, and the modal

The backend answers one question on launch: *is this build out of date, and is it
too old to keep running?*

### `GET /api/v1/app/release`

Unauthenticated, deliberately. The build most likely to need forcing off the
network is one that is broken, and broken often means it cannot sign in. An
update check behind a token cannot reach the phones that need it most. Nothing in
the response is user-specific, so there is nothing to leak.

```
GET /api/v1/app/release?platform=android&version=1.3.2
```

```json
{
  "latest_version": "1.5.0",
  "update_available": true,
  "update_required": false,
  "store_url": "https://play.google.com/store/apps/details?id=…",
  "notes": "Quizzes no longer lose your place.",
  "minimum_version": "1.2.0"
}
```

Cached for five minutes (`Cache-Control: public, max-age=300`) — long enough that
a launch spike is not a query per launch, short enough that forcing an update
reaches everybody inside a coffee break.

An unknown platform is answered, not refused. A 4xx here would be a launch-path
error on every future platform this app is built for, in exchange for nothing.

### The two flags, and why they are not the same

- **`update_available`** — something newer is published. Show a dismissible card.
  The student carries on.
- **`update_required`** — this build must stop. Show a modal with no dismiss.

**`update_required` is never inferred from being behind.** It is true only when an
administrator has raised `minimum_version` past the build in hand. Forcing an
update interrupts somebody mid-revision, usually the night before a CAT, and that
has to be a decision a person made — not a side effect of shipping a release.

The comparison is numeric, never textual. `app/services/releases.py` parses every
run of digits into a tuple, because as a string `"1.10.0"` sorts *before*
`"1.9.0"` — the classic way a version gate ships broken and looks fine for nine
releases. A pre-release (`1.4.0-beta.2`) deliberately sorts *after* its release:
the beta is the later build, and telling that person to go back is a loop.

### Client sketch

```js
import { Platform } from "react-native";
import * as Application from "expo-application";

export async function checkForStoreUpdate() {
  const query = new URLSearchParams({
    platform: Platform.OS,
    version: Application.nativeApplicationVersion ?? "",
  });

  try {
    const response = await fetch(`${API_URL}/api/v1/app/release?${query}`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    // Offline. Never a visible error — the student did not ask for this.
    return null;
  }
}
```

Send `nativeApplicationVersion` (the store version), **not** the OTA update id.
The question is which binary they are running, and only a store install changes
that.

Then, at the top of the app:

- `update_required` → full-screen modal, no dismiss, one button opening
  `store_url` via `Linking.openURL`. Say *what* stopped working, using
  `minimum_version` — "builds before 1.4.0 can no longer sync" beats "please
  update".
- `update_available` → a dismissible card showing `notes`. Remember the dismissal
  against `latest_version` in `AsyncStorage`, so dismissing 1.5.0 does not also
  dismiss 1.6.0 when it lands.

Check on launch **and on foreground**. A phone that has been open for three days
never re-launches, and that is precisely the device still running the build you
are trying to switch off.

---

## Part 3 — Running it from the console

### Recording a release

```
POST /api/v1/admin/releases
{ "platform": "android", "version": "1.5.0", "notes": "Quizzes keep your place." }
```

Created **unpublished** by default. A release usually exists before it is
downloadable — the store is still reviewing, or rolling out to 10% — and offering
an update that cannot yet be installed sends students to a listing that does not
have it.

When it is actually live:

```
PATCH /api/v1/admin/releases/{id}   { "published": true }
```

Only the newest *published* row per platform is ever offered. Admin role, and
every write is audited.

### Before you force anything

```
GET /api/v1/admin/releases/adoption
```

```json
[
  { "platform": "android", "version": "1.4.0", "devices": 4210 },
  { "platform": "android", "version": "1.3.0", "devices": 866 },
  { "platform": "android", "version": "unreported", "devices": 31 }
]
```

This is the count of people a raised floor locks out until they update. It is the
difference between a forced update and an outage, and it is the number that has
to exist before the decision gets made on a feeling instead.

It counts **devices, not accounts** — one student with a phone and a tablet is two
rows, which is right: each has to be updated separately. `"unreported"` is a real
answer, not missing data: those are builds old enough to predate reporting the
field, and they will be treated as ancient by any floor you set.

The numbers come from `PUT /me/devices`, which the app already calls on every
launch. Nothing new had to be collected.

### Forcing an update

```
PATCH /api/v1/admin/releases/{id}   { "minimum_version": "1.4.0" }
```

Every client below 1.4.0 now gets `update_required: true` and cannot dismiss it.
The audit entry records the old value beside the new one — "changed the minimum"
answers nothing at 2am; "1.2.0 became 1.4.0" answers everything.

A minimum newer than the release it sits on is refused, because it would tell
everybody to update to a build that is itself below the floor, including the one
they are updating to.

### Configuration

```
IOS_STORE_URL=https://apps.apple.com/app/id…
ANDROID_STORE_URL=https://play.google.com/store/apps/details?id=…
```

Set once. A release row can override them, but the usual release is one field
nobody fills in.

---

## Which one do I use?

| Change | Mechanism |
| --- | --- |
| Bug fix, copy change, new screen, style, pricing card | OTA |
| New plan, changed limits, anything reading a new API field | OTA |
| Expo SDK upgrade, new native module, camera/notification permission | Store |
| App icon, splash, name, anything in `app.json` native config | Store |
| A build that is actively broken and must stop | Store + `minimum_version` |

---

## What this ships as

An empty `app_releases` table. `GET /app/release` answers "no update" to
everybody, no card, no modal — the correct default, and the failure mode worth
designing out is an update prompt that appears because a table is empty. Record
the first release once the build is actually in the stores.

Guarded by `tests/test_releases.py` (23 tests): numeric comparison including the
1.9/1.10 case, the floor being inclusive, an unpublished release never being
offered, platforms not leaking into each other, and the endpoint needing no
token.
