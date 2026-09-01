# Taking a payment

For the app repo. Two ways a student pays, one screen each, and one rule about
the Paystack account that must not be broken.

**The short version:** M-Pesa is the default and the one almost everyone will
use — a phone number, a PIN prompt, and polling until it settles. Cards are a
browser redirect for the few who need one. Never build a "choose a provider"
screen; the server picks, and the app branches on what it is told.

---

## 0. The rule about Paystack — read this before touching anything

**The Paystack account is shared with another app. Do not change anything in the
Paystack dashboard. Ever.**

Not the callback URL, not the webhook URL, not the allowed channels. Those
settings belong to the other product and changing one breaks it silently — its
payments would start redirecting to ALS or its webhook would stop arriving, and
nobody would find out until its students complained.

Nothing about ALS needs a dashboard change, and this is why:

| Dashboard setting | How ALS avoids it |
| --- | --- |
| **Callback URL** | The server sends `callback_url` on **every transaction**, which overrides the dashboard for that transaction only. The other app's URL is never touched and never sees an ALS payment. |
| **Webhook URL** | Cannot be overridden per transaction — so ALS **never receives a Paystack webhook** and does not want one. Card payments settle because the server *asks* Paystack, on return and again from a background sweep. |

That second row is the one that matters for the app. It means:

- There is no push. Nothing arrives on its own.
- **The app calling `POST /billing/verify` when the browser closes is the
  primary settlement path**, not a nicety.
- If a student closes the tab before the redirect fires, a server-side sweep
  picks it up within ~5–30 minutes. The app does not have to handle that, but it
  should not claim the payment failed either — see §3.

If someone ever says "the Paystack webhook isn't working" — it isn't meant to.
Don't point it at ALS to fix it.

---

## 1. Which screen to show

```
GET /api/v1/billing/plans
```

Prices, names, `family`, `billing_period`, `saving_percent` — as today. Then:

- **M-Pesa** — a phone number field and a Pay button. Default and prominent.
- **Card** — a secondary option. Most students will not use it, and every card
  payment costs us more than the same M-Pesa one.

No provider names anywhere in the UI. A student picks *M-Pesa* or *card*; which
processor handles it is the server's business and can change without an app
release.

---

## 2. M-Pesa

### Start the payment

```
POST /api/v1/billing/mpesa
{ "tier": "pro", "phone": "0712345678" }
```

Send whatever the student typed. `0712…`, `+254712…`, `254 712 345 678`,
`712345678` and spaced or hyphenated versions all normalise server-side. Only a
number that genuinely cannot receive an M-Pesa prompt is refused, with a message
saying so — show it verbatim rather than validating format in the app, or you
will end up rejecting numbers that work.

**Do not send an amount.** There is no amount field; the price is read from the
server's plan table. A price the client can influence is a price the client can
choose.

### The response — branch on `mode`

```jsonc
{
  "mode": "stk",              // or "redirect"
  "provider": "daraja",       // logging only; never shown to a student
  "reference": "als_9f2c…",
  "message": "Success. Request accepted for processing",
  "tier": "pro",
  "plan_name": "Synapse",
  "amount_ksh": 350,
  "phone": "254712345678",
  "checkout_url": null
}
```

| `mode` | What happened | What the app does |
| --- | --- | --- |
| `stk` | A PIN prompt is ringing on that phone | Show "Check your phone", then poll (below) |
| `redirect` | M-Pesa was unreachable; the server opened a fallback page | Open `checkout_url` in a browser, then `POST /billing/verify` on return |

`redirect` is a genuine fallback, not a second option — it is the same M-Pesa
payment with a processor's fee on top. It happens when Safaricom is down or
refusing. The student should never be told which one they got; both are "paying
with M-Pesa".

Show `message` verbatim on `stk`. It is Safaricom's own wording of what the
handset is about to say.

Show `phone` back to the student — "sent to 254712345678". A typo caught here
saves two minutes of waiting for a prompt that never arrives.

### Poll

```
GET /api/v1/billing/mpesa/status?reference=als_9f2c…
```

```jsonc
{
  "status": "pending",     // pending | success | failed
  "message": "Still waiting for M-Pesa.",
  "pending": true,
  "subscription": null      // the full subscription object once paid
}
```

**Poll on `pending`, not on `status`.** They differ in the case that matters: a
slow answer from Safaricom comes back `pending: true` and must keep the spinner
up, never draw as a failure to somebody who is mid-PIN.

- Every **3–5 seconds** while `pending` is true.
- Stop as soon as `pending` is false.
- **Give up after about 2 minutes.** An STK prompt expires on the handset around
  60 seconds; two minutes is comfortably past that.
- On give-up, say *"We haven't heard back yet — if you were charged, your plan
  will turn on shortly."* Do **not** say it failed. The server's sweep settles
  anything that arrives late, and telling a student who was debited that their
  payment failed is the worst thing this screen can do.
