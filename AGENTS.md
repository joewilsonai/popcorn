# Popcorn: notes for AI agents

**Asked to install or set up Popcorn for someone?** Follow [AGENT_SETUP.md](AGENT_SETUP.md) step by step.

**Working on the code?**

- `popcorn.py` holds everything server-side and uses only the Python standard library (3.9+). Keep
  it that way so install stays one command. It covers the CLI (`add`, `research`, `serve`, `list`,
  `doctor`, `config`, `set-key`), the research pipeline, the three engines and the HTTP server.
- Engines: `claude` and `codex` run the user's subscription CLIs headless with web search;
  `openrouter` uses an API key and the `openrouter:web_search` server tool. Order and fallback live in `engine_order()`: `auto` falls through the engines in order,
  and an explicit engine never spends anything else.
- `extension/` is the Chrome MV3 extension. `overlay.js` and `overlay.css` are shared with the
  companion page (`web/watch.html`), which loads them from `/ext/`. `content.js` only talks to the
  server through `bg.js`, because youtube.com can't reach localhost directly.
- Data and settings: `~/.popcorn` (`config.json`, `keys.env`, `facts/`, `work/<id>/` logs).
- Security rules to keep: the server accepts only the allowlisted Host headers and Origins (it
  defends against DNS rebinding and drive-by spending), video text is fenced as untrusted data in
  the prompt, and agent subprocesses get a scrubbed environment.
- After changing the code, check it with: `python3 -m py_compile popcorn.py`, `bash -n install.sh`,
  `python3 popcorn.py doctor`, then a real `python3 popcorn.py research <short video>`.
