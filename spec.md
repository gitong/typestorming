# typeStorming — Specification
### version 0.0.1
### Gherkin Format Specification


## Context: Markdown-First Mind Storming

**The Problem:**
1. **Lack of smooth ideation through typing:** Traditional visual tools often interrupt your flow with mouse-heavy interactions.
2. **Vendor data lock-in:** Traditional mind-mapping tools lock your data inside proprietary formats. You can't read, version-control, or edit your graphs with a text editor.

**The Solution:** A web app where the **source of truth is a Markdown file** using a human-readable graph notation. The app's job is: 
(1) **render** the markdown into a visual canvas, and 
(2) provide an **intuitive editor** to manipulate the markdown without the user needing to type raw syntax. 
(3) **frictionlessly capture** the ideation session with visual canvas.

**The Goal:** Markdown in, visual graph out — editable from either side.

---

## Core Concept: Markdown Graph Notation

All graph data is stored as plain Markdown text (`.md` files) in the app's **dedicated data folder**, keeping your storming files separate from other applications. Each file uses the following syntax:

### Phase 1 — Define Nodes

Nodes are declared first, containing a **Title** and **Body**:

```
NodeID[#Title is Here; Body Content is here]
```

- **NodeID** — a short unique identifier for the node.
- **Title** — the display name of the node. Starts with a markdown header (e.g., `#`, `##`) to denote node importance or hierarchy.
- **Body** — the descriptive content inside the node, separated from the title by a semicolon (`;`).

### Phase 2 — Register Relationships

After all nodes are defined, relationships are registered between them:

```
A --> B                # unlabeled relationship
A -[label]-> B         # labeled relationship
```

- `-->` creates an **unlabeled** directed edge from A to B.
- `-[label]->` creates a **labeled** directed edge, where `label` describes the relationship.

### Full Example

```markdown
## Nodes
A[#Define the problem; Identify the core pain point and scope]
B[#Research solutions; Survey existing tools and approaches]
C[#Prototype v1; Build a quick proof-of-concept]
D[#Write documentation; Document findings and decisions]

## Relationships
A -[leads to]-> B
A -[leads to]-> C
B --> C
C --> B
B -[opposite]-> D
D -[return]-> A
```

This produces:
- **4 nodes**: A, B, C, D — each with their own title and body
- **6 edges**:
  - `A -[leads to]-> B` — labeled
  - `A -[leads to]-> C` — labeled
  - `B --> C` — unlabeled
  - `C --> B` — unlabeled
  - `B -[opposite]-> D` — labeled
  - `D -[return]-> A` — labeled

---

## Feature 1: Markdown Rendering

The app **reads** the markdown text and **renders** it as a visual node-and-edge graph on a canvas.

### Scenario: Loading a markdown file

**Given** the user opens or pastes valid markdown graph text
**When** the app processes the text
**Then** each `NodeID[#Title; Body]` declaration should appear as a visual node on the canvas
**And** each `-->` or `-[label]->` should appear as a directional arrow between the corresponding nodes
**And** labeled edges should display their label text along the arrow path

### Scenario: Re-rendering on change

**Given** the markdown text is modified (by the user or the editor)
**When** a change is detected
**Then** the canvas should re-render to reflect the updated graph
**And** existing node positions should be preserved where possible

### Scenario: Handling duplicate node IDs

**Given** the same `NodeID` is declared more than once in the Nodes section
**When** the app renders the graph
**Then** only the **first declaration** should be used
**And** subsequent declarations with the same ID should be ignored or flagged as a warning

### Scenario: Rendering Reciprocal Relationships

**Given** two nodes A and B have a bidirectional relationship (`A --> B` and `B --> A`)
**When** the app renders the edges
**Then** the edges should be curved away from each other to prevent overlap
**And** arrowheads should clearly indicate direction
**And** labels should be positioned along the curved path

---

## Feature 2: Intuitive Markdown Editing

The app provides a **visual interface** so users can build and edit the graph without manually typing the arrow syntax. Every visual action produces valid markdown text.

