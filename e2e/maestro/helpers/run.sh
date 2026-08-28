#!/usr/bin/env bash
#
# The single command: prepares the state and runs the scenario.
#
#   npm run e2e:onboarding                       # QA, approving persona
#   npm run e2e:onboarding -- --env staging      # another environment
#   npm run e2e:onboarding -- --skip-setup       # reuse the already-minted session
#
# Environment is just configuration: --env swaps the host, the keys and the
# account. No host, key or id lives in the YAMLs.
set -euo pipefail
# Without this, any command failing under `set -e` kills the script printing
# NOTHING — which is what happened when the device-resolution `grep` found no
# booted simulator: `npm run e2e:onboarding` returned to the prompt without a
# single line of output. The trap turns every silent death into a diagnostic.
trap 'echo "run.sh: aborted at line $LINENO (exit $?)" >&2' ERR

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
E2E="$(dirname "$HERE")"

SKIP_SETUP=0
SETUP_ARGS=()
for arg in "$@"; do
  if [[ "$arg" == "--skip-setup" ]]; then SKIP_SETUP=1; else SETUP_ARGS+=("$arg"); fi
done

# --- maestro + java --------------------------------------------------------
# Same resolver `npm run e2e:studio` uses, and the one you can load into your
# own shell with `. e2e/maestro/helpers/maestro-env.sh` to drive maestro by hand
# (studio, -c, and so on).
# shellcheck source=/dev/null
. "$HERE/maestro-env.sh"

# --- device ----------------------------------------------------------------
# Maestro picks the device on its own, and picks badly: with more than one
# simulator booted the choice is arbitrary, and when the chosen one lacks the app
# it dies in 2s with "Failed to get app binary directory" — which says nothing
# about the cause. That happened here, with an iPhone 17 without the app booted
# alongside the iPhone 17 Pro that had it. So the choice is explicit, and the
# errors say what to do.
APP_ID="org.reactjs.native.example.FrameExample"
SIMROOT="$HOME/Library/Developer/CoreSimulator/Devices"

# `simctl listapps` requires the device to be BOOTED, so it cannot help suggest
# which one to start. Looking for the bundle id in the Info.plist of installed
# .app bundles works in both states. (grep -a because Info.plist is usually a
# binary plist.)
app_installed() {
  local hit
  hit=$(find "$SIMROOT/$1/data/Containers/Bundle/Application" \
          -maxdepth 3 -name Info.plist -exec grep -la "$APP_ID" {} + 2>/dev/null \
        | head -1) || true
  [[ -n "$hit" ]]
}

udids_of() {  # udids_of booted | udids_of available
  xcrun simctl list devices "$1" \
    | grep -oE '\([0-9A-F]{8}-([0-9A-F]{4}-){3}[0-9A-F]{12}\)' | tr -d '()' || true
}

label_of() {
  xcrun simctl list devices | grep -F "$1" | sed 's/^ *//; s/ (.*//' || true
}

# Every simulator carrying the app, booted or not — used in the error messages
# to offer a copy-pasteable command instead of a generic "<udid>".
with_app() {
  local u
  for u in $(udids_of available); do
    app_installed "$u" && echo "$u" || true
  done
}

BOOTED=$(udids_of booted)

DEVICE="${FRAME_E2E_DEVICE:-}"
if [[ -n "$DEVICE" ]]; then
  if ! grep -qF "$DEVICE" <<<"$BOOTED"; then
    echo "run.sh: $DEVICE is not booted. Start it with:" >&2
    echo "          xcrun simctl boot $DEVICE && open -a Simulator" >&2
    exit 1
  fi
  app_installed "$DEVICE" || {
    echo "run.sh: the app $APP_ID is not installed on $DEVICE." >&2
    echo "        Build onto it: cd example && npm run ios" >&2
    exit 1
  }
else
  if [[ -z "$BOOTED" ]]; then
    echo "run.sh: no booted simulator." >&2
    CANDIDATE=$(with_app | head -1)
    if [[ -n "$CANDIDATE" ]]; then
      echo "        Start the one that already has the app ($(label_of "$CANDIDATE")):" >&2
      echo "          xcrun simctl boot $CANDIDATE && open -a Simulator" >&2
    else
      echo "        And no simulator has $APP_ID installed." >&2
      echo "        Build it first: cd example && npm run ios" >&2
    fi
    exit 1
  fi
  MATCHES=()
  for udid in $BOOTED; do
    if app_installed "$udid"; then MATCHES+=("$udid"); fi
  done
  case "${#MATCHES[@]}" in
    1) DEVICE="${MATCHES[0]}" ;;
    0)
      echo "run.sh: no booted simulator has $APP_ID installed." >&2
      for u in $BOOTED; do echo "        booted: $u  $(label_of "$u")" >&2; done
      CANDIDATE=$(with_app | head -1)
      if [[ -n "$CANDIDATE" ]]; then
        echo "        Start the one that has the app ($(label_of "$CANDIDATE")):" >&2
        echo "          xcrun simctl boot $CANDIDATE && open -a Simulator" >&2
      else
        echo "        Build it: cd example && npm run ios" >&2
      fi
      exit 1
      ;;
    *)
      echo "run.sh: more than one booted simulator has the app. Pick one:" >&2
      for u in "${MATCHES[@]}"; do
        echo "          FRAME_E2E_DEVICE=$u npm run e2e:onboarding   # $(label_of "$u")" >&2
      done
      exit 1
      ;;
  esac
fi
echo "==> device: $DEVICE  $(label_of "$DEVICE")"

# --- state -----------------------------------------------------------------
if [[ "$SKIP_SETUP" -eq 0 ]]; then
  # `${a[@]+"${a[@]}"}` rather than `"${a[@]}"`: the bash 3.2 shipped with macOS
  # treats an empty array as unbound under `set -u`.
  bash "$HERE/setup-session.sh" ${SETUP_ARGS[@]+"${SETUP_ARGS[@]}"}
else
  echo "==> --skip-setup: reusing $E2E/.session.env (careful: the session expires after 30 min)"
fi

if [[ ! -f "$E2E/.session.env" ]]; then
  echo "run.sh: $E2E/.session.env does not exist. Run without --skip-setup." >&2
  exit 1
fi
set -a
# shellcheck source=/dev/null
. "$E2E/.session.env"
set +a

# --- evidence --------------------------------------------------------------
# One directory per run, so one run's screenshots do not overwrite another's.
#
# The `takeScreenshot` calls in the page objects use relative names, with no
# directory: Maestro 2.8 sandboxes the path and refuses anything resolving
# outside the run's output folder. So --debug-output is what picks the folder,
# and it receives screenshots, logs and the report together.
RUN_ID="$(date +%Y%m%d-%H%M%S)"
SHOT_DIR="$E2E/artifacts/$RUN_ID"
mkdir -p "$SHOT_DIR"

echo "==> running the scenario (evidence in $SHOT_DIR)"
set -x
# --debug-output brings the screen-hierarchy/ (the accessibility tree per step,
# the best diagnostic tool available); --test-output-dir puts takeScreenshot/
# and startRecording/ at the root of the folder, with no nesting.
exec maestro --device "$DEVICE" test \
  -e ACCOUNT_ID="$ACCOUNT_ID" \
  -e SCREEN_PHONE="$SCREEN_PHONE" \
  -e BASE_URL="$BASE_URL" \
  --debug-output "$SHOT_DIR" \
  --test-output-dir "$SHOT_DIR" \
  --format "${FRAME_E2E_FORMAT:-junit}" \
  --output "$SHOT_DIR/report.xml" \
  "$E2E/flows/onboarding-happy-path.yaml"