- Poll again on foreground, in case the app was backgrounded mid-payment.

On `status: "success"` the `subscription` object is included — use it directly
rather than making a second call to `/billing/subscription` at the one moment the
student is watching the screen.

### The failure messages

`message` on a failure is already written for a student. Show it as-is:

| What happened | `message` |
| --- | --- |
| Cancelled the prompt | "You cancelled the payment." |
| No money | "You do not have enough M-Pesa balance for that." |
| Prompt expired | "The prompt timed out. Check your phone is on and try again." |
| Wrong PIN | "That PIN was wrong. Try again." |
| Anything else | "That payment did not go through. You have not been charged." |

All of them are terminal and all of them should offer **Try again**, which starts
a fresh `POST /billing/mpesa`. Each attempt gets its own reference; never reuse
one.

---

## 3. Cards

```
POST /api/v1/billing/card
{ "tier": "pro" }
```

```jsonc
{
  "checkout_url": "https://checkout.paystack.com/abc123",
  "reference": "als_7d10…",
  "tier": "pro",
  "plan_name": "Synapse",
  "amount_ksh": 350
}
```

1. Open `checkout_url` in an in-app browser or the system browser.
2. When it closes — for **any** reason, success or cancel or back button — call:

```
POST /api/v1/billing/verify
{ "reference": "als_7d10…" }
```

3. `200` returns the subscription. `402` means it has not gone through.

**Step 2 is the settlement path, not a confirmation step.** There is no webhook
(§0). If the app skips this call the payment is only settled by the server's
sweep, minutes later, and the student sits on a screen that has not updated.

Call it on close even if the student appears to have cancelled — people close
the browser after paying, and the reference is what resolves it.

### Retrying verify

Safe to call repeatedly. It keys on the reference, so a second call returns the
same subscription rather than extending the plan again. If you get `402`, waiting
a few seconds and calling once more is reasonable; three attempts is plenty.

### Do not use `/billing/card/return`

Paystack redirects the *browser* to that URL. It has no session and no token, and
it deliberately credits nothing — crediting from an unauthenticated GET carrying
a reference would be a free plan for anyone who reads a URL out of someone's
history. It exists to give the browser somewhere to land. The app's own
`/billing/verify` call is what does the work.

If the in-app browser can detect navigation to `…/billing/card/return`, use that
as the cue to close it and call verify. Just don't trust anything it says.

---

## 4. What not to do

- **Do not call `/billing/verify` with an M-Pesa reference.** It returns `409`
  pointing you at `/billing/mpesa/status`. The providers do not know each
  other's references, and asking the wrong one would report "no such
  transaction" — which would reach a just-charged student as "your payment did
  not go through".
- **Do not write the subscription locally after a payment.** `verified` and
  `tier` come from the server. The app writing an optimistic subscription is why
  `verified: false` exists, and a plan that shows as active on the device and
  inactive on the server is a support thread.
- **Do not build a provider picker.** M-Pesa or card. That is the whole choice.
- **Do not retry a failed M-Pesa payment against the same reference.** Start a
  new one.
- **Do not change anything in the Paystack dashboard.** See §0.

---

## 5. Edge cases worth handling

| Situation | What the app should do |
| --- | --- |
| Student backgrounds the app mid-prompt | Resume polling on foreground, using the stored reference |
| Poll times out at 2 minutes | "Haven't heard back yet" — never "failed". Offer Check again |
| `POST /billing/mpesa` returns `mode: "redirect"` | Open the URL; treat it exactly like the card flow from there, verify included |
| Card browser closed with no result | Call verify anyway |
| `/billing/card` returns `503` | Card payments are not configured. Point at M-Pesa |
| Student already has the plan | Verify is idempotent; just refresh the subscription |
| Two devices, one payment | Both see it after their next `/billing/subscription` |

---

## 6. A minimal happy path

```js
// M-Pesa
const start = await api.post("/billing/mpesa", { tier, phone });

if (start.mode === "redirect") {
  await openBrowser(start.checkout_url);
  return api.post("/billing/verify", { reference: start.reference });
}

// STK: poll until it settles or we give up.
const until = Date.now() + 120_000;
while (Date.now() < until) {
  const s = await api.get(`/billing/mpesa/status?reference=${start.reference}`);
  if (!s.pending) return s;              // success or failed, both terminal
  await sleep(4000);
}
return { status: "unknown" };            // "haven't heard back yet" — NOT failed
```

```js
// Card
const start = await api.post("/billing/card", { tier });
await openBrowser(start.checkout_url);   // resolves when the browser closes
return api.post("/billing/verify", { reference: start.reference });
```

---

## Related

- [APP_EXTRACTION_UX.md](./APP_EXTRACTION_UX.md) — document status and scans.
- [APP_UPDATES.md](./APP_UPDATES.md) — shipping this. All JS, so OTA.
- [PLAN_LIMITS.md](./PLAN_LIMITS.md) — what each tier includes.
