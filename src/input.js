/**
 * TypeStorming Input Handler
 * 3-mode state machine: SELECT, EDIT, EDGE_LABEL
 * Handles all keyboard shortcuts & mouse interactions per spec.
 */

export class InputHandler {
    constructor(graph, layout, renderer) {
        this.graph = graph;
        this.layout = layout;
        this.renderer = renderer;

        // State machine
        this.mode = 'SELECT'; // SELECT | EDIT | EDGE_LABEL
        this.editingNodeId = null;
        this.editField = 'title'; // 'title' or 'body'
        this.preEditState = null; // for cancel/revert
        this.pendingEdge = null; // { from, to } for edge label mode

        // Inline editing overlay
        this.editOverlay = null;
        this.editInput = null;

        // Spotlight
        this.spotlightOpen = false;
        this.spotlightMode = 'search'; // 'search' | 'link'
        this.spotlightLinkSource = null; // node id when linking
        this.searchResults = [];
        this.searchSelectionIndex = 0;

        this._setupEvents();
    }

    _setupEvents() {
        document.addEventListener('keydown', (e) => this._handleGlobalKey(e));

        // Renderer callbacks
        this.renderer.onNodeClick = (id) => this._onNodeClick(id);
        this.renderer.onNodeDblClick = (id) => this._onNodeDblClick(id);
        this.renderer.onBackgroundClick = () => this._onBackgroundClick();

        // Spotlight
        const spotlightInput = document.getElementById('spotlight-input');
        if (spotlightInput) {
            spotlightInput.addEventListener('input', (e) => this._handleSearchInput(e));
            spotlightInput.addEventListener('keydown', (e) => this._handleSearchKey(e));
        }
    }

    // ========================================
    // GLOBAL KEY HANDLER
    // ========================================

    _handleGlobalKey(e) {
        // Ignore keys when in markdown editor textarea
        if (e.target.id === 'markdown-editor') return;

        // Spotlight toggle (Ctrl+K)
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            this._toggleSpotlight('search');
            return;
        }

