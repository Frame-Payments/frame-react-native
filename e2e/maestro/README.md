# Maestro E2E — onboarding, happy path

Black-box automation of the **example app**, driven the way a merchant would
drive a real integration. One scenario today: onboarding from an empty account
to the Alert that hands back the account id.

The target is an SDK, not an app — hence Maestro (YAML, no instrumentation
build) rather than Detox.

---

## Why it lives in this repo

The `testID`s the flows use live in `src/`. Test and selector need to change in
the same PR: in a separate repo, renaming a `testID` would pass CI here and
break the suite there, with nobody noticing.

It does not ship in the npm package: the `files` field in `package.json` is a
whitelist (`lib`, `ios`, `android/…`, `plugin`, `app.plugin.js`, the podspec,
README and LICENSE) and `e2e/` is not in it.

---

## Prerequisites

| | |
|---|---|
| A booted iOS simulator | `xcrun simctl list devices booted` |
| The example app installed | normal build (`npm run ios` inside `example/`) |
| Java 17+ | `run.sh` falls back to Android Studio's JBR when there is no `java` on PATH |
| Maestro | `curl -Ls "https://get.maestro.mobile.dev" \| bash` |
| The minting script | `~/frame-qa/mint-qa-session.mjs` (see below) |

Do not install a JDK via Homebrew on this machine — the brew here is an Intel
build under Rosetta. Android Studio's JBR is arm64 and works.

CocoaPods for `example/ios` runs through bundler (`bundle exec pod install`),
not brew.

### The coupling to `~/frame-qa`

`helpers/setup-session.sh` calls `~/frame-qa/mint-qa-session.mjs`, which already
mirrors the minting in `frame-cypress`
(`cypress/support/frameOS/activation.js`) and reads the sandbox keys from
`~/dev/frame-cypress/cypress.env.json`. Reusing it is deliberate:
reimplementing would create a second source of truth for personas and keys.

It is the only coupling outside this repo. Overridable:

```bash
FRAME_MINT_SCRIPT=/path/to/mint.mjs FRAME_SESSION_JSON=/path/session.json npm run e2e:onboarding
```

For CI, that script (and `cypress.env.json`) is what needs to be vendored /
turned into secrets.

---

## Running it

```bash
npm run e2e:onboarding
```

That does, in order: mints an account and session in the chosen environment,
rewrites `example/.env`, **builds the SDK (`tsc` → `lib/`)**, restarts Metro with
`--reset-cache`, warms the iOS bundle, and runs the flow with evidence landing in
`e2e/maestro/artifacts/<timestamp>/`.

> **The SDK build is not optional.** `example/` imports
> `framepayments-react-native`, whose `main` is `lib/index.js` — it bundles the
> `tsc` output, not `src/`. Without `npm run build`, a freshly added `testID` in
> `src/` simply does not exist in the running app, and the flow fails with
> "element not found" pointing at the right selector on the right screen.

### Watching the UI being driven

There is no headless mode on iOS — Maestro's `--headless` is web only. It drives
**the same simulator you have open**, so watching is just a matter of keeping the
window in view:

```bash
open -a Simulator
```

Three tools worth more than watching, when the goal is understanding or fixing a
flow:

**Inspecting the screen hierarchy.** `maestro studio` **no longer exists in the
CLI** (2.8 answers "Maestro Studio is no longer bundled with the CLI" and points
at a desktop app on `studio.maestro.dev`). The equivalent that already comes free
with every run is better for debugging, because it is historical rather than
live:

```
artifacts/<timestamp>/.maestro/tests/<ts>/onboarding-happy-path/screen-hierarchy/
```

One JSON per step, with `resource-id`, `text`, `bounds` and `enabled` for every
element at the instant of that step. To read the one for the failing step:

```bash
node -e '
const t=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
(function w(n){const a=n.attributes||{};
  if(a["resource-id"]||a.text) console.log(`${a["resource-id"]||"-"}  "${a.text||""}"  ${a.bounds}`);
  (n.children||[]).forEach(w);})(t);
' <path-to-json>
```

That is how every failure in this suite was diagnosed — including the OTP one,
where the JSON showed the slots holding `1 2 4 5 6`.

**Authoring loop.** Re-runs on every save:

```bash
. e2e/maestro/helpers/maestro-env.sh
maestro test -c e2e/maestro/flows/onboarding-happy-path.yaml
```

`-c` / `--continuous` re-runs every time you save the file. It is the authoring
loop — treat it as an implicit `--skip-setup`: Maestro prepares no state here, so
only use it while the account is still valid.

And every run already records video on its own (see Evidence).

### Choosing the environment

