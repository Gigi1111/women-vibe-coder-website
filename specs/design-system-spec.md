# Design System Specification — Women Vibe Coders

## 🎨 Color Palette & Tokens
```css
:root {
  --bg-obsidian: #07090E;
  --card-slate: rgba(15, 23, 42, 0.75);
  --accent-violet: #A855F7;
  --accent-peach: #EC4899;
  --accent-cyan: #06B6D4;
  --text-main: #F8FAFC;
  --text-muted: #94A3B8;
  --border-glass: rgba(168, 85, 247, 0.2);
}
```

## 📐 Typography Hierarchy
- **Title (H1)**: 34pt / 42px bold sans-serif with gradient fill (`#F8FAFC` to `#A855F7`).
- **Section Headers (H2)**: 24pt / 32px semi-bold.
- **Body Text**: 16pt–18pt / 24px–28px regular for high legibility.
- **Card Subtext**: 14pt / 20px muted gray (`#94A3B8`).

## 🖼️ Iconography & Logo Mark
- **Official Mark**: `women_vibe_coders_logo_v5.png` (Single-line coffee cup + prompt chevron `>✦`).
- **Icon Style**: Clean vector lines with soft neon glow.

## 🎛️ Interaction Principles
- Hover scale (`transform: translateY(-4px)`) on resource cards and CTAs.
- Glassmorphic backdrop blur (`backdrop-filter: blur(12px)`).
- On-screen direct editing toggle (`contenteditable`) for live text updates.
