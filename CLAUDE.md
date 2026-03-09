# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (localhost:5173)
npm run build        # Production build
npm run preview      # Preview production build
npm test             # Run Playwright tests (headless, auto-starts dev server)
npm run test:headed  # Run tests with visible browser
npm run test:ui      # Open Playwright interactive UI
```

Tests live in `tests/`. `spec.md` contains the Gherkin-style feature specification they are based on.

## Architecture

TypeStorming is a markdown-first visual mind-mapping web app. The Markdown file is the single source of truth; the canvas is a synchronized view of it.

### Module Dependency Order

```
main.js
├── graph.js       (GraphModel — core data + pub/sub)
├── layout.js      (ForceLayout — D3 force simulation, imports graph.js)
├── renderer.js    (Renderer — D3 SVG, imports graph.js + layout.js)
└── input.js       (InputHandler — keyboard/mouse, imports all three)

parser.js          (standalone, imported by graph.js)
```

### Data Flow

```
Markdown text → parser.js → GraphModel → layout.js (D3 forces) → renderer.js (SVG)
                                 ↑                                        ↓
                           Input events ←←←←←← InputHandler ←←←←← User interaction
```

On any graph mutation, `GraphModel.notify()` triggers all subscribers. `main.js` wires auto-save (serializes back to Markdown → localStorage) and renderer redraws as subscribers.

### Core Modules

**`graph.js` — GraphModel**: Authoritative state. Node/edge CRUD, undo/redo (full-state snapshots, stack capped at 50), pub/sub via `subscribe()`/`notify()`. Hierarchy (parent/children/siblings) is inferred from edges, not stored explicitly. IDs are auto-incremented (`n1`, `n2`, …).

**`parser.js`**: Bidirectional Markdown ↔ GraphModel serialization. Node format: `NodeID[#Title; Body]` (heading level = `#` count). Edge formats: `A --> B` and `A -[label]-> B`.

**`renderer.js`**: D3 SVG with three stacked layers (edges → edge labels → nodes). Selected nodes expand to show full wrapped text. Drag pins `fx`/`fy` on the force simulation. Tracks `selectedNodeId` and `secondarySelectedNodeId` (Shift+Click).

**`layout.js`**: D3 force simulation (repulsion −800, link distance 300, collision radius 150). Performs BFS-based hierarchical seed positioning before letting forces refine. Existing positions are preserved on updates.

**`input.js`**: 3-mode state machine — `SELECT` (default), `EDIT` (inline title/body overlay), `EDGE_LABEL` (labeling a new or clicked edge). Key shortcuts drive all creation/navigation/linking.

**`main.js`**: Orchestration only — initializes modules in order, wires localStorage auto-save, handles view toggle (Editor ↔ Canvas), download/copy, and toast notifications.

### Key Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Enter | Create sibling / connect two selected nodes |
| Tab | Create child |
| Space | Edit selected node |
| `-` | Spotlight search (link nodes) |
| `\` | Switch title↔body in EDIT; confirm in EDGE_LABEL |
| Arrow keys | Spatial navigation (Shift = logical hierarchy) |
| Ctrl+Z / Ctrl+Y | Undo / Redo |
| Ctrl+M | Toggle Editor ↔ Canvas |
| Delete/Backspace | Delete node |

### Persistence

- **Auto-save**: GraphModel subscribers serialize to `localStorage` on every mutation.
- **Download**: Exports current Markdown via `main.js` button handler.
- **Load**: On init, `main.js` reads localStorage or falls back to a built-in example.