### Interaction Modes

The canvas operates in one of three distinct modes. The current mode determines how keyboard shortcuts behave:

1. **Select Mode** (default) — A node is highlighted but not being edited. Arrow keys navigate, `Enter` creates siblings, `Tab` re-parents node as child of previous sibling.
2. **Edit Mode** — The user is actively typing inside a node (title or body). Text input is captured by the node.
3. **Edge Label Mode** — The cursor is on a relationship edge, awaiting label input.

### Scenario: Auto-generating NodeID

**When** a new node is created by any mechanism (Enter, Tab, etc.)
**Then** a unique `NodeID` should be automatically generated (e.g., sequential: `n1`, `n2`, `n3`…)
**And** the user should never need to manually type or manage NodeIDs

### Scenario: Creating a new sibling node (Enter) — Select Mode

**Given** the user is in **Select Mode** focused on a node A
**When** the user presses `Enter`
**Then** a new node declaration `NewNode[#; ]` should be appended to the Nodes section
**And** it should be created at the same hierarchical level as node A
**And** the app transitions to **Edit Mode** on the new node for title input

### Scenario: Indenting to a child node (Tab) — Select Mode

**Given** the user is in **Select Mode** focused on a node B that immediately follows node A
**When** the user presses `Tab`
**Then** node B is indented and becomes a child of node A
**And** a relationship `A --> B` should be added to the Relationships section

### Scenario: Outdenting to a sibling node (Shift + Tab) — Select Mode

**Given** the user is in **Select Mode** focused on a child node B that has a parent node A
**When** the user presses `Shift + Tab`
**Then** node B is outdented to become a sibling of node A
**And** the relationship in the markdown updates accordingly

### Scenario: Editing node content inline (Space) — Select Mode → Edit Mode

