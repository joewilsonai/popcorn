#!/usr/bin/env bash
# Popcorn installer for macOS and Linux.
#
#   ./install.sh                         install / update and start the background server
#   ./install.sh --name Ziggy --viewer Sam --voice "deadpan and nerdy"   make the cards yours
#   ./install.sh --engine codex          use your ChatGPT plan (Codex CLI) instead of Claude
#   OPENROUTER_API_KEY=sk-or-... ./install.sh   no subscription? use an OpenRouter key (any model)
#   ./install.sh --lan                   also reachable from your phone/TV (token-protected)
#   ./install.sh --uninstall             stop and remove the background server (keeps your facts)
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OS="$(uname -s)"
LABEL="com.popcorn.server"
say()  { printf '\n\033[1;35m🍿 %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m   %s\033[0m\n' "$*"; }

ENGINE="" NAME="" VIEWER="" VOICE="" LAN="" UNINSTALL=""
while [ $# -gt 0 ]; do
  case "$1" in
    --engine) ENGINE="$2"; shift 2 ;;
    --name) NAME="$2"; shift 2 ;;
    --viewer) VIEWER="$2"; shift 2 ;;
    --voice) VOICE="$2"; shift 2 ;;
    --lan) LAN="true"; shift ;;
    --no-lan) LAN="false"; shift ;;
    --uninstall) UNINSTALL=1; shift ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "unknown option: $1"; exit 1 ;;
  esac
done

PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
UNIT="$HOME/.config/systemd/user/popcorn.service"

if [ -n "$UNINSTALL" ]; then
  if [ "$OS" = Darwin ]; then
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
    rm -f "$PLIST"
  else
    systemctl --user disable --now popcorn.service 2>/dev/null || true
    rm -f "$UNIT"
  fi
  say "Server removed. Your facts are still in ~/.popcorn. Remove the extension from chrome://extensions."
  exit 0
fi

say "Checking what Popcorn needs"
PY="$(command -v python3 || true)"
if [ -z "$PY" ] || ! "$PY" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)'; then
  echo "   Popcorn needs Python 3.9 or newer (macOS: brew install python)."; exit 1
fi
echo "   python: $("$PY" --version)"

if ! command -v yt-dlp >/dev/null 2>&1; then
  echo "   installing yt-dlp (reads YouTube captions)..."
  if command -v brew >/dev/null 2>&1; then brew install yt-dlp
  elif command -v pipx >/dev/null 2>&1; then pipx install yt-dlp
  elif "$PY" -m pip install --user --upgrade yt-dlp >/dev/null 2>&1; then :
  else
    # Locked-down Python (PEP 668) and no pipx: use yt-dlp's own single-file release.
    mkdir -p "$HOME/.local/bin"
    curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "$HOME/.local/bin/yt-dlp"
    chmod +x "$HOME/.local/bin/yt-dlp"
  fi
  export PATH="$HOME/.local/bin:$PATH:$(ls -d "$HOME"/Library/Python/*/bin 2>/dev/null | tr '\n' ':')"
fi
echo "   yt-dlp: $(command -v yt-dlp || echo 'NOT FOUND')"
command -v ffmpeg >/dev/null 2>&1 || warn "ffmpeg not found: fine, it's only for videos with no captions (brew install ffmpeg)."

FOUND=""
for b in claude codex; do
  p="$(command -v "$b" 2>/dev/null || true)"
  [ -z "$p" ] && [ -x "$HOME/.local/bin/$b" ] && p="$HOME/.local/bin/$b"
  [ -n "$p" ] && { echo "   $b: $p (uses your subscription)"; FOUND="$FOUND $b"; }
done

# API keys handed in through the environment get saved where the background server can read them.
if [ -n "${OPENROUTER_API_KEY:-}" ]; then printf '%s' "$OPENROUTER_API_KEY" | "$PY" "$DIR/popcorn.py" set-key openrouter >/dev/null; fi
grep -q '^OPENROUTER_API_KEY=' "$HOME/.popcorn/keys.env" 2>/dev/null && { echo "   openrouter: key saved"; FOUND="$FOUND openrouter"; }