        // Undo / Redo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            this.graph.undo();
            this.layout.update();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            // Ctrl+Shift+Z specifically: if e.key === 'Z' with shift, it may be capital
            if (e.key === 'y' || e.shiftKey) {
                e.preventDefault();
                this.graph.redo();
                this.layout.update();
                return;
            }
        }

        if (this.spotlightOpen) {
            // Let spotlight handle its own keys
            return;
        }

        // If inline editing overlay is active, handle edit keys
        if (this.mode === 'EDIT') {
            this._handleEditKey(e);
            return;
        }

        if (this.mode === 'EDGE_LABEL') {
            this._handleEdgeLabelKey(e);
            return;
        }

        // SELECT mode
        this._handleSelectKey(e);
    }

    // ========================================
    // SELECT MODE
    // ========================================

    _handleSelectKey(e) {
        const selectedId = this.renderer.selectedNodeId;

        // Enter: create sibling OR connect two selected nodes
        if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
            e.preventDefault();
            // If two nodes are selected (multi-select), connect them
            if (selectedId && this.renderer.secondarySelectedNodeId) {
                const from = selectedId;
                const to = this.renderer.secondarySelectedNodeId;
                // Add edge and enter Edge Label Mode
                this.graph.addEdge({ from, to, label: '' });
                this.layout.update();
                this.pendingEdge = this.graph.edges[this.graph.edges.length - 1];
                this.renderer.secondarySelectedNodeId = null;
                this.renderer._updateSelection();
                this.mode = 'EDGE_LABEL';
                this._showEdgeLabelOverlay(this.pendingEdge);
            } else if (selectedId) {
                this._createSibling(selectedId);
            } else {
                this._createRootNode();
            }
            return;
        }

        // Tab: create child node of the selected node
        if (e.key === 'Tab') {
            e.preventDefault();
            if (selectedId) {
                this._createChild(selectedId);
            }
            return;
        }

        // Space: enter edit mode
        if ((e.key === ' ' || e.code === 'Space') && selectedId) {
            e.preventDefault();
            this._startEdit(selectedId);
            return;
        }

        // Delete / Backspace: delete node
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
            e.preventDefault();
            this._deleteNode(selectedId);
            return;
        }

        // Escape: deselect
        if (e.key === 'Escape') {
            this.renderer.selectedNodeId = null;
            this.renderer.secondarySelectedNodeId = null;
            this.renderer._updateSelection();
            return;
        }

        // Arrow keys: spatial navigation
        if (e.key.startsWith('Arrow') && selectedId) {
            e.preventDefault();
            const dir = e.key.replace('Arrow', '').toUpperCase();
            if (e.shiftKey) {
                this._navigateLogical(selectedId, dir);
            } else {
                this._navigateSpatial(selectedId, dir);
            }
            return;
        }

        // Dash (-): open spotlight to link selected node to another
        if ((e.key === '-' || e.key === 'Minus') && selectedId) {
            e.preventDefault();
            this._toggleSpotlight('link', selectedId);
            return;
        }
    }

    // ========================================
    // EDIT MODE (inline)
    // ========================================

    _startEdit(nodeId) {
        const node = this.graph.nodes.get(nodeId);
        if (!node) return;

        this.mode = 'EDIT';
        this.editingNodeId = nodeId;
        this.editField = 'title';
        this.preEditState = { title: node.title, body: node.body };

        this._showEditOverlay(nodeId, node.title);
    }

    _showEditOverlay(nodeId, initialValue) {
        this._removeEditOverlay();

        const pos = this.renderer.getNodeScreenPosition(nodeId);
        if (!pos) return;

        const overlay = document.createElement('div');
        overlay.id = 'inline-edit-overlay';
        overlay.style.cssText = `
      position: absolute;
      left: ${pos.x - 80}px;
      top: ${pos.y - 16}px;
      z-index: 50;
      pointer-events: auto;
    `;

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'inline-edit-input';
        input.value = initialValue || '';
        input.placeholder = this.editField === 'title' ? 'Title…' : 'Body…';
        input.style.cssText = `
      width: 160px;
      padding: 6px 10px;
      background: #1e293b;
      border: 2px solid #6366f1;
      border-radius: 6px;
      color: #f8fafc;
      font-family: Inter, sans-serif;
      font-size: ${this.editField === 'title' ? '14px' : '12px'};
      font-weight: ${this.editField === 'title' ? 'bold' : 'normal'};
      outline: none;
      text-align: center;
    `;

        input.addEventListener('keydown', (e) => this._handleEditKey(e));

        overlay.appendChild(input);
        document.getElementById('canvas-container').appendChild(overlay);

        this.editOverlay = overlay;
        this.editInput = input;

        // Focus and select
        requestAnimationFrame(() => {
            input.focus();
            input.select();
        });
    }

    _removeEditOverlay() {
        if (this.editOverlay && this.editOverlay.parentNode) {
            this.editOverlay.parentNode.removeChild(this.editOverlay);
        }
        this.editOverlay = null;
        this.editInput = null;
    }

    _handleEditKey(e) {
        // Prevent global handler from re-processing
        if (e.target !== this.editInput) return;

        // Semicolon or backtick: switch from title to body
        if ((e.key === ';' || e.key === '`') && this.editField === 'title') {
            e.preventDefault();
            // Save title, switch to body
            const node = this.graph.nodes.get(this.editingNodeId);
            if (node) {
                this.graph.updateNode(this.editingNodeId, { title: this.editInput.value });
            }
            this.editField = 'body';
            this.editInput.value = node ? node.body : '';
            this.editInput.placeholder = 'Body…';
            this.editInput.style.fontWeight = 'normal';
            this.editInput.style.fontSize = '12px';
            this.editInput.select();
            return;
        }

        // Ctrl+Enter: open spotlight to link existing node
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            this._finishEditSave();
            this._toggleSpotlight('link');
            return;
        }

        // Enter: finalize edit, jump to edge label mode
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this._finishEditAndLabelEdge();
            return;
        }

        // Shift+Enter: insert newline (for body — but since it's an input, we'll just ignore)
        if (e.key === 'Enter' && e.shiftKey) {
            // For inline single-line input, no-op
            return;
        }

        // Escape: cancel edit
        if (e.key === 'Escape') {
            e.preventDefault();
            this._cancelEdit();
            return;
        }

        // Stop propagation so select mode doesn't catch these
        e.stopPropagation();
    }

    _finishEditSave() {
        if (!this.editingNodeId) return;
        const node = this.graph.nodes.get(this.editingNodeId);
        if (node && this.editInput) {
            const data = {};
            if (this.editField === 'title') {
                data.title = this.editInput.value || 'Untitled';
            } else {
                data.body = this.editInput.value || '';
            }
            this.graph.updateNode(this.editingNodeId, data);
        }
        this.layout.update();
    }

    _finishEditAndLabelEdge() {
        this._finishEditSave();

        // Find the most recently created edge connected to this node
        const id = this.editingNodeId;
        const edges = this.graph.edges;
        let lastEdge = null;
        for (let i = edges.length - 1; i >= 0; i--) {
            if (edges[i].from === id || edges[i].to === id) {
                lastEdge = edges[i];
                break;
            }
        }

        this._removeEditOverlay();

        if (lastEdge) {
            // Enter Edge Label Mode
            this.pendingEdge = lastEdge;
            this.mode = 'EDGE_LABEL';
            this._showEdgeLabelOverlay(lastEdge);
        } else {
            // No edge to label — return to select
            this.mode = 'SELECT';
            this.editingNodeId = null;
        }
    }

    _cancelEdit() {
        // Revert to pre-edit state
        if (this.editingNodeId && this.preEditState) {
            this.graph.updateNode(this.editingNodeId, this.preEditState);
            this.layout.update();
        }
        this._removeEditOverlay();
        this.mode = 'SELECT';
        this.editingNodeId = null;
        this.preEditState = null;
    }

    // ========================================
    // EDGE LABEL MODE
    // ========================================

    _showEdgeLabelOverlay(edge) {
        this._removeEditOverlay();

        // Position between the two nodes
        const p1 = this.renderer.getNodeScreenPosition(edge.from);
        const p2 = this.renderer.getNodeScreenPosition(edge.to);
        if (!p1 || !p2) {
            this.mode = 'SELECT';
            return;
        }

        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;

        const overlay = document.createElement('div');
        overlay.id = 'inline-edit-overlay';
        overlay.style.cssText = `
      position: absolute;
      left: ${mx - 80}px;
      top: ${my - 16}px;
      z-index: 50;
      pointer-events: auto;
    `;

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'edge-label-input';
        input.value = edge.label || '';
        input.placeholder = 'Relationship label (optional)…';
        input.style.cssText = `
      width: 200px;
      padding: 6px 10px;
      background: #1e293b;
      border: 2px solid #818cf8;
      border-radius: 6px;
      color: #c4b5fd;
      font-family: Inter, sans-serif;
      font-size: 12px;
      font-style: italic;
      outline: none;
      text-align: center;
    `;

        input.addEventListener('keydown', (e) => this._handleEdgeLabelKey(e));

        overlay.appendChild(input);
        document.getElementById('canvas-container').appendChild(overlay);

        this.editOverlay = overlay;
        this.editInput = input;

        requestAnimationFrame(() => {
            input.focus();
            input.select();
        });
    }

    _handleEdgeLabelKey(e) {
        if (e.target !== this.editInput) return;

        if (e.key === 'Enter') {
            e.preventDefault();
            const label = this.editInput.value || '';
            if (this.pendingEdge) {
                this.graph.updateEdgeLabel(this.pendingEdge.from, this.pendingEdge.to, label);
                this.layout.update();
            }
            this._removeEditOverlay();
            this.mode = 'SELECT';
            this.editingNodeId = null;
            this.pendingEdge = null;
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            this._removeEditOverlay();
            this.mode = 'SELECT';
            this.editingNodeId = null;
            this.pendingEdge = null;
            return;
        }

        e.stopPropagation();
    }

    // ========================================
    // NODE CREATION
    // ========================================

    _createRootNode() {
        const id = this.graph.generateId();
        this.graph.addNode({ id, title: '', body: '', level: 1 });
        this.layout.update();
        this.renderer.selectedNodeId = id;
        this.renderer._updateSelection();

        // Enter edit mode
        setTimeout(() => this._startEdit(id), 100);
    }

    _createSibling(selectedId) {
        const parent = this.graph.getParent(selectedId);
        const newId = this.graph.generateId();
        this.graph.addNode({ id: newId, title: '', body: '', level: 1 });

        if (parent) {
            this.graph.addEdge({ from: parent.id, to: newId, label: '' });
        }

        this.layout.update();
        this.renderer.selectedNodeId = newId;
        this.renderer._updateSelection();

        setTimeout(() => this._startEdit(newId), 100);
    }

    _createChild(parentId) {
        const newId = this.graph.generateId();
        this.graph.addNode({ id: newId, title: '', body: '', level: 1 });
        this.graph.addEdge({ from: parentId, to: newId, label: '' });

        this.layout.update();
        this.renderer.selectedNodeId = newId;
        this.renderer._updateSelection();

        setTimeout(() => this._startEdit(newId), 100);
    }

    _deleteNode(nodeId) {
        this.graph.removeNode(nodeId);
        this.renderer.selectedNodeId = null;
        this.renderer._updateSelection();
        this.layout.update();
    }

    // ========================================
    // NAVIGATION
    // ========================================

    _navigateSpatial(currentId, direction) {
        const currentPos = this.layout.getNodePosition(currentId);
        if (!currentPos) return;

        let bestId = null;
        let minDist = Infinity;

        for (const [id, node] of this.graph.nodes) {
            if (id === currentId) continue;
            const pos = this.layout.getNodePosition(id);
            if (!pos) continue;

            const dx = pos.x - currentPos.x;
            const dy = pos.y - currentPos.y;

            let valid = false;
            if (direction === 'RIGHT' && dx > 0 && Math.abs(dy) < dx * 2) valid = true;
            if (direction === 'LEFT' && dx < 0 && Math.abs(dy) < -dx * 2) valid = true;
            if (direction === 'DOWN' && dy > 0 && Math.abs(dx) < dy * 2) valid = true;
            if (direction === 'UP' && dy < 0 && Math.abs(dx) < -dy * 2) valid = true;

            if (valid) {
                const dist = dx * dx + dy * dy;
                if (dist < minDist) {
                    minDist = dist;
                    bestId = id;
                }
            }
        }

        if (bestId) {
            this.renderer.selectedNodeId = bestId;
            this.renderer._updateSelection();
            this.renderer.draw();
        }
    }

    _navigateLogical(currentId, direction) {
        let targetId = null;

        if (direction === 'UP') {
            const parent = this.graph.getParent(currentId);
            if (parent) targetId = parent.id;
        } else if (direction === 'DOWN') {
            const children = this.graph.getChildren(currentId);
            if (children.length > 0) targetId = children[0].id;
        } else if (direction === 'RIGHT') {
            const next = this.graph.getNextSibling(currentId);
            if (next) targetId = next.id;
        } else if (direction === 'LEFT') {
            const prev = this.graph.getPrevSibling(currentId);
            if (prev) targetId = prev.id;
        }

        if (targetId) {
            this.renderer.selectedNodeId = targetId;
            this.renderer._updateSelection();
            this.renderer.draw();
        }
    }

    // ========================================
    // SPOTLIGHT SEARCH
    // ========================================

    _toggleSpotlight(mode = 'search', linkSourceId = null) {
        const overlay = document.getElementById('spotlight-overlay');
        const input = document.getElementById('spotlight-input');

        if (this.spotlightOpen) {
            this.spotlightOpen = false;
            this.spotlightMode = 'search';
            overlay.style.display = 'none';
            this.spotlightLinkSource = null;
            return;
        }

        this.spotlightOpen = true;
        this.spotlightMode = mode;
        if (mode === 'link') {
            // Use explicit source ID if provided, otherwise fall back to editingNodeId
            this.spotlightLinkSource = linkSourceId || this.editingNodeId;
            // Finish current edit mode save before opening spotlight
            if (this.mode === 'EDIT') {
                this._finishEditSave();
                this._removeEditOverlay();
            }
        }

        overlay.style.display = 'flex';
        input.value = '';
        input.placeholder = mode === 'link' ? 'Link to node…' : 'Search nodes…';
        input.focus();
        this._clearSearchResults();
    }

    _handleSearchInput(e) {
        const query = e.target.value.toLowerCase();
        const resultsList = document.getElementById('spotlight-results');
        resultsList.innerHTML = '';

        this.searchResults = [];
        this.searchSelectionIndex = 0;

        if (!query) return;

        for (const [id, node] of this.graph.nodes) {
            if (node.title.toLowerCase().includes(query) || node.body.toLowerCase().includes(query)) {
                this.searchResults.push(node);
            }
        }
        this.searchResults = this.searchResults.slice(0, 10);

        this.searchResults.forEach((node, index) => {
            const li = document.createElement('li');
            li.className = 'spotlight-item';
            if (index === 0) li.classList.add('selected');
            li.innerHTML = `
        <span class="spotlight-item-title">${node.title || node.id}</span>
        <span class="spotlight-item-body">${node.body || ''}</span>
      `;
            li.addEventListener('click', () => this._selectSearchResult(node));
            resultsList.appendChild(li);
        });
    }

    _handleSearchKey(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            this._toggleSpotlight();
            this.mode = 'SELECT';
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.searchSelectionIndex = Math.min(this.searchResults.length - 1, this.searchSelectionIndex + 1);
            this._updateSearchSelection();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.searchSelectionIndex = Math.max(0, this.searchSelectionIndex - 1);
            this._updateSearchSelection();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (this.searchResults[this.searchSelectionIndex]) {
                this._selectSearchResult(this.searchResults[this.searchSelectionIndex]);
            }
        } else if (e.key === 'Tab' && this.spotlightMode === 'search') {
            // Tab from search: create child of matched node
            e.preventDefault();
            if (this.searchResults[this.searchSelectionIndex]) {
                const parentNode = this.searchResults[this.searchSelectionIndex];
                this._toggleSpotlight();
                const newId = this.graph.generateId();
                this.graph.addNode({ id: newId, title: '', body: '', level: 1 });
                this.graph.addEdge({ from: parentNode.id, to: newId, label: '' });
                this.layout.update();
                this.renderer.selectedNodeId = newId;
                this.renderer._updateSelection();
                setTimeout(() => this._startEdit(newId), 100);
            }
        }
    }

    _selectSearchResult(node) {
        if (this.spotlightMode === 'link' && this.spotlightLinkSource) {
            // Link mode: create edge from source to selected, then enter Edge Label Mode
            const from = this.spotlightLinkSource;
            const to = node.id;
            this.graph.addEdge({ from, to, label: '' });
            this.layout.update();
            this._toggleSpotlight();

            // Enter Edge Label Mode for the new edge
            this.pendingEdge = this.graph.edges[this.graph.edges.length - 1];
            this.renderer.selectedNodeId = from;
            this.renderer._updateSelection();
            this.editingNodeId = null;
            this.spotlightLinkSource = null;
            this.mode = 'EDGE_LABEL';
            this._showEdgeLabelOverlay(this.pendingEdge);
        } else {
            // Search mode: jump to node
            this._toggleSpotlight();
            this.renderer.selectedNodeId = node.id;
            this.renderer._updateSelection();
            this.renderer.centerOnNode(node.id);
            this.mode = 'SELECT';
        }
    }

    _updateSearchSelection() {
        const items = document.querySelectorAll('.spotlight-item');
        items.forEach((item, idx) => {
            if (idx === this.searchSelectionIndex) item.classList.add('selected');
            else item.classList.remove('selected');
        });
    }

    _clearSearchResults() {
        const resultsList = document.getElementById('spotlight-results');
        if (resultsList) resultsList.innerHTML = '';
        this.searchResults = [];
        this.searchSelectionIndex = 0;
    }

    // ========================================
    // MOUSE CALLBACKS
    // ========================================

    _onNodeClick(id, shiftKey) {
        if (this.mode === 'SELECT') {
            if (shiftKey && this.renderer.selectedNodeId && this.renderer.selectedNodeId !== id) {
                // Shift+Click: set as secondary selection
                this.renderer.secondarySelectedNodeId = id;
            } else {
                // Normal click: set as primary, clear secondary
                this.renderer.selectedNodeId = id;
                this.renderer.secondarySelectedNodeId = null;
            }
            this.renderer._updateSelection();
        }
    }

    _onNodeDblClick(id) {
        if (this.mode === 'SELECT') {
            this._startEdit(id);
        }
    }

    _onBackgroundClick() {
        if (this.mode === 'EDIT') {
            this._cancelEdit();
        }
    }
}
