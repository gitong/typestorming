/**
 * TypeStorming Graph Model
 * Core data structure with undo/redo, pub/sub, and hierarchy helpers.
 */

import { parseMarkdown, serializeGraph } from './parser.js';

export class GraphModel {
    constructor() {
        this.nodes = new Map();
        this.edges = [];
        this.listeners = [];
        this._idCounter = 0;

        // Undo / Redo stacks
        this._undoStack = [];
        this._redoStack = [];
        this._batchActive = false;
    }

    // ---------- Serialization ----------

    loadMarkdown(text) {
        const { nodes, edges, warnings } = parseMarkdown(text);
        this.nodes = nodes;
        this.edges = edges;

        // Sync ID counter to avoid collisions
        for (const id of this.nodes.keys()) {
            const m = id.match(/^n(\d+)$/);
            if (m) {
                this._idCounter = Math.max(this._idCounter, parseInt(m[1], 10));
            }
        }

        if (warnings.length) {
            console.warn('[TypeStorming] Parse warnings:', warnings);
        }
        this.notify();
    }

    getMarkdown() {
        return serializeGraph(this.nodes, this.edges);
    }

    // ---------- ID Generation ----------

    generateId() {
        this._idCounter++;
        return `n${this._idCounter}`;
    }

    // ---------- Undo / Redo ----------

    _pushUndo() {
        if (this._batchActive) return;
        this._undoStack.push(this.getMarkdown());
        // Cap stack
        if (this._undoStack.length > 50) this._undoStack.shift();
        // Clear redo on new action
        this._redoStack = [];
    }

    undo() {
        if (this._undoStack.length === 0) return;
        // Save current state to redo
        this._redoStack.push(this.getMarkdown());
        const prev = this._undoStack.pop();
        this._batchActive = true;
        this.loadMarkdown(prev);
        this._batchActive = false;
    }

    redo() {
        if (this._redoStack.length === 0) return;
        this._undoStack.push(this.getMarkdown());
        const next = this._redoStack.pop();
        this._batchActive = true;
        this.loadMarkdown(next);
        this._batchActive = false;
    }

    // ---------- Node CRUD ----------

    addNode(node) {
        if (!this.nodes.has(node.id)) {
            this._pushUndo();
            if (!node.level) node.level = 1;
            this.nodes.set(node.id, node);
            this.notify();
        }
    }

    updateNode(id, data) {
        const node = this.nodes.get(id);
        if (node) {
            this._pushUndo();
            Object.assign(node, data);
            this.notify();
        }
    }

    removeNode(id) {
        if (!this.nodes.has(id)) return;
        this._pushUndo();

        // Re-parent children: find children and connect them to deleted node's parent
        const parent = this.getParent(id);
        const children = this.getChildren(id);

        if (parent && children.length > 0) {
            for (const child of children) {
                this.edges.push({ from: parent.id, to: child.id, label: '' });
            }
        }

        // Remove node and all its edges
        this.nodes.delete(id);
        this.edges = this.edges.filter(e => e.from !== id && e.to !== id);
        this.notify();
    }

    // ---------- Edge CRUD ----------

    addEdge(edge) {
        this._pushUndo();
        if (!edge.label) edge.label = '';
        this.edges.push(edge);
        this.notify();
    }

    removeEdge(from, to) {
        const idx = this.edges.findIndex(e => e.from === from && e.to === to);
        if (idx > -1) {
            this._pushUndo();
            this.edges.splice(idx, 1);
            this.notify();
        }
    }

    updateEdgeLabel(from, to, label) {
        const edge = this.edges.find(e => e.from === from && e.to === to);
        if (edge) {
            this._pushUndo();
            edge.label = label;
            this.notify();
        }
    }

    // ---------- Hierarchy Helpers ----------

    getParent(id) {
        const parentEdge = this.edges.find(e => e.to === id);
        return parentEdge ? this.nodes.get(parentEdge.from) : null;
    }

    getChildren(id) {
        return this.edges
            .filter(e => e.from === id)
            .map(e => this.nodes.get(e.to))
            .filter(Boolean);
    }

    getSiblings(id) {
        const parent = this.getParent(id);
        if (!parent) return [];
        return this.getChildren(parent.id).filter(n => n.id !== id);
    }

    getAllSiblingsIncludingSelf(id) {
        const parent = this.getParent(id);
        if (!parent) return [this.nodes.get(id)].filter(Boolean);
        return this.getChildren(parent.id);
    }

    getPrevSibling(id) {
        const parent = this.getParent(id);
        if (!parent) return null;
        const siblings = this.getChildren(parent.id);
        const idx = siblings.findIndex(n => n.id === id);
        return idx > 0 ? siblings[idx - 1] : null;
    }

    getNextSibling(id) {
        const parent = this.getParent(id);
        if (!parent) return null;
        const siblings = this.getChildren(parent.id);
        const idx = siblings.findIndex(n => n.id === id);
        return idx < siblings.length - 1 ? siblings[idx + 1] : null;
    }

    // Get all root nodes (no incoming edges)
    getRoots() {
        const childIds = new Set(this.edges.map(e => e.to));
        return Array.from(this.nodes.values()).filter(n => !childIds.has(n.id));
    }

    // ---------- Pub/Sub ----------

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify() {
        this.listeners.forEach(l => l(this));
    }
}
