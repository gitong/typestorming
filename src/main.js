import { GraphModel } from './graph.js'
import { ForceLayout } from './layout.js'
import { Renderer } from './renderer.js'
import { InputHandler } from './input.js'

// Initialize
const graph = new GraphModel();
const layout = new ForceLayout(graph);
const canvas = document.getElementById('graph-canvas');
const renderer = new Renderer(canvas, graph, layout);

// UI Elements
const viewToggleBtn = document.getElementById('view-toggle');
const downloadBtn = document.getElementById('download-btn');
const copyBtn = document.getElementById('copy-btn');
const editorContainer = document.getElementById('editor-container');
const markdownEditor = document.getElementById('markdown-editor');
const toast = document.getElementById('toast');

// Form Elements
const nodeForm = document.getElementById('node-form');
const relForm = document.getElementById('rel-form');
const nodeTitleInput = document.getElementById('node-title-input');
const nodeBodyInput = document.getElementById('node-body-input');
const nodeRelInput = document.getElementById('node-rel-input');
const relLabelInput = document.getElementById('rel-label-input');

// Initialize Input Handler
const inputHandler = new InputHandler(graph, layout, renderer, {
  nodeForm, relForm,
  nodeTitleInput, nodeBodyInput, nodeRelInput, relLabelInput
});

let isEditorView = false;

// Initial Data
const savedData = localStorage.getItem('typestorming-data');
if (savedData) {
  graph.loadMarkdown(savedData);
  markdownEditor.value = savedData;
} else {
  const initialData = `## Nodes
Root[title: "Start Here", body: "Press Tab to create a child node"]

## Relationships
`;
  graph.loadMarkdown(initialData);
  markdownEditor.value = initialData;
}

// Auto-save on graph changes
graph.subscribe(() => {
  const md = graph.getMarkdown();
  localStorage.setItem('typestorming-data', md);
  if (isEditorView) {
    markdownEditor.value = md;
  }
});

// Event Listeners

// View Toggle
function toggleView() {
  isEditorView = !isEditorView;
  if (isEditorView) {
    editorContainer.classList.add('visible');
    viewToggleBtn.textContent = 'Switch to Canvas (Ctrl+M)';
    downloadBtn.style.display = 'block';
    copyBtn.style.display = 'block';

    // Sync canvas -> editor
    markdownEditor.value = graph.getMarkdown();
    markdownEditor.focus();
  } else {
    editorContainer.classList.remove('visible');
    viewToggleBtn.textContent = 'Switch to Editor (Ctrl+M)';
    downloadBtn.style.display = 'none';
    copyBtn.style.display = 'none';

    // Sync editor -> canvas
    graph.loadMarkdown(markdownEditor.value);
    localStorage.setItem('typestorming-data', markdownEditor.value);
  }
}

viewToggleBtn.addEventListener('click', toggleView);

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
    e.preventDefault();
    toggleView();
  }
});

// Editor Sync (Live)
markdownEditor.addEventListener('input', () => {
  localStorage.setItem('typestorming-data', markdownEditor.value);
});

// Download
downloadBtn.addEventListener('click', () => {
  const blob = new Blob([markdownEditor.value], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'storming-session.md';
  a.click();
  URL.revokeObjectURL(url);
});

// Copy
copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(markdownEditor.value).then(() => {
    showToast('Copied to clipboard!');
  });
});

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => {
    toast.classList.remove('visible');
  }, 2000);
}

// Mouse Click Selection
canvas.addEventListener('mousedown', (e) => {
  if (isEditorView) return;
  inputHandler.handleMouseDown(e);
});

// Canvas panning
let isPanning = false;
let panStart = { x: 0, y: 0 };

canvas.addEventListener('mousedown', (e) => {
  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    isPanning = true;
    panStart = { x: e.clientX - renderer.offset.x, y: e.clientY - renderer.offset.y };
    e.preventDefault();
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (isPanning) {
    renderer.offset.x = e.clientX - panStart.x;
    renderer.offset.y = e.clientY - panStart.y;
    renderer.draw();
  }
});

canvas.addEventListener('mouseup', () => {
  isPanning = false;
});

// Start Layout
layout.initializePositions();
layout.start();