```bash
npm run e2e:onboarding -- --env staging
npm run e2e:onboarding -- --env qa --persona pendingKyc
npm run e2e:onboarding -- --caps kyc,phone_verification
```

**The same flow runs against any environment** — no host, key or id lives in the
YAMLs. `--env` swaps the host, the sandbox keys and the account; the flow only
receives `ACCOUNT_ID`, `SCREEN_PHONE` and `BASE_URL` via `maestro test -e`.

> **The base URL is not configurable at runtime.** The
> `babel-plugin-transform-inline-environment-variables` inlines
> `process.env.FRAME_*` as literals at bundle time
> (`example/babel.config.js`). Maestro has no way to switch environments mid-run
> — which is why the environment selector is a script that runs **before** it,
> and why `--reset-cache` is not optional.

### Reusing a session

```bash
npm run e2e:onboarding -- --skip-setup
```

Skips the minting, the build and the Metro restart. Useful when iterating on a
page object — but **only valid for YAML changes**: if you touched `src/`, you
need the full setup (or a manual `npm run build`).

**The session expires after 30 minutes**, and an account that already completed
onboarding is no good for a second run — when in doubt, run without
`--skip-setup`.

### Choosing the simulator

`run.sh` resolves it on its own: among the booted simulators, it picks the one
with the app installed. If none has it, or more than one does, it stops with an
error saying exactly what to do.

This exists because Maestro picks arbitrarily when more than one device is up,
and when the chosen one lacks the app it dies in 2 seconds with
`Failed to get app binary directory` — which says nothing about the cause. It
happened here: an `iPhone 17` without the app stayed booted alongside the
`iPhone 17 Pro` that had it, and Maestro picked the wrong one.

To force a device:

```bash
FRAME_E2E_DEVICE=A6DC6FC5-DBE9-4664-B642-2C05A7A9304D npm run e2e:onboarding
```

To find the udids: `xcrun simctl list devices available`.

---

## Layout

```
e2e/maestro/
  config.yaml                      # Maestro workspace (flows, tags)
  flows/
    onboarding-happy-path.yaml     # the journey, readable top to bottom
  pages/                           # one file per screen: actions + assertions
    exampleHome.yaml               #   the merchant app
    verificationWelcome.yaml
    phoneAuth.yaml
    verifyPhone.yaml
    personalInformation.yaml
    selectPaymentMethod.yaml       #   used twice (EXPECT=add_new|saved)
    addPaymentMethod.yaml
    selectPayoutMethod.yaml
    addBankAccount.yaml            #   "Add Bank Account" + "Bank Details"
    verificationSubmitted.yaml     #   terminal screen + the SDK's Alert
  helpers/
    fixtures.js                    # OTP, card, ACH — and session validation
    setup-session.sh               # mints, rewrites .env, restarts Metro
    run.sh                         # the single command
```

### Page objects, in Maestro

The pattern's equivalent is **subflows** (`runFlow`) parameterised through `env`.
Each `pages/*.yaml` exposes its own screen's actions and assertions and receives
data via `env`; the main flow does not carry a single selector. Same discipline
as `frame-cypress/cypress/pages/onboarding/`.

Three design differences from the initial sketch, with the reason:

1. **`appId` does not live in `config.yaml`.** Maestro does not accept that key
   in the workspace config — it belongs in the header of each flow file. And
   every flow file, subflows included, needs both YAML sections (config `---`
   commands), so `appId` appears repeated across the ten page objects: that is
   duplication imposed by the format, not a choice. `config.yaml` kept `flows`
   and the tags.
2. **`pages/exampleHome.yaml` was added.** The merchant app is the journey's
   first screen; treating it as a page keeps the flow uniform.
3. **`helpers/run.sh` was added** alongside `setup-session.sh`, because "one
   command to run" and "prepare the state" are different responsibilities — and
   `--skip-setup` only makes sense once the two are separated.

### Fixtures

`helpers/fixtures.js` is the single source for the scenario's data; the YAML only
references `${output.*}`. OTP, card and ACH live there, with pointers to the
backend catalogs (`test_profiles.rb`, `test_payment_methods.rb`).

**The phone number is the deliberate exception.** It is the key that decides the
KYC outcome and is chosen together with the persona, at minting time. Pinning it
in `fixtures.js` would create a second source of truth: switching persona via
`--persona` and forgetting the phone would give a `Sandbox persona not found` —
or, worse, a run that passes against the wrong persona. So it comes from
`setup-session.sh`, derived from the same `cypress/fixtures/<env>.json` the web
suite uses, and reaches the flow as `SCREEN_PHONE`. Never a literal in the YAML.

Mind the trap: there are two different phone numbers.
`apiProfile.individual.phone` (`2146624688`) goes in the account **payload**; the
persona's `getStarted.phone` (`2001001695` for the approving one) is what gets
**typed on screen**.

