# Implementation Roadmap: Build Steps

## Phase 1: Foundation & Design Tokens Setup
- [x] **Step 1.1**: Define developer guidelines (`CLAUDE.md`) and project memory (`memory.md`).
- [x] **Step 1.2**: Write technical specifications (`spec/site-spec.md`, `spec/design-system.md`, `spec/content-cms-spec.md`).
- [ ] **Step 1.3**: Initialize project workspace with `tokens.css` (Dark slate `#0B0F19`, Neon Purple `#A855F7`, Electric Teal `#14F195`).
- [ ] **Step 1.4**: Establish `content.json` schema with baseline chapter data, events, and hero text.

## Phase 2: Core Component Construction
- [ ] **Step 2.1**: Build **Hero Section & Vibe Terminal Widget** (simulating live prompt execution and code generation).
- [ ] **Step 2.2**: Construct **Bento Grid System** (60/40 spatial ratio for metrics, events, and member builds).
- [ ] **Step 2.3**: Build **Interactive Chapter Explorer** (Search bar, region filters, chapter cards with status badges).
- [ ] **Step 2.4**: Build **Cross-Chapter Event Radar** (Filterable calendar by tag, one-click RSVP cards).

## Phase 3: Editable Text & Figma Integration
- [ ] **Step 3.1**: Implement **Inline Direct Direct-Editing (`contenteditable`) Switcher** (`[ Preview | Edit Mode ]`).
- [ ] **Step 3.2**: Implement **Quick Content Drawer** (Slide-out admin panel to add chapters/events/showcases).
- [ ] **Step 3.3**: Integrate **Figma Live Embed Viewer** container for design guidelines and prototype previewing.
- [ ] **Step 3.4**: Add **Export JSON** utility so edits made in browser can be saved directly.

## Phase 4: Polish & Prototype Verification
- [ ] **Step 4.1**: Audit responsive design across mobile, tablet, and desktop breakpoints.
- [ ] **Step 4.2**: Test dark-mode contrast ratios, glassmorphism borders, and neon hover glow effects.
- [ ] **Step 4.3**: Deliver interactive HTML web app artifact (`content_studio_web_craft` / standalone web artifact).
