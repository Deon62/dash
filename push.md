# Push notifications — what the app has to do

Short version of `app/services/notifications.py` for whoever is wiring up the
client. Reminders are decided and sent by the **server**; the app's job is to
hand over a token, a timezone, and permission.

---

## 1. Do we need FCM keys? Yes — but not here

The backend holds **no FCM or APNs credential and never will**. It talks to
Expo's push service, and Expo is what talks to Google and Apple. So the
credentials are real, they are just uploaded to Expo rather than to this API.

| Platform | What is needed | Where it goes |
| --- | --- | --- |
| Android | FCM **V1** service-account JSON, from the Firebase project | `eas credentials` → uploaded to Expo |
| iOS | APNs key | `eas credentials` — EAS generates and manages it for you |

Nothing about either of them appears in `/etc/als-backend/env`. The only server
switch is `PUSH_ENABLED=true`, and it is already documented in `DEPLOYMENT.md`.

Two ways this fails silently and looks like a backend problem:

* **Android with the legacy FCM server key.** Google turned that off. It has to
  be the V1 service-account JSON, or every Android send is rejected by Expo.
* **A build with no credentials at all.** `getExpoPushTokenAsync` still returns
  a token, the app registers it, the server sends to it happily, and nothing
  ever arrives on a handset.

---

## 2. Register the token

```
PUT /api/v1/me/devices
{
  "id": "<uuid the app mints once and keeps>",
  "platform": "ios" | "android",
  "app_version": "1.4.0",
  "push_token": "ExponentPushToken[...]"
}
```

Called on every launch — it is a PUT, so it updates one row rather than piling
up installations. Send it again whenever Expo hands back a different token
(reinstall, restore, OS upgrade); a stale token is a notification that goes
nowhere and says nothing about it.

**The token must be an Expo one** — it has to start with `ExponentPushToken[`
or `ExpoPushToken[` and end with `]`. A raw FCM token, or the empty string a
denied permission sometimes yields, is stored but **skipped by the sweep**
without an error. This is deliberate: it keeps a junk token from failing in the
log every single minute. It also means "registered" is not the same as
"reachable" — see §5.

`DELETE /api/v1/me/devices/{id}` clears the token without signing the device
out, which is the right call when someone turns notifications off in-app.

---

## 3. Send the timezone

```
PATCH /api/v1/me/settings
{ "timezone": "Africa/Nairobi" }
```

This one is load-bearing and worth setting from the device rather than trusting
the default. A class is stored as "Tuesdays at 08:00" with no timezone of its
own, and quiet hours are a wall-clock preference — without the right zone, both
land hours off for anyone who travels. An unrecognised name falls back to UTC
rather than refusing to notify, so a typo is a quiet three-hour error, not a
crash.

The rest of the same object, all optional: `deadline_reminders`,
`class_reminders`, `reminder_lead_minutes` (0–1440), `quiet_hours_start` /
`quiet_hours_end` as `"HH:MM"`. Setting both quiet bounds to the same value
means *no* quiet hours, not a 24-hour silence.

---

## 4. What arrives, and where a tap should go

Each notification carries a `data` payload:

```json
{ "kind": "deadline" | "class" | "test", "id": "<event or class-session id>" }
```

* `deadline` → the event with that id. Title is like `CAT due in 30 minutes`,
  body is the event's own title.
* `class` → the timetable slot with that id. Title is like
  `CS201 starts in 15 minutes`, body is `Compilers · 08:00 · LR7`.
* `test` → §5. No `id`.

A reminder only exists for an event that has a `due_at` and is not done, and for
a class session attached to a unit. Nothing is sent inside quiet hours — but it
is not marked sent either, so if the deadline is still ahead when the window
lifts, it goes out then.

---

## 5. Testing it, without waiting for a real deadline

```
POST /api/v1/me/push/test
→ { "delivered": 1, "has_devices": true }
```

Sends to every device on the account immediately, ignoring quiet hours. Read
the two fields together:

| Response | What it means |
| --- | --- |
| `has_devices: false` | The app never registered a token — §2, or permission was denied |
| `delivered: 0`, `has_devices: true` | A token is stored but Expo would not take it — usually §1 credentials, or a token from an uninstalled build |
| `delivered: 1+` | Expo accepted it. If nothing lands on the handset, it is credentials or notification permission, not this API |

A token Expo reports as dead is cleared automatically, so the account goes back
to `has_devices: false` rather than failing forever.

---

## 6. The in-app list

```
GET /api/v1/me/notifications?limit=50
```

Newest first: `kind`, `title`, `body`, `status` (`sent` / `failed`),
`scheduled_for`, `sent_at`. Push is fire-and-forget — a notification that
arrives while the phone is off is simply gone — so this is the only way a
student sees a reminder they missed. Worth showing somewhere.

---

## Checklist

- [ ] FCM V1 service-account JSON uploaded to Expo (Android)
- [ ] APNs key present in EAS credentials (iOS)
- [ ] Permission requested, then `getExpoPushTokenAsync({ projectId })`
- [ ] `PUT /me/devices` on launch and on every token change
- [ ] `PATCH /me/settings` with the device's IANA timezone
- [ ] Tap handler reads `data.kind` and `data.id`
- [ ] `POST /me/push/test` from a settings screen, for support to lean on