### Selectors

The flows use `testID`, not text. The convention is the one already in the repo,
`onboarding.<area>.<element>`:

| area | screens |
|---|---|
| `onboarding.welcome.*` | the "Verify Your Identity" intro |
| `onboarding.phone.*` | phone (`.number`, `.number.country`) |
| `onboarding.otp.*` | code (`.field.0`…`.field.5`) |
| `onboarding.personal.*` | personal information (`.address.line1`, `.dob.year`, …) |
| `onboarding.pm.*` | payment method (`.saved_list`, `.__add_new__`) |
| `onboarding.card.*` | card (`.number`, `.expiry`, `.cvc`, `.address.*`) |
| `onboarding.payout.*` | payout method |
| `onboarding.ach.*` | bank (`.routing`, `.account_number`, `.account_type`) |
| `onboarding.submitted.*` | terminal screen |
| `example.onboarding` | the example app's button |

Before this work the SDK had 6 literal `testID`s, none of them on the happy path.
It now has 44. The primitives already accepted the prop; what was missing was
filling it in at the point of use. `PaymentCardField`,
`BillingAddressDetailView` and `DropDown` gained the pass-through to their
sub-fields, in the same format `OtpInputField` and `DobInputField` already used
(`<block>.<field>`).

**Tracked debt** — the places where text was unavoidable are commented in the
YAML:

- `pages/verificationSubmitted.yaml`: the iOS Alert. `UIAlertController` is a
  system component and takes no `testID`. Mitigating factor: the copy comes from
  `example/App.tsx` (ours) and the `Account: <id>` being matched is session data,
  not copy.
- `pages/addPaymentMethod.yaml`: the "Set up Apple Pay" button has no selector —
  `ApplePayButton` wraps a native component and does not forward `testID`. Not
  used by this scenario; an `onboarding.card.apple_pay` would fix it.

### The keyboard

Maestro's `hideKeyboard` **does not work** on the Frame screens: iOS numeric
keyboards expose no standard dismiss action, and the command fails with
"Couldn't hide the keyboard".

The SDK already solves this itself — `KeyboardAccessory` renders a "Done" bar
above the keyboard, mounted once in the `BottomSheet` precisely because
`number-pad` / `phone-pad` have no return key. It gained
`frame.keyboard.done` (without the `onboarding.` prefix, because `BottomSheet`
also serves checkout and cart), and the flows tap it. That is the gesture a real
user makes, and it is more honest than a synthetic dismiss.

---

## What the scenario proves

Twelve steps, in the order verified by hand. The assertion that matters most is
the last one: the example app's Alert carries `status: 'completed'` **and the
correct account id** — the SDK's public contract, not just its UI. A flow that
only reached the "Verification Submitted" screen would pass even if
`presentOnboarding()` resolved with the wrong id.

On top of that, three prefill assertions (`text: ".+"` on the pre-filled fields
of personal information, card billing and ACH billing) fail the scenario if the
backend stops returning the profile — without them, the flow would type over the
top and pass with an empty screen.

Evidence per run, under `artifacts/<timestamp>/`:

| | |
|---|---|
| `report.xml` | JUnit, for CI. `FRAME_E2E_FORMAT=HTML-DETAILED` swaps it for a browsable report |
| `<ts>/onboarding-happy-path/startRecording/onboarding.mp4` | **video of the entire run**, recorded by the flow via `startRecording` |
| `<ts>/onboarding-happy-path/takeScreenshot/` | the scenario's 12 named screenshots |
| `.maestro/tests/.../screenshots/` | one automatic screenshot per Maestro step |
| `.maestro/tests/.../screen-hierarchy/` | the accessibility tree for each step, as JSON — this is what tells you which `id`s were actually on screen |
| `.maestro/tests/.../logs/` | logs from Maestro, XCUITest and the simulator |

The video is the evidence no screenshot gives: on a red run it shows what the
screen did **before** the step that broke.

The `takeScreenshot` calls use relative names on purpose: Maestro 2.8 sandboxes
the path and refuses anything resolving outside the run's output folder. What
picks the folder is `--debug-output` in `run.sh`.

`screen-hierarchy/*.json` is the more useful of the two diagnostic tools: it
lists `resource-id`, `text` and `bounds` for every element at the exact moment of
the step. An `assertVisible` that fails with the element visible on screen is
almost always resolved by looking there.

---

## When it fails

The happy path was validated by hand end to end against QA. If the flow fails,
the likelier hypothesis is selector or timing, not the SDK. In order:

