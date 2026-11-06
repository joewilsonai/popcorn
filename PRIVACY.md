# Popcorn privacy policy

*Last updated: November 5, 2026*

Popcorn is an open-source browser extension and local companion app. It doesn't collect, sell or
share personal data. It has no accounts, analytics or tracking, and no Popcorn server: the author
never receives anything from your use of it.

## What the extension reads

- **The YouTube page you're on:** the video's ID, the player's current time, and whether an ad is
  showing. It uses these to show facts at the right moment.
- It sends the video ID to **the Popcorn companion app on your own computer** at
  `http://127.0.0.1:8931`, and nowhere else.

## What the companion app does

- It reads the public details and captions of that video from YouTube.
- It sends that video information to **the research engine you chose**: Claude Code (Anthropic),
  Codex CLI (OpenAI), or OpenRouter. Those services handle it under their own privacy policies and
  your agreement with them. If you add a transcription key (Groq, OpenAI or ElevenLabs), audio from a
  video that has no captions goes to that service.
- It stores the facts it writes, your settings and any API keys in `~/.popcorn` on your computer.
  Delete that folder to remove everything.

## Permissions the extension asks for

- **Access to `http://127.0.0.1:8931`:** to talk to the companion app on your computer.
- **`storage`:** to remember which version of the extension is loaded.
- **`alarms`:** to check once a minute whether a locally installed copy has been updated.
- **youtube.com pages:** to draw the cards over the video player.

## Contact

Open an issue at https://github.com/joewilsonai/popcorn/issues
