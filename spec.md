# typeStorming — Specification
### version 0.0.1
### Gherkin Format Specification


## Context: Markdown-First Mind Storming

**The Problem:** Traditional mind-mapping tools lock your data inside proprietary formats. You can't read, version-control, or edit your graphs with a text editor.

**The Solution:** A web app where the **source of truth is a Markdown file** using a human-readable graph notation. The app's job is: 
(1) **render** the markdown into a visual canvas, and 
(2) provide an **intuitive editor** to manipulate the markdown without the user needing to type raw syntax. 
(3) **frictionless capture** the ideation session with visual canvas.

**The Goal:** Markdown in, visual graph out — editable from either side.

---

## Core Concept: Markdown Graph Notation

All graph data is stored as plain Markdown text (`.md` files) in the app's **dedicated data folder**, keeping your storming files separate from other applications. Each file uses the following syntax:

### Phase 1 — Define Nodes

Nodes are declared first, each with a **title** and **body**:

```
NodeID[title: "...", body: "..."]
```

- **NodeID** — a short unique identifier for the node.
- **title** — the display name of the node.
- **body** — the descriptive content inside the node.

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
A[title: "Define the problem", body: "Identify the core pain point and scope"]
B[title: "Research solutions", body: "Survey existing tools and approaches"]
C[title: "Prototype v1", body: "Build a quick proof-of-concept"]
D[title: "Write documentation", body: "Document findings and decisions"]

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
**Then** each `NodeID[title, body]` declaration should appear as a visual node on the canvas
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

### Scenario: Creating a child node (Tab)

**Given** the user has selected an existing node A
**When** the user presses `Tab`
**Then** a new node declaration `NewNode[title: "", body: ""]` should be appended to the Nodes section
**And** a new relationship `A --> NewNode` should be appended to the Relationships section
**And** the focus should shift to the new node for title input

### Scenario: Creating a sibling node (Shift + Tab)

**Given** the user is focused on a child node A that has a parent node P
**When** the user presses `Shift + Tab`
**Then** a new node declaration `B[title: "", body: ""]` should be appended to the Nodes section
**And** a new relationship `P --> B` should be appended to the Relationships section
**And** focus should shift to node B

### Scenario: Creating an independent node (Shift + Enter)

**When** the user presses `Shift + Enter`
**Then** a new unlinked node should appear on the canvas
**And** a standalone node declaration `NewNode[title: "", body: ""]` should be appended to the Nodes section (with no relationship)
**And** focus should shift to the new node

### Scenario: Adding a label to a relationship

**Given** two nodes A and B are connected by an unlabeled relationship (`A --> B`)
**When** the user selects the relationship line and types a label
**Then** the relationship in the markdown should update from `A --> B` to `A -[label]-> B`
**And** the label should be displayed along the arrow on the canvas

### Scenario: Editing node content inline

**Given** the user double-clicks (or presses Enter on) an existing node
**When** the user edits the node's title or body
**Then** the corresponding `NodeID[title: "...", body: "..."]` line in the Nodes section should be updated

---

## Feature 3: Keyboard-Driven Canvas Interaction

### Scenario Outline: Creating nodes via keyboard shortcuts

**Given** the user is focused on Node <CurrentNode>
**When** the user presses the "<Shortcut>" key combination
**Then** a <NodeType> should be created
**And** the relationship status should be "<RelationshipStatus>"
**And** the correct markdown should be appended to the Nodes and Relationships sections
**And** the cursor flow should follow this sequence:

1. **Cursor on title** — the user types the node title
2. **`Enter`** — moves cursor to the **body** field
3. **`Enter`** — moves cursor to the **relationship label** field
4. **`Enter`** — submits the node (completes creation)

> **`Shift + Enter`** at any step → **quick submit**: immediately creates the node, leaving any remaining fields empty (body = empty, relationship = unlabeled)

**Examples:**
| CurrentNode | Shortcut       | NodeType          | RelationshipStatus       |
| :---------- | :------------- | :---------------- | :----------------------- |
| Root        | `Tab`          | Child Node        | Linked from Root         |
| Root        | `Ctrl + Enter` | Independent Node  | Unlinked (standalone)    |
| Node A      | `Tab`          | Child Node        | Linked from Node A       |
| Node A      | `Shift + Tab`  | Sibling Node      | Linked to Parent of A    |
| Any Node & Edge | `Shift + Enter`| —             | Edit Mode (node & relationship) |

---

### Scenario: Edit Mode (Shift + Enter)

