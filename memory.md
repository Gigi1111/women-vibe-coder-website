# Project Memory & Context Log: Women Vibe Coding Platform

## 1. Project Context & Vision
- **Objective**: Create a community web platform for a **Women Vibe Coding group**.
- **Core Inspiration**:
  - **PyLadies Infrastructure**: Adopt PyLadies' proven global mentorship model (decentralized chapters, inclusive support network, regional event coordination, and welcoming onboarding).
  - **Vibe Coding Aesthetic**: Incorporate modern, award-winning UI trends (dark slate canvas, Bento grid layouts, glassmorphism borders, and interactive prompt/code terminal widgets).

---

## 2. Source Grounding & Research Synthesis

### 2.1 PyLadies Grounding (Source: PyLadies URL)
- **Mission**: Empower women and non-binary developers to become leaders in technology.
- **Structural Elements**:
  - Global chapter directory with clear status indicators (`Active`, `Launching`).
  - Chapter contact info & local community chat links (Slack/Discord).
  - Central event calendar & annual celebration highlights.
  - Open governance & welcoming Code of Conduct.

### 2.2 Web Research Findings
- **Bento Layout Patterns**: Modular grid organizing content into a 60/40 visual balance. High-priority cards (interactive terminals, live counts) get prominent space.
- **Dark Mode Palette**: Deep Slate (`#0B0F19`) background paired with translucent navy cards (`#161F33`), Neon Purple (`#A855F7`), and Electric Teal (`#14F195`).
- **Vibe Coding Identity**: Highlight real-time building, prompt engineering toolkits, member project showcases, and live interactive widgets.

---

## 3. Key Design & Feature Decisions

| Feature | User Requirement / Goal | Design Solution |
| :--- | :--- | :--- |
| **Chapter Radar** | See chapters & new events across locations | Interactive search map + filterable Event Radar |
| **Editable Text** | Make text easily editable & displayable | Dual system: `contenteditable` visual switch + `content.json` store + Quick Content Drawer |
| **Figma Integration**| Incorporate Figma into web platform | Figma Embed component (`<iframe>`) + 1:1 Design Token sync (`tokens.css`) |
| **Modern Aesthetics**| Fun, award-winning vibe | Bento Grid layout, neon accents, dark mode, interactive Vibe Terminal |

---

## 4. Change Log & History
- **2026-11-14**: Initial vision defined; PyLadies structure analyzed.
- **2026-11-14**: Conducted web research on Bento grids, dark mode tokens, and modern web UI trends.
- **2026-11-14**: Defined 6-page site outline (`/`, `/chapters`, `/events`, `/showcase`, `/resources`, `/about`).
- **2026-11-14**: Added Figma embed & direct inline editing (`contenteditable` + `content.json`) requirements.
- **2026-11-14**: Generated developer documentation (`CLAUDE.md`, `spec/*`, `memory.md`, `build-steps.md`).
