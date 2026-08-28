# Sourceable: makes `maestro` and `java` usable in the current shell.
#
#   . e2e/maestro/helpers/maestro-env.sh
#   maestro studio
#
# This exists because Maestro is a JVM app and this machine has no JDK on PATH —
# only the arm64 JBR bundled with Android Studio. Using that one avoids
# installing a second JDK, and avoids Homebrew's openjdk, which here is an Intel
# build under Rosetta.

# The test is `java -version`, not `command -v java`: macOS ships a stub at
# /usr/bin/java that EXISTS and only prints "Unable to locate a Java Runtime".
# Checking for the binary's presence passes through it, and Maestro dies later.
if ! java -version >/dev/null 2>&1; then
  for _candidate in \
    "${JAVA_HOME:-}" \
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  do
    if [ -n "$_candidate" ] && [ -x "$_candidate/bin/java" ]; then
      JAVA_HOME="$_candidate"
      export JAVA_HOME
      PATH="$JAVA_HOME/bin:$PATH"
      export PATH
      break
    fi
  done
  unset _candidate
fi

if ! java -version >/dev/null 2>&1; then
  echo "maestro-env: no working Java. Point JAVA_HOME at a JDK 17+." >&2
  return 1 2>/dev/null || exit 1
fi

[ -d "$HOME/.maestro/bin" ] && PATH="$HOME/.maestro/bin:$PATH" && export PATH

if ! command -v maestro >/dev/null 2>&1; then
  echo "maestro-env: maestro not found. Install it with:" >&2
  echo '  curl -Ls "https://get.maestro.mobile.dev" | bash' >&2
  return 1 2>/dev/null || exit 1
fi