**Given** the user is in **Select Mode** with a node selected
**When** the user presses `Space` (or double-clicks)
**Then** the node enters **Edit Mode** **directly within the node itself (no popups or external modals)** for its title
**When** the user presses `;` or `` ` `` while typing the title
**Then** the editor shifts to editing the body content of the node inline
**And** the corresponding `NodeID[#Title; Body]` line in the Nodes section should be updated interactively

### Scenario: Completing a node edit and labeling the relationship — Edit Mode → Edge Label Mode

**Given** the user is in **Edit Mode** editing a node (title or body)
**When** the user presses `Enter` to complete the node editing process
**Then** the node's content is finalized
**And** the cursor automatically jumps to the **most recently created** relationship edge connected to this node, entering **Edge Label Mode**
**And** the user can type to define a relationship label, pressing `Enter` to finalize
**And** if nothing is typed before pressing `Enter`, it falls back to an unlabeled relationship
**And** after finalizing, the app returns to **Select Mode**

### Scenario: Canceling edit or edge label (Escape)

**Given** the user is in **Edit Mode** or **Edge Label Mode**
**When** the user presses `Escape`
**Then** the current editing action is canceled (reverted to the last saved state)
**And** the app returns to **Select Mode**

### Scenario: Linking an existing related node (Ctrl + Enter) — Edit Mode

**Given** the user is in **Edit Mode** editing a node (title or body)
**When** the user presses `Ctrl + Enter`
**Then** a spotlight search bar appears to find existing nodes
**When** the user types to find a related node and presses `Enter` to select it
**Then** the selected node is placed as a related node
**And** a relationship is seamlessly appended to the markdown
**And** the app returns to **Select Mode**

### Scenario: Undo and Redo

**When** the user presses `Ctrl + Z`
**Then** the last action (node creation, edit, indent, relationship change, deletion) is undone
**And** both the canvas and the markdown revert accordingly

**When** the user presses `Ctrl + Shift + Z` (or `Ctrl + Y`)
**Then** the last undone action is reapplied

---

## Feature 3: Keyboard-Driven Canvas Interaction

### Scenario Outline: Modifying nodes via keyboard shortcuts

**Given** the user is interacting with Node <CurrentNode>
**When** the user presses the "<Shortcut>" key combination
**Then** the specified <Action> should occur
**And** the corresponding updates in the Markdown should be applied

**Examples (Select Mode):**
| CurrentNode  | Shortcut       | Action               | Explanation                                  |
| :----------- | :------------- | :------------------- | :------------------------------------------- |
| Any Node     | `Enter`        | Create Sibling       | Creates a new node at the same level         |
| Any Node     | `Tab`          | Indent to Child      | Moves node to be a child of the previous node|
| Child Node   | `Shift + Tab`  | Outdent to Sibling   | Moves node back to be a sibling              |
| Any Node     | `Space`        | Edit Node            | Enters Edit Mode within the node             |
| Any Node     | `Delete`       | Delete Node          | Removes node and its relationships           |
| Any Node     | `Escape`       | Deselect             | Clears the current selection                 |

**Examples (Edit Mode):**
| CurrentNode  | Shortcut       | Action               | Explanation                                  |
| :----------- | :------------- | :------------------- | :------------------------------------------- |
| Editing Node | `;` or `` ` `` | Edit Body Content    | Shifts focus from title to body input        |
| Editing Node | `Enter`        | Finish & Label Edge  | Completes edit, jumps to Edge Label Mode     |
| Editing Node | `Ctrl + Enter` | Link Existing Node   | Opens spotlight search to find & link a node |
| Editing Node | `Shift + Enter`| Insert New Line      | Inserts new line in text editor              |
| Editing Node | `Escape`       | Cancel Edit          | Reverts changes, returns to Select Mode      |

**Examples (Edge Label Mode):**
| CurrentNode  | Shortcut       | Action               | Explanation                                  |
| :----------- | :------------- | :------------------- | :------------------------------------------- |
| Edge Label   | `Enter`        | Finish Edge Label    | Finalizes the edge (unlabeled if blank)      |
| Edge Label   | `Escape`       | Cancel Label         | Cancels label entry, returns to Select Mode  |

### Scenario Outline: Spatial vs. Logical Navigation

**Given** the canvas has multiple nodes arranged in a cluster
**And** Node A is currently selected

#### Arrow Keys — Spatial Proximity

**When** the user presses an arrow key, selection moves to the **nearest node in that spatial direction**.

| ArrowKey  | TargetNode                  | NavigationLogic   |
| :-------- | :-------------------------- | :---------------- |
| `Right`   | Closest Node to the Right   | Spatial Proximity |
| `Left`    | Closest Node to the Left    | Spatial Proximity |
| `Up`      | Closest Node Above          | Spatial Proximity |
| `Down`    | Closest Node Below          | Spatial Proximity |

#### Shift + Arrow Keys — Logical Hierarchy

**When** the user presses `Shift + Arrow`, selection moves based on the **graph's logical structure**.

| Shortcut        | TargetNode                                  | NavigationLogic    |
| :-------------- | :--------------------------------------     | :----------------- |
| `Shift + Up`    | Parent Node                                 | Logical Hierarchy  |
| `Shift + Down`  | First Child Node                            | Logical Hierarchy  |
| `Shift + Right` | Next Sibling (clockwise, spatially)         | Logical Hierarchy  |
| `Shift + Left`  | Prev Sibling (counterclockwise, spatially)  | Logical Hierarchy  |

---

## Feature 4: Quick Search and Linking Bar

### Scenario: Global Quick Search & Jump (Ctrl + K)

**When** the user presses `Ctrl + K`
**Then** a quick search bar appears (spotlight style)
**And** matching a keyword instantly highlights, selects, and jumps to that node
**And** from the quick search bar, pressing `Tab` creates a new child node **of the matched/selected node**
**Or** the user can connect the current node to an existing node


### Scenario: Quick Connect (Ctrl + Enter from Edit Mode)

**Given** the user is in **Edit Mode** on Node A
**When** the user presses `Ctrl + Enter`
**Then** the spotlight quicksearch popup appears specifically to link nodes
**When** the user searches for and selects Node B
**Then** a relationship `A --> B` is seamlessly appended in the markdown
**And** the canvas visually draws the edge and re-centers if necessary

---

## Feature 5: Automatic Layout & Organization

### Scenario: Dynamic Auto-layout (D3.js Force Simulation)
**Given** the canvas has multiple nodes, edges, or clusters
**When** a new element is added
**Then** the system recalculates the layout using D3.js force simulation
**And** the layout algorithm considers:
- **Relative distance** or **Fixed distance (opt-in)**
- Maintaining established distances between elements
- **Weighted importance** derived from Heading levels (`#`, `##`) and content volume
**And** disconnected nodes automatically receive a static, aligned position unless manually dragged

### Scenario: Collapsible & Semantic Zooming
**When** a user collapses a node
**Then** its children hide, unless explicitly **Pinned** (anchored positional override)
**And** `Ctrl + Shift + 0` mass-collapses to main roots (`+` increases expansion, `-` collapses further)
**When** the user zooms out (Gmaps-style)
**Then** visually less important nodes (with lower headings) fade out
**And** at high zoom levels, only top tier `#` (H1) Heading nodes remain visible

### Scenario: Clustering
**When** the user groups nodes based on Label or Selection
**Then** a **Cluster** is formed (which supports nested clusters)
**And** the overall layout dynamically adjusts around this cluster
**And** AI can recommend natural clustering groups based on node content

### Scenario: Bulk Heading Adjustment
**When** multiple nodes are selected
**Then** a bulk operation can demote or promote their heading hierarchy, adjusting their visual importance score without changing the core text content

---

## Feature 6: Node & Relationship Management

### Scenario: Initiating a relationship between two existing nodes (Multi-select)

**Given** the user is in **Select Mode** and has selected Node A
**And** the user holds `Shift` and clicks Node B (multi-selection)
**When** the user presses `Enter`
**Then** the app transitions to **Edge Label Mode** on the new pending connection
**And** the relationship should be displayed on the canvas as a pending connection

### Scenario: Confirming an unlabeled relationship

**Given** the user is in **Edge Label Mode** for a pending connection between Node A and Node B
**When** the user presses `Enter` without typing any text
**Then** an unlabeled relationship `A --> B` should be appended to the Relationships section
**And** the app returns to **Select Mode**

### Scenario: Confirming a labeled relationship

**Given** the user is in **Edge Label Mode** for a pending connection between Node A and Node B
**When** the user types a label and presses `Enter`
**Then** a labeled relationship `A -[label]-> B` should be appended to the Relationships section
**And** the app returns to **Select Mode**

### Scenario: Deleting a node

**Given** the user is in **Select Mode** with a node selected
**When** the user presses `Delete` (or `Backspace`)
**Then** the node declaration should be removed from the Nodes section
**And** all relationships referencing that node should be removed from the Relationships section
**And** any child nodes of the deleted node should be **re-parented** to the deleted node's parent (or become root-level nodes if no parent exists)
**And** the canvas should re-render
**And** `Ctrl + Z` can undo this action

---

## Feature 7: Canvas ↔ Markdown View Toggle

### Scenario: Switching to Markdown editor view

**Given** the user is viewing the **Canvas** (default view)
**When** the user clicks the **view toggle button** (or presses `Ctrl + M`)
**Then** the view should switch to a **Markdown editor** showing the raw graph notation
**And** the toggle button should indicate the current view mode

### Scenario: Switching back to Canvas view

**Given** the user is viewing the **Markdown editor**
**When** the user clicks the **view toggle button** (or presses `Ctrl + M`)
**Then** the view should switch back to the **Canvas** rendering
**And** all edits made in the Markdown editor should be reflected on the canvas

### Scenario: Live sync between views

**Given** the user edits text in the Markdown editor view
**When** the user switches back to Canvas view
**Then** the canvas should render the updated graph immediately
**And** no data should be lost during the view switch

### Scenario: Download as Markdown file

**Given** the user is in the **Markdown editor** view
**When** the user clicks the **Download** button (or presses `Ctrl + S`)
**Then** the current markdown content should be downloaded as a `.md` file
**And** the filename should match the storming session name

### Scenario: Copy markdown to clipboard

**Given** the user is in the **Markdown editor** view
**When** the user clicks the **Copy** button (or presses `Ctrl + Shift + C` with no text selected)
**Then** the entire markdown content should be copied to the clipboard
**And** a brief confirmation toast should appear

> **Note:** `Ctrl + Shift + C` is used instead of `Ctrl + C` to avoid overriding the default OS copy behavior when no text is selected.

### Scenario: Paste markdown from clipboard

**Given** the user is in the **Markdown editor** view
**When** the user pastes text from the clipboard (`Ctrl + V`)
**Then** the pasted markdown should replace or merge into the current content
**And** switching to Canvas view should render the updated graph

---

## Feature 8: Merge & Split Functions

### Scenario: Interactive Merging
**Given** the user selects nodes (via spatial lasso or connected edges)
**When** the user activates the merge function
**Then** the nodes combine while keeping their historical lineage
**And** merging options include:
- Auto-merge headings with headings, content with content
- AI-recommended unified heading and content
- Manual rewrite of one or both nodes

### Scenario: Splitting Nodes
**When** the user splits a node
**Then** the historical connection is maintained
**And** a new edge automatically connects the split results to the specified parent

---

## Feature 9: Visual Properties & Aesthetics

* **Edge Aesthetics:** Simple line, bold, filled bold, dashed, or crossing paths. Arrows can have a "clean infographic" or "natural hand-drawn" style.
* **Arrow Centering:** Edges aim for the absolute center of the bubble, optionally penetrating slightly inside the border for a natural connection.
* **Pin Properties:** Anchors position securely against auto-layout changes and prevents hiding during parent collapses.
* **Node Container Width:** Nodes have a maximum width of approximately 6 words. Text will automatically wrap to the next line if it exceeds this width, ensuring all content remains neatly confined within the node container.
* **Node Metadata:** Supports custom properties including Labels, Descriptions, Time, Date, and other metrics.

---

## Feature 10: Multiple Format Views

1. **Mindmap (Default):** Relative locations with the first node automatically pinned to the center.
2. **Linear / Block Editor:** Node editor style similar to Obsidian block mode. Links are presented visually inline like `<-[:link:]` or `[:link:]->`, but are always saved in the Markdown Relationships section to preserve the single source of truth.
3. **Kanban Version:** Card-based rendering akin to Miro planning boards.
4. **Focus Mode:** High-level bubbles can be clicked to enter an isolated detail page context.

---

## Feature 11: Braindump Use Case

* Built for rapid text entry in list/content form (brainstorming style).
* Unconnected text entries automatically align to a static position unless mapped.
* Includes AI function to subsequently parse the text blocks into distinct node clusters.

---

## Tech Stack

| Technology | Purpose                                                                 |
| :--------- | :---------------------------------------------------------------------- |
| **Vite**   | Dev server and build tooling                                            |
| **D3.js**  | Canvas rendering, force-directed layout, zoom/pan, and node interaction |
| **Vanilla JS** | Core application logic — no framework dependency                    |
| **Vanilla CSS** | Styling — no utility-class framework                               |

---

## Non-Functional Requirements

| Requirement       | Detail                                                                 |
| :---------------- | :--------------------------------------------------------------------- |
| Data format       | Plain Markdown (`.md` file), human-readable, git-friendly              |
| Storage           | Local-first; file lives on disk or in browser storage                  |
| Portability       | The `.md` file is self-contained — readable in any text editor         |
| Real-time sync    | Canvas ↔ Markdown are always in sync; edits in either propagate instantly |
| Undo/Redo         | Full undo/redo history for all canvas and markdown mutations           |
| Accessibility     | All core features must be operable via keyboard alone                  |
| Error handling    | Malformed markdown should degrade gracefully with inline warnings      |
