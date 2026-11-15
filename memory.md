# Project Memory — Women Vibe Coders

The *why* behind the project: decisions, reasons and open questions. For brand and design rules see `CLAUDE.md`; for page details see `specs/`. Don't repeat those here.

---

## 1. Who this is for
- **Audience**: Women who want to make real tools with AI and have never coded (or haven't in years, or want to have a community).
- **Feeling we're going for**: A warm drink at a café table with friends, not a hackathon. No jargon, no gatekeeping, no pressure to be "technical."
- **Non-profit, volunteer-run.** Growth happens when members host their own small local meetups, not through a central team.

---

## 2. Key decisions and why

| Decision | Why |
| :--- | :--- |
| **One single-page site** (`index.html`) instead of a multi-page app | Fast to publish and easy for non-technical organizers to edit. The earlier 6-page plan (chapters, events, showcase, resources, about) was dropped as too much for launch. |
| **Luma for events, Discord for community** | Free tools members already use. Luma handles RSVPs and caps; Discord holds peer support and wins. The site points to them and doesn't rebuild them. |
| **Meetups capped at ~10 guests, 2 hours** | Small enough that everyone gets heard and helped; low effort for a first-time host. |
| **Link out to beginner guides** (LogicTrail, DataCamp) instead of writing our own course | Good guides already exist; our value is the community around learning, not the content. |
| **Removed the on-page Edit Mode** (2026-11-15) | Visitors don't need it, and it never saved anything. Copy changes are made in `index.html` and published with `/push`. Each text element keeps a `data-editable="key"` label so copy can be updated by name. |
| **Hosted on GitHub Pages** | Free, no build step, updates on every push to `main`. |
| **Logo cropped for web** (`assets/`) | The original PNG has lots of empty space and an AI-tool watermark in the corner. Web versions are cropped to the cup. Keep the original as the source file. |
| **Dropped Figma embeds and the `content.json` content store** | Overkill for a one-page site run by volunteers. Revisit only if the site grows. |

---

## 3. Current state
- **Live site**: https://gigi1111.github.io/women-vibe-coder-website/
- **Repo**: `Gigi1111/women-vibe-coder-website` (public), branch `main`.
- **Sections**: Hero → What is vibe coding (+ guide cards) → Host a meetup in 4 steps → Global radar map → Closing call to action.
- **Chapters**: Berlin (active, 49 members).

---

## 4. Open questions / to do
- [ ] **Luma and Discord buttons open a drawer but have no real invite links yet.** Add the actual Luma calendar URL and Discord invite.
- [ ] Host starter kit (`women_vibe_coders_intro_deck.pptx`) is mentioned in the host guide but doesn't exist yet.
- [ ] Custom domain (e.g. `womenvibecoders.org`)? If added, update the `og:url` / `og:image` tags in `index.html`.
- [ ] Code of Conduct page: needed before promoting meetups widely.
- [ ] `specs/site-spec.md` still calls the page `like.html`; `build-steps.md` describes the old plan. Both need refreshing.

---

## 5. Change log
- **2026-11-14**: Initial vision, design research and docs written.
- **2026-11-15**: Rebranded around women, moms and first-time builders; simplified to a single cozy landing page; new palette (obsidian, violet, peach, cyan).
- **2026-11-15**: Added logo, browser icon and share preview. Renamed `landing.html` to `index.html`. Published on GitHub Pages. Added a `/push` skill (commit and push, only when `/push` is typed).
- **2026-11-15**: Removed references to outside organizations from project docs.
- **2026-11-15**: Applied the new site copy; removed the Preview/Edit Mode toggle.