**Given** the user has selected an existing node
**When** the user presses `Shift + Enter`
**Then** the cursor should enter **edit mode** on the selected node's **title** field
**And** `Enter` moves the cursor to the **body** field
**And** `Enter` again exits edit mode and commits changes to the markdown

### Scenario: Navigating relationships with Shift + Arrow

**Given** the user has selected a node with one or more relationships
**When** the user presses `Shift + Arrow` key
**Then** the selection should move to the **relationship edge** in that direction
**And** the relationship label should become editable
**And** `Shift + Arrow` again moves to the **next connected relationship**

**Examples:**
| Shortcut              | Action                                         |
| :-------------------- | :--------------------------------------------- |
| `alt + Right`       | Select the outgoing relationship to the right   |
| `alt + Left`        | Select the outgoing relationship to the left    |
| `alt + Up`          | Select the relationship to the parent node      |
| `alt + Down`        | Select the relationship to the first child node, and follow by next child node |

---

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

## Feature 4: Quick Search and Linking

### Scenario: Quick Add Relationship 

**Given** the user is focused on Node A
**When** the user triggers the "Quick add relationship" keyboard shortcut
**Then** a spotlight-style search popup should appear (centered, floating overlay)

**When** the user types in the search field
**Then** the list should filter existing nodes in real-time by matching title or body text

**When** the user navigates the results using `Arrow Up` / `Arrow Down`
**And** presses `Enter` to select Node B
**Then** a relationship `A --> B` should be appended to the Relationships section of the markdown
**And** the spotlight popup should close
**And** the canvas should re-center to show both nodes

---

## Feature 5: Automatic Layout

### Scenario: Tension-based auto-layout

**Given** the canvas has multiple nodes and relationships
**When** a new node or relationship is added
**Then** the system should calculate the optimal spatial distribution using a tension-based algorithm
**And** the nodes should animate smoothly to their new positions to prevent overlap

### Scenario: User-adjusted layout preference

**Given** the auto-layout has positioned nodes on the canvas
**When** the user manually drags or rearranges nodes to a preferred composition
**Then** the system should record the new spatial proportions as a **layout preference**
**And** when auto-layout recalculates (e.g. after adding a new node), it should respect the user's preferred proportions
**And** new nodes should be placed in a way that maintains the overall composition the user established
---

## Feature 6: Node & Relationship Management

### Scenario: Creating a relationship between two existing nodes

**Given** the user has selected Node A
**And** the user has selected Node B (multi-selection)
**When** the user presses `Enter`
**Then** the cursor should be placed on the **label field** of the new relationship
**And** the relationship should be displayed on the canvas as a pending connection

**When** the user presses `Enter` without typing any text
**Then** an unlabeled relationship `A --> B` should be appended to the Relationships section

**When** the user types a label and presses `Enter`
**Then** a labeled relationship `A -[label]-> B` should be appended to the Relationships section

### Scenario: Deleting a node

**Given** the user right-clicks on a node (or presses `Delete`)
**When** the user confirms deletion
**Then** the node declaration should be removed from the Nodes section
**And** all relationships referencing that node should be removed from the Relationships section
**And** the canvas should re-render

---

## Feature 7: Canvas ↔ Markdown View Toggle

### Scenario: Switching to Markdown editor view

**Given** the user is viewing the **Canvas** (default view)
**When** the user clicks the **view toggle button** (or presses a keyboard shortcut)
**Then** the view should switch to a **Markdown editor** showing the raw graph notation
**And** the toggle button should indicate the current view mode

### Scenario: Switching back to Canvas view

**Given** the user is viewing the **Markdown editor**
**When** the user clicks the **view toggle button** (or presses the same keyboard shortcut)
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
**When** the user clicks the **Copy** button (or presses `Ctrl + C` with no text selected)
**Then** the entire markdown content should be copied to the clipboard
**And** a brief confirmation toast should appear

### Scenario: Paste markdown from clipboard

**Given** the user is in the **Markdown editor** view
**When** the user pastes text from the clipboard (`Ctrl + V`)
**Then** the pasted markdown should replace or merge into the current content
**And** switching to Canvas view should render the updated graph

---

## Non-Functional Requirements

| Requirement       | Detail                                                                 |
| :---------------- | :--------------------------------------------------------------------- |
| Data format       | Plain Markdown (`.md` file), human-readable, git-friendly              |
| Storage           | Local-first; file lives on disk or in browser storage                  |
| Portability       | The `.md` file is self-contained — readable in any text editor         |
| Real-time sync    | Canvas ↔ Markdown are always in sync; edits in either propagate instantly |
