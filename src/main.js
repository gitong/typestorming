/**
 * TypeStorming — Main Entry Point (v0.2.1)
 * Initializes graph, layout, renderer, and input handler.
 * Manages view toggle, download, copy, and auto-save.
 */

import { GraphModel } from './graph.js';
import { ForceLayout } from './layout.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';

// ───── Initialize Core ─────
const graph = new GraphModel();
const layout = new ForceLayout(graph);
layout.init();

const canvasContainer = document.getElementById('canvas-container');
const renderer = new Renderer(canvasContainer, graph, layout);

const inputHandler = new InputHandler(graph, layout, renderer);

// ───── UI Elements ─────
const viewToggleBtn = document.getElementById('view-toggle');
const downloadBtn = document.getElementById('download-btn');
const copyBtn = document.getElementById('copy-btn');
const editorContainer = document.getElementById('editor-container');
const markdownEditor = document.getElementById('markdown-editor');
const toast = document.getElementById('toast');

let isEditorView = false;

// ───── Layout tick → re-draw ─────
layout.onTick = () => renderer.draw();

// ───── Initial Data ─────
const savedData = localStorage.getItem('typestorming-data');
const newFormatTest = /^\w+\[#/m;  // Quick test: does it look like the new format?

if (savedData && newFormatTest.test(savedData)) {
  graph.loadMarkdown(savedData);
  markdownEditor.value = savedData;
} else {
  const initialData = `## Nodes
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
`;
  graph.loadMarkdown(initialData);
  markdownEditor.value = initialData;
}

layout.update();

// ───── Auto-save on graph changes ─────
graph.subscribe(() => {
  const md = graph.getMarkdown();
  localStorage.setItem('typestorming-data', md);
  if (isEditorView) {
    markdownEditor.value = md;
  }
});

// ───── View Toggle (Ctrl+M) ─────
function toggleView() {
  isEditorView = !isEditorView;
  if (isEditorView) {
    editorContainer.classList.add('visible');
    viewToggleBtn.textContent = 'Switch to Canvas (Ctrl+M)';
    downloadBtn.style.display = 'block';
    copyBtn.style.display = 'block';
    markdownEditor.value = graph.getMarkdown();
    markdownEditor.focus();
  } else {
    editorContainer.classList.remove('visible');
    viewToggleBtn.textContent = 'Switch to Editor (Ctrl+M)';
    downloadBtn.style.display = 'none';
    copyBtn.style.display = 'none';
    graph.loadMarkdown(markdownEditor.value);
    layout.update();
    localStorage.setItem('typestorming-data', markdownEditor.value);
  }
}

viewToggleBtn.addEventListener('click', toggleView);

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
    e.preventDefault();
    toggleView();
  }

  // Download: Ctrl+S
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    downloadMarkdown();
  }

  // Copy all: Ctrl+Shift+C (only when no text is selected)
  if ((e.ctrlKey || e.metaKey) && e.key === 'C' && e.shiftKey) {
    e.preventDefault();
    if (!window.getSelection().toString()) {
      copyToClipboard();
    }
  }
});

// ───── Re-Layout Button ─────
document.getElementById('relayout-btn').addEventListener('click', () => {
  layout.reLayout();
});

// ───── Editor sync ─────
markdownEditor.addEventListener('input', () => {
  localStorage.setItem('typestorming-data', markdownEditor.value);
});

// ───── Download ─────
function downloadMarkdown() {
  const md = graph.getMarkdown();
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'storming-session.md';
  a.click();
  URL.revokeObjectURL(url);
}

downloadBtn.addEventListener('click', downloadMarkdown);

// ───── Copy ─────
function copyToClipboard() {
  const md = graph.getMarkdown();
  navigator.clipboard.writeText(md).then(() => {
    showToast('Copied to clipboard!');
  });
}

copyBtn.addEventListener('click', copyToClipboard);

// ───── Toast ─────
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2000);
}
