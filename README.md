# typeStorming

**Markdown-First Mind Storming**

typeStorming is a web application where the **source of truth is a Markdown file** using a human-readable graph notation. It seamlessly bridges the gap between text-based thinking and visual mind-mapping.

## 🚀 The Goal

**Markdown in, visual graph out — editable from either side.**

Traditional mind-mapping tools often lock your data in proprietary formats. typeStorming keeps your data in plain text, making it version-control friendly and readable in any text editor.

## ✨ Features

-   **Markdown Graph Notation**: Simple syntax to define nodes and relationships directly in Markdown.
-   **Visual Rendering**: Automatically converts your Markdown into a generic node-link diagram.
-   **Intuitive Editor**: Manipulate the graph visually without needing to type raw syntax manually.
-   **Keyboard-Driven**:
    -   `Tab`: Create a child node.
    -   `Shift + Tab`: Create a sibling node.
    -   `Shift + Enter`: Create an independent node or edit the selected node.
    -   `Arrow Keys`: Navigate spatially.
-   **Bi-directional Sync**: Changes in the visual canvas update the Markdown, and vice-versa.
-   **Local-First**: Your data stays as a local `.md` file.

## 🛠️ Graph Syntax

The application uses a custom Markdown-friendly syntax:

### 1. Nodes
```markdown
NodeID[title: "My Node", body: "Description goes here"]
```

### 2. Relationships
```markdown
A --> B                 # Unlabeled arrow
A -[connects to]-> B    # Labeled arrow
```

## 📦 Installation & Setup

1.  **Clone the repository**
    ```bash
    git clone https://github.com/gitong/typestorming.git
    cd typestorming
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Run the development server**
    ```bash
    npm run dev
    ```

4.  **Open in Browser**
    Visit `http://localhost:5173` (or the URL shown in your terminal).

## 📂 Project Structure

-   `src/parser.js`: Parses Markdown text into graph data.
-   `src/renderer.js`: Handles visual rendering of nodes and edges on the canvas.
-   `src/layout.js`: Manages the spatial arrangement of nodes (auto-layout).
-   `src/input.js`: Handles keyboard and mouse interactions.
-   `src/graph.js`: Core data structure for the graph.
-   `spec.md`: Detailed Gherkin-style specification of features.

## 🤝 Contributing

Contributions are welcome! Please check out `spec.md` to understand the current feature set and roadmap.

## 📄 License

[MIT License](LICENSE)
