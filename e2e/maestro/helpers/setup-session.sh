#!/usr/bin/env bash
#
# Prepares the state the Maestro flow assumes: a fresh account with onboarding
# not yet completed, in the chosen environment — plus an example-app bundle
# pointing at that environment.
#
# Why the "environment selector" lives here and not in the YAML: the
# babel-plugin-transform-inline-environment-variables inlines process.env.FRAME_*
# as literals AT BUNDLE TIME (example/babel.config.js). The base URL, the account
# id and the capabilities enter the JS as constants — Maestro has no way to swap
# them at runtime. Switching environments means rewriting example/.env and
# restarting Metro with --reset-cache, before Maestro starts.
#
# Usage:
#   setup-session.sh [--env qa|staging] [--persona <name>] [--caps <list>]
set -euo pipefail
# Without this, a death by `set -e` prints nothing. See the twin comment in
# run.sh.
trap 'echo "setup-session.sh: aborted at line $LINENO (exit $?)" >&2' ERR

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
E2E="$(dirname "$HERE")"
REPO="$(cd "$E2E/../.." && pwd)"

# The minting is reused from ~/frame-qa/mint-qa-session.mjs, which already
# mirrors frame-cypress (cypress/support/frameOS/activation.js). The only
# coupling outside this repo — overridable for the day CI needs to vendor it.
MINT="${FRAME_MINT_SCRIPT:-$HOME/frame-qa/mint-qa-session.mjs}"
SESSION_JSON="${FRAME_SESSION_JSON:-$HOME/frame-qa/qa-session.json}"

TARGET=qa
PERSONA=""
# Capabilities are DELIBERATELY not pinned here. The mint script owns the
# shipped set, and duplicating it in this helper is how the suite ended up
# certifying `card_verification` + `bank_account_verification` — a pair the
# product does not ship — for weeks after the mint had moved on. One definition,
# one place. Pass --caps only to test a set other than the shipped one; the SDK
# derives the screen flow from it (src/ui/screens/onboarding/onboardingSelectors.ts),
# so a different set means the pages under ../pages may no longer match.
CAPS=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)     TARGET="${2:?--env needs a value}"; shift 2 ;;
    --persona) PERSONA="${2:?--persona needs a value}"; shift 2 ;;
    --caps)    CAPS="${2:?--caps needs a value}"; shift 2 ;;
    -h|--help) sed -n '2,20p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "setup-session.sh: unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ ! -f "$MINT" ]]; then
  cat >&2 <<MSG
setup-session.sh: minting script not found at
  $MINT
Point FRAME_MINT_SCRIPT at it, or see the README (Prerequisites).
MSG
  exit 1
fi

echo "==> minting account + session in '$TARGET'${PERSONA:+ (persona: $PERSONA)}"
# shellcheck disable=SC2086
node "$MINT" --env "$TARGET" ${CAPS:+--caps "$CAPS"} ${PERSONA:+$PERSONA}

# The mint writes example/.env and the json below. Reading the json instead of
# parsing stdout keeps the contract explicit.
read -r ACCOUNT_ID SCREEN_PHONE BASE_URL < <(
  node -e '
    const s = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    for (const k of ["accountId", "screenPhone", "baseUrl"]) {
      if (!s[k]) {
        console.error(`qa-session.json is missing "${k}" — mint-qa-session.mjs is out of date`);
        process.exit(1);
      }
    }
    console.log(s.accountId, s.screenPhone, s.baseUrl);
  ' "$SESSION_JSON"
)

echo "==> account: $ACCOUNT_ID   host: $BASE_URL   on-screen phone: $SCREEN_PHONE"

# ------------------------------------------------------------------ build
# example/ imports `framepayments-react-native`, whose `main` is `lib/index.js`
# — that is, it bundles the tsc output, NOT src/. Without this build, any new
# testID in src/ simply does not exist in the app, and the flow fails with
# "element not found" pointing at the right selector on the right screen.
echo "==> building the SDK (tsc -> lib/)"
( cd "$REPO" && npm run --silent build )

# ---------------------------------------------------------------- Metro
# Without --reset-cache Metro serves the stale bundle, with the previous run's
# account id inlined — and the flow fails on the final Alert assertion with a
# symptom that does not point at the cause.
METRO_LOG="$E2E/metro.log"
if lsof -ti tcp:8081 >/dev/null 2>&1; then
  echo "==> stopping Metro on 8081"
  lsof -ti tcp:8081 | xargs kill 2>/dev/null || true
  for _ in $(seq 1 20); do
    lsof -ti tcp:8081 >/dev/null 2>&1 || break
    sleep 0.5
  done
fi

echo "==> starting Metro with --reset-cache (log: $METRO_LOG)"
( cd "$REPO/example" && nohup npx react-native start --reset-cache >"$METRO_LOG" 2>&1 & )

for _ in $(seq 1 90); do
  [[ "$(curl -fsS -m 2 http://localhost:8081/status 2>/dev/null || true)" == "packager-status:running" ]] && break
  sleep 1
done
if [[ "$(curl -fsS -m 2 http://localhost:8081/status 2>/dev/null || true)" != "packager-status:running" ]]; then
  echo "setup-session.sh: Metro did not come up within 90s. See $METRO_LOG" >&2
  exit 1
fi

# Warm the bundle: with a cleared cache the first GET takes minutes, and it is
# far better to wait here than inside a Maestro timeout.
echo "==> warming the iOS bundle (takes a while with a cleared cache)"
curl -fsS -m 900 -o /dev/null \
  "http://localhost:8081/index.bundle?platform=ios&dev=true&minify=false" \
  || { echo "setup-session.sh: failed to build the bundle. See $METRO_LOG" >&2; exit 1; }

# ---------------------------------------------------------------- output
cat > "$E2E/.session.env" <<ENV
# Written by helpers/setup-session.sh — ephemeral, the session expires after 30 min.
ACCOUNT_ID=$ACCOUNT_ID
SCREEN_PHONE=$SCREEN_PHONE
BASE_URL=$BASE_URL
TARGET=$TARGET
PERSONA=$PERSONA
ENV

echo "==> ready. state in $E2E/.session.env"
