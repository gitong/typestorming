
import { parseMarkdown, serializeGraph } from './parser.js';

export class GraphModel {
    constructor() {
        this.nodes = new Map();
        this.edges = [];
        this.listeners = [];
    }

    loadMarkdown(text) {
        const { nodes, edges } = parseMarkdown(text);
        this.nodes = nodes;
        this.edges = edges;
        this.notify();
    }

    getMarkdown() {
        return serializeGraph(this.nodes, this.edges);
    }

    addNode(node) {
        if (!this.nodes.has(node.id)) {
            this.nodes.set(node.id, node);
            this.notify();
        }
    }

    updateNode(id, data) {
        const node = this.nodes.get(id);
        if (node) {
            Object.assign(node, data);
            this.notify();
        }
    }

    removeNode(id) {
        if (this.nodes.delete(id)) {
            this.edges = this.edges.filter(e => e.from !== id && e.to !== id);
            this.notify();
        }
    }

    addEdge(edge) {
        this.edges.push(edge);
        this.notify();
    }

    removeEdge(edge) {
        const index = this.edges.indexOf(edge);
        if (index > -1) {
            this.edges.splice(index, 1);
            this.notify();
        }
    }

    updateEdgeLabel(edge, label) {
        edge.label = label;
        this.notify();
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify() {
        this.listeners.forEach(l => l(this));
    }

    // Helpers for logical navigation
    getParent(id) {
        // Assuming 'parent' is the source of an incoming edge
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
        return this.getChildren(parent.id).filter(node => node.id !== id);
    }
}
