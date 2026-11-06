# Publishing Popcorn to the Chrome Web Store

Everything you paste into the developer dashboard is below, in the order the dashboard asks for it.

## One-time setup (the account owner does this)

1. Turn on **2-Step Verification** on the Google account you'll publish from.
2. Go to the Chrome Web Store developer dashboard: https://chrome.google.com/webstore/devconsole
3. Accept the developer agreement and pay the one-time registration fee ($5), then finish any
   identity verification it asks for.

## Each release

1. Bump `"version"` in `extension/manifest.json` (the store rejects a repeated version number).
2. Build the zip: `./scripts/package-extension.sh` writes `dist/popcorn-extension-<version>.zip`.
3. In the dashboard: **New item**, then upload the zip. For later releases, open the item and go to
   **Package > Upload new package**.
4. Fill in the tabs using the text below, then **Submit for review**. Reviews usually take a few days.
   An extension that talks to a local app can get a question or two from the reviewer. The
   description below says up front that the companion app is required, and that's the part
   reviewers look for.

## Store listing tab

**Name:** Popcorn: facts that pop up over YouTube

**Summary** (132 characters max):
> Researched facts pop up over YouTube videos as you watch. Runs on your own Claude, ChatGPT or OpenRouter account.

**Category:** Productivity (or Education)

**Language:** English

**Description:**

```text
Remember Pop-Up Video? Popcorn brings it to anything on YouTube, except the bubbles are researched.

Click 🍿 on a video. Popcorn reads the transcript, researches the video on the web, and pins each
fact to the moment its subject comes up: the backstory, who the people are, the numbers behind the
claims, what happened after the video was made, and where the video is wrong. Every card links its
source.

• Facts follow the video. Pause and they wait, scrub and they follow.
• Works in fullscreen and on Shorts, and stays out of the way during ads.
• Cards size themselves to your player.
• See every fact in a list and jump to any one.

REQUIRES THE FREE POPCORN COMPANION APP
Popcorn does its research on your own computer, with the AI you already use: Claude Code on a Claude
Pro or Max plan, Codex on a ChatGPT Plus or Pro plan, or your own OpenRouter key. Install the
companion app (macOS or Linux) first:
https://github.com/joewilsonai/popcorn

No accounts, no tracking, no Popcorn servers. Open source under the MIT license.

Popcorn is an independent project and is not affiliated with YouTube or Google.
```

**Graphics:**
- Store icon: `extension/icons/128.png`
- Screenshot (1280x800): `docs/art/hero.png`
- Small promo tile (440x280): `docs/art/promo-440x280.png`

**Homepage URL:** https://github.com/joewilsonai/popcorn
**Support URL:** https://github.com/joewilsonai/popcorn/issues

## Privacy tab

**Single purpose:**
> Shows researched, time-pinned facts as overlays on YouTube videos while they play. The facts come
> from a companion app on the user's own computer.

**Permission justifications:**

| Permission | Justification |
|---|---|
| `host_permissions: http://127.0.0.1:8931/*` | Talks only to the Popcorn companion app on the user's own computer, which does the research and stores the facts. Nothing is sent to remote servers. |
| `storage` | Remembers which version of the extension is loaded, so a locally installed copy can reload itself after the user updates it. |
| `alarms` | Checks once a minute whether a locally installed copy has been updated. This does nothing for copies installed from the Web Store. |
| Content script on `youtube.com` | Reads the current video's ID and playback time, and draws the fact cards over the player. |

**Remote code:** No. All code is in the package.

**Data usage:** tick **none** of the data categories. The extension sends the video ID only to
`127.0.0.1`, on the user's own machine. Then certify all three statements: the data isn't sold, isn't
used for unrelated purposes, and isn't used for creditworthiness.

**Privacy policy URL:** https://github.com/joewilsonai/popcorn/blob/main/PRIVACY.md

## Distribution tab

Choose **Public**, with all regions available.

## After it's live

- Add the store link to the README's install section.
- The installer and `AGENT_SETUP.md` still describe Load unpacked, and that keeps working. Store
  copies update through the store, and unpacked copies follow `git pull`.