if [ -z "$FOUND" ] && [ -t 0 ]; then
  echo
  echo "   No Claude Code or Codex found. You can still use Popcorn with an API key:"
  echo "   get one at https://openrouter.ai/keys (works with Claude, GPT, Gemini and more; pay per use)."
  printf '   Paste your OpenRouter key (or press Enter to skip): '
  stty -echo 2>/dev/null; read -r KEY || true; stty echo 2>/dev/null; echo
  if [ -n "$KEY" ]; then printf '%s' "$KEY" | "$PY" "$DIR/popcorn.py" set-key openrouter >/dev/null && FOUND="openrouter"; fi
fi
if [ -z "$FOUND" ]; then
  warn "No research engine yet. Popcorn needs ONE of these:"
  warn "  Claude Pro/Max   -> install Claude Code: https://claude.com/claude-code  (run: claude, log in)"
  warn "  ChatGPT Plus/Pro -> npm install -g @openai/codex   (run: codex, log in)"
  warn "  OpenRouter key   -> OPENROUTER_API_KEY=sk-or-... ./install.sh"
  exit 1
fi

say "Saving your settings (~/.popcorn/config.json)"
SET=()
[ -n "$ENGINE" ] && SET+=("engine=$ENGINE")
[ -n "$NAME" ] && SET+=("host_name=$NAME")
[ -n "$VIEWER" ] && SET+=("viewer=$VIEWER")
[ -n "$VOICE" ] && SET+=("voice=$VOICE")
[ -n "$LAN" ] && SET+=("lan=$LAN")
if [ ${#SET[@]} -gt 0 ]; then "$PY" "$DIR/popcorn.py" config "${SET[@]}" >/dev/null; fi
"$PY" "$DIR/popcorn.py" config >/dev/null  # creates the file (and its private token) if new

# The background server gets a PATH that can see every tool found above.
SVC_PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
for b in yt-dlp ffmpeg claude codex node; do
  p="$(command -v "$b" 2>/dev/null || true)"
  [ -n "$p" ] && case ":$SVC_PATH:" in *":$(dirname "$p"):"*) ;; *) SVC_PATH="$(dirname "$p"):$SVC_PATH" ;; esac
done
mkdir -p "$HOME/.popcorn"

say "Starting the background server"
if [ "$OS" = Darwin ]; then
  mkdir -p "$(dirname "$PLIST")"
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$PY</string><string>$DIR/popcorn.py</string><string>serve</string></array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$SVC_PATH</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/.popcorn/server.log</string>
  <key>StandardErrorPath</key><string>$HOME/.popcorn/server.log</string>
</dict>
</plist>
EOF
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
elif command -v systemctl >/dev/null 2>&1; then
  mkdir -p "$(dirname "$UNIT")"
  cat > "$UNIT" <<EOF
[Unit]
Description=Popcorn fact server

[Service]
ExecStart="$PY" "$DIR/popcorn.py" serve
Environment="PATH=$SVC_PATH"
Restart=always

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable --now popcorn.service
  systemctl --user restart popcorn.service
else
  warn "No launchd or systemd here. Start the server yourself: $PY $DIR/popcorn.py serve"
fi

for _ in $(seq 1 20); do
  curl -fs "http://127.0.0.1:$("$PY" "$DIR/popcorn.py" config port)/api/health" >/dev/null 2>&1 && break
  sleep 0.5
done

say "Checkup"
"$PY" "$DIR/popcorn.py" doctor || true

say "Last step: add the extension to Chrome (one time)"
cat <<EOF
   1. Open chrome://extensions
   2. Turn on "Developer mode" (top right)
   3. Click "Load unpacked" and choose this folder:
        $DIR/extension
      (in the file picker, Cmd+Shift+G and paste the path)
   4. Open any YouTube video and look for the 🍿 pill in the top-right of the player.

   No extension? Paste a link at http://127.0.0.1:$("$PY" "$DIR/popcorn.py" config port)
   Updates: git pull. The server and extension pick changes up on their own.
EOF
if [ "$OS" = Darwin ]; then printf '%s' "$DIR/extension" | pbcopy && echo "   (the folder path is on your clipboard)"; fi