0. **If NOTHING was printed** — the command returned to the prompt without a
   single line — it is almost always the simulator. Run it again: the scripts
   carry `trap ... ERR`, so every death by `set -e` now prints
   `aborted at line N`. (That trap exists because of a real trap: `grep` with no
   match exits 1, and under `set -o pipefail` that killed `run.sh` before its
   first `echo` whenever no simulator was booted.)
1. **Open the previous step's screenshot** in `artifacts/<timestamp>/`. It tells
   you which screen the flow stalled on.
2. **The `screen-hierarchy/` JSON for that step** shows the real hierarchy and
   which `id`s existed. Fastest way to confirm whether a selector disappeared.
3. **`e2e/maestro/metro.log`** — if the bundle never built, everything else is
   noise. An "element not found" on a selector you are certain exists in `src/`
   is almost always a stale `lib/`: run `npm run build`.
4. **Expired session** (30 min) or a reused account: run without `--skip-setup`.
5. **Wrong environment**: `assertVisible: "Account: <id>"` failing with the
   success screen right there is almost always a stale bundle — `--reset-cache`
   did not take.

### Command cost, and why the OTP looked slow

On Maestro/iOS **every `tapOn` costs ~1.5s**, because locating an element is a
full XCUITest hierarchy scan. An `inputText` costs ~0.9s. That changes what
"clean code" means: in `frame-cypress`, `otpInput.eq(i).type(digit)` six times is
free; here, six `tapOn`s cost 9s.

The first version of this flow tapped each slot before typing — 12 commands,
14.4s just to type six digits. The taps were **redundant**: `OtpInputField`
already moves focus on every digit. What avoids the race (see below) is the
latency between commands, not the tap. One `tapOn` on the first slot plus six
`inputText` does the same in 7 commands and 6.7s.

| | commands | time |
|---|---|---|
| tapOn per slot | 12 | 14.4s |
| one tapOn + 6 inputText | 7 | **6.7s** |

Full run: 69s → 56s (the rest came from removing a defensive `eraseText` that
cost 3s to do nothing on a field that already arrives empty).

Rule of thumb when writing a new page object: **a `tapOn` is only justified when
focus will not arrive on its own.** Where the app auto-advances (OTP slots,
expiry→CVC on the card), the tap is waste. Where it does not, it is mandatory —
for example PAN→expiry, because `PaymentCardField.onPanChange` only auto-advances
at 19 digits and a Visa has 16.

Confirming the OTP through the API is not worth it: it would save seconds and
remove from the scenario exactly the screen it exists to cover.

### A finding from this work: the OTP under machine input

Typing `123456` in a single `inputText` **loses a digit**. On a real run the
slots ended up holding `1 2 4 5 6` with the sixth empty, and the keyboard
dropped. Note the problem is the single `inputText`, not the absence of taps: six
separate `inputText` calls work precisely because there is ~0.9s between them.

Cause: `OtpInputField.onSlotChange` advances focus inside a
`requestAnimationFrame` on every digit. XCUITest types faster than that cycle, so
keystrokes arrive while focus is in transit and `handleSlotChange` spreads them
from the wrong slot.

**This does not look like a production bug**, which is why it sits here rather
than in the table below: no human types that fast, and iOS SMS autofill delivers
all six digits at once, through the paste-spread path `handleSlotChange` already
handles (and which `otpFieldLogic.test.ts` covers). The flow addresses each slot
explicitly — a real user gesture that does not depend on the race. No `sleep` was
used to paper over it.

Worth a second look if a report ever comes in of SMS codes landing wrong on a
physical device.

### Known defects — do not work around them in the test

A workaround in the flow hides a production bug. These are documented, and the
flow avoids them explicitly rather than disguising them:

| defect | symptom |
|---|---|
| **Plaid without its native pod** | `Connect Bank Account` renders and tapping it hangs on an infinite spinner, with no error and no timeout. Cause: `react-native-plaid-link-sdk` sits in the **root** `node_modules` of the repo, which Metro watches via `watchFolders`, so `isPlaidAvailable()` (which only tests the JS `require`) returns `true`; the pod, however, comes from `example/`'s `Podfile`, which reads `example/node_modules`. The guard measures JS availability, not the native module's. The flow uses `Enter manually`. |
| `initialize` without `publishableKey` | throws synchronously, outside the Promise |
| Expired session | correct error, but no recovery path |
| Resume after dismiss | the intro screen reappears with the wrong copy |

---

## Out of scope today

Other scenarios (denied, pending, underage KYC — the personas already exist
behind `--persona`), checkout, Apple Pay, Android, CI, and anything needing a
camera or a physical device.

The design already accounts for CI: no global state, evidence per run, a JUnit
report, and the single external coupling isolated behind two environment
variables.
