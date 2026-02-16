
export class InputHandler {
    constructor(graph, layout, renderer, uiElements) {
        this.graph = graph;
        this.layout = layout;
        this.renderer = renderer;
        this.ui = uiElements; // { nodeForm, titleInput, ... }

        this.state = 'IDLE'; // IDLE, CREATING_NODE, EDITING_NODE, EDITING_REL, SPOTLIGHT
        this.creationStep = null; // 'TITLE', 'BODY', 'REL'
        this.activeNodeId = null; // Node being edited/created
        this.sourceNodeId = null; // Origin node for creation
        this.tempEdge = null; // For visualization

        this.setupEvents();
    }

    setupEvents() {
        // Global Keydown (Spotlight & Editor Toggle handled in main, but Spotlight hotkey here)
        window.addEventListener('keydown', (e) => this.handleKey(e));

        // Form Inputs
        this.ui.nodeTitleInput.addEventListener('keydown', (e) => this.handleFormKey(e, 'TITLE'));
        this.ui.nodeBodyInput.addEventListener('keydown', (e) => this.handleFormKey(e, 'BODY'));
        this.ui.nodeRelInput.addEventListener('keydown', (e) => this.handleFormKey(e, 'REL'));

        // Mouse Dragging (Global)
        window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        window.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        // Spotlight Inputs
        const spotlightInput = document.getElementById('spotlight-input');
        if (spotlightInput) {
            spotlightInput.addEventListener('input', (e) => this.handleSearchInput(e));
            spotlightInput.addEventListener('keydown', (e) => this.handleSearchKey(e));
        }
    }

    handleKey(e) {
        // Spotlight Toggle
        if (e.key === '/' && this.state === 'IDLE') {
            // Prevent capturing '/' if typing in other inputs (handled by next check theoretically, but '/')
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

            e.preventDefault();
            this.toggleSearch();
            return;
        }

        if (this.state === 'SPOTLIGHT') {
            if (e.key === 'Escape') {
                this.toggleSearch();
            }
            return;
        }

        if (this.state !== 'IDLE') return; // Let form handle keys if active

        // Ignore if typing in editor or other inputs
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

        const selectedId = this.renderer.selectedNodeId;
        // ... rest of handleKey logic ...
        // (Use previous logic below this line)
        if (e.key === 'Tab') {
            e.preventDefault();
            if (selectedId) {
                if (e.shiftKey) {
                    this.startNodeCreation(selectedId, 'SIBLING');
                } else {
                    this.startNodeCreation(selectedId, 'CHILD');
                }
            }
        } else if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            this.startNodeCreation(null, 'INDEPENDENT');
        } else if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            if (selectedId) {
                this.startEdit(selectedId);
            }
        }

        // Navigation
        if (e.key.startsWith('Arrow')) {
            e.preventDefault();
            const direction = e.key.replace('Arrow', '').toUpperCase();
            if (selectedId) {
                if (e.shiftKey) {
                    this.navigateLogical(selectedId, direction);
                } else if (e.altKey) {
                    // strict relationship navigation (todo)
                } else {
                    this.navigateSpatial(selectedId, direction);
                }
            }
        }

        // Deletion
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedId) {
                this.graph.removeNode(selectedId);
                this.renderer.selectedNodeId = null;
            }
        }
    }

    toggleSearch() {
        const overlay = document.getElementById('spotlight-overlay');
        const input = document.getElementById('spotlight-input');

        if (this.state === 'SPOTLIGHT') {
            this.state = 'IDLE';
            overlay.style.display = 'none';
            this.renderer.canvas.focus();
        } else {
            this.state = 'SPOTLIGHT';
            overlay.style.display = 'flex';
            input.value = '';
            input.focus();
            this.handleSearchInput({ target: input }); // clear results
        }
    }

    handleSearchInput(e) {
        const query = e.target.value.toLowerCase();
        const resultsList = document.getElementById('spotlight-results');
        resultsList.innerHTML = '';

        this.searchResults = [];
        this.searchSelectionIndex = 0;

        if (!query) return;

        // Filter nodes
        for (const [id, node] of this.graph.nodes) {
            if (node.title.toLowerCase().includes(query) || node.body.toLowerCase().includes(query)) {
                this.searchResults.push(node);
            }
        }

        // Limit results
        this.searchResults = this.searchResults.slice(0, 10);

        // Render
        this.searchResults.forEach((node, index) => {
            const li = document.createElement('li');
            li.className = 'spotlight-item';
            if (index === 0) li.classList.add('selected');

            li.innerHTML = `
                <span class="spotlight-item-title">${node.title}</span>
                <span class="spotlight-item-body">${node.body}</span>
            `;
            li.addEventListener('click', () => this.selectSearchResult(node));
            resultsList.appendChild(li);
        });
    }

    handleSearchKey(e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.searchSelectionIndex = Math.min(this.searchResults.length - 1, this.searchSelectionIndex + 1);
            this.updateSearchSelection();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.searchSelectionIndex = Math.max(0, this.searchSelectionIndex - 1);
            this.updateSearchSelection();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (this.searchResults[this.searchSelectionIndex]) {
                this.selectSearchResult(this.searchResults[this.searchSelectionIndex]);
            }
        }
    }

    updateSearchSelection() {
        const items = document.querySelectorAll('.spotlight-item');
        items.forEach((item, idx) => {
            if (idx === this.searchSelectionIndex) item.classList.add('selected');
            else item.classList.remove('selected');
        });
    }

    selectSearchResult(node) {
        this.toggleSearch(); // close
        this.renderer.selectedNodeId = node.id;
        this.renderer.centerOnNode(node.id);
    }

    startNodeCreation(originId, type) {
        this.state = 'CREATING_NODE';
        this.sourceNodeId = originId;
        this.creationType = type;

        // Determine position for new node
        let x = 0, y = 0;
        if (originId) {
            const pos = this.layout.positions.get(originId);
            // Offset based on type
            if (type === 'CHILD') {
                x = pos.x + 150;
                y = pos.y + 50 * (Math.random() - 0.5);
            } else if (type === 'SIBLING') {
                x = pos.x;
                y = pos.y + 100;
            }
        } else {
            // Center of screen
            x = this.renderer.canvas.width / 2 - this.renderer.offset.x;
            y = this.renderer.canvas.height / 2 - this.renderer.offset.y;
        }

        // Create temp node ID
        const newId = 'Node_' + Date.now();
        this.activeNodeId = newId;

        // Show Form
        this.showNodeForm(x, y);

        this.creationStep = 'TITLE';
        this.ui.nodeTitleInput.value = '';
        this.ui.nodeBodyInput.value = '';
        this.ui.nodeRelInput.value = '';
        this.ui.nodeTitleInput.focus();
    }

    startEdit(nodeId) {
        this.state = 'EDITING_NODE';
        this.activeNodeId = nodeId;
        const node = this.graph.nodes.get(nodeId);
        const pos = this.layout.positions.get(nodeId);

        this.showNodeForm(pos.x, pos.y);
        this.ui.nodeTitleInput.value = node.title;
        this.ui.nodeBodyInput.value = node.body;
        this.ui.nodeRelInput.style.display = 'none'; // Hide relationship input for simple edit

        this.creationStep = 'TITLE';
        this.ui.nodeTitleInput.focus();
        this.ui.nodeTitleInput.select();
    }

    showNodeForm(x, y) {
        // Convert world coords to screen coords
        const screenPos = this.renderer.worldToScreen(x, y);

        this.ui.nodeForm.style.display = 'flex';
        this.ui.nodeForm.style.left = `${screenPos.x}px`;
        this.ui.nodeForm.style.top = `${screenPos.y}px`;

        // Reset visibility of rel input just in case
        this.ui.nodeRelInput.style.display = (this.state === 'CREATING_NODE' && this.sourceNodeId) ? 'block' : 'none';
    }

    handleFormKey(e, step) {
        if (e.key === 'Escape') {
            this.cancelAction();
            return;
        }

        if (e.key === 'Enter') {
            if (e.shiftKey) {
                // Quick submit
                e.preventDefault();
                this.submitAction();
                return;
            }

            e.preventDefault();

            // Step progression
            if (step === 'TITLE') {
                this.creationStep = 'BODY';
                this.ui.nodeBodyInput.focus();
            } else if (step === 'BODY') {
                if (this.state === 'CREATING_NODE' && this.sourceNodeId) {
                    this.creationStep = 'REL';
                    this.ui.nodeRelInput.focus();
                } else {
                    this.submitAction();
                }
            } else if (step === 'REL') {
                this.submitAction();
            }
        }
    }

    submitAction() {
        const title = this.ui.nodeTitleInput.value || 'Untitled';
        const body = this.ui.nodeBodyInput.value || '';
        const relLabel = this.ui.nodeRelInput.value;

        if (this.state === 'CREATING_NODE') {
            const newNode = {
                id: this.activeNodeId,
                title,
                body
            };
            this.graph.addNode(newNode);

            // Add relationship
            if (this.sourceNodeId) {
                let from, to;
                if (this.creationType === 'CHILD') {
                    from = this.sourceNodeId;
                    to = newNode.id;
                } else if (this.creationType === 'SIBLING') {
                    const parent = this.graph.getParent(this.sourceNodeId);
                    from = parent ? parent.id : null;
                    to = newNode.id;
                }

                if (from && to) {
                    this.graph.addEdge({ from, to, label: relLabel });
                }
            }

            // Select new node
            this.renderer.selectedNodeId = newNode.id;

        } else if (this.state === 'EDITING_NODE') {
            this.graph.updateNode(this.activeNodeId, { title, body });
        }

        this.cancelAction(); // Hides form and resets state
    }

    cancelAction() {
        this.state = 'IDLE';
        this.ui.nodeForm.style.display = 'none';
        this.ui.relForm.style.display = 'none';
        this.ui.nodeRelInput.style.display = 'block'; // Reset display
        this.activeNodeId = null;
        this.sourceNodeId = null;
        this.renderer.canvas.focus();
    }

    navigateSpatial(currentId, direction) {
        const currentPos = this.layout.positions.get(currentId);
        if (!currentPos) return;

        let bestId = null;
        let minDistance = Infinity;

        for (const [id, pos] of this.layout.positions) {
            if (id === currentId) continue;

            const dx = pos.x - currentPos.x;
            const dy = pos.y - currentPos.y;

            let isValid = false;
            // Rough directional check
            if (direction === 'RIGHT' && dx > 0 && Math.abs(dy) < dx * 2) isValid = true;
            if (direction === 'LEFT' && dx < 0 && Math.abs(dy) < -dx * 2) isValid = true;
            if (direction === 'DOWN' && dy > 0 && Math.abs(dx) < dy * 2) isValid = true;
            if (direction === 'UP' && dy < 0 && Math.abs(dx) < -dy * 2) isValid = true;

            if (isValid) {
                const dist = dx * dx + dy * dy;
                if (dist < minDistance) {
                    minDistance = dist;
                    bestId = id;
                }
            }
        }

        if (bestId) {
            this.renderer.selectedNodeId = bestId;
            this.renderer.draw();
        }
    }

    navigateLogical(currentId, direction) {
        let targetId = null;
        if (direction === 'UP') {
            const parent = this.graph.getParent(currentId);
            if (parent) targetId = parent.id;
        } else if (direction === 'DOWN') {
            const children = this.graph.getChildren(currentId);
            if (children.length > 0) targetId = children[0].id;
        } else if (direction === 'RIGHT' || direction === 'LEFT') {
            const siblings = this.graph.getSiblings(currentId);
            if (siblings.length > 0) {
                // Find current index
                // This is a bit tricky since siblings doesn't include self in my helper
                // Let's get all children of parent
                const parent = this.graph.getParent(currentId);
                if (parent) {
                    const allChildren = this.graph.getChildren(parent.id);
                    const idx = allChildren.findIndex(n => n.id === currentId);
                    if (direction === 'RIGHT' && idx < allChildren.length - 1) targetId = allChildren[idx + 1].id;
                    if (direction === 'LEFT' && idx > 0) targetId = allChildren[idx - 1].id;
                }
            }
        }

        if (targetId) {
            this.renderer.selectedNodeId = targetId;
            this.renderer.draw();
        }
    }

    handleMouseDown(e) {
        if (this.state !== 'IDLE') return;

        const rect = this.renderer.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const nodeId = this.renderer.getNodeAt(x, y);

        if (nodeId) {
            // Start Dragging Node
            this.isDragging = true;
            this.dragNodeId = nodeId;
            this.renderer.selectedNodeId = nodeId;

            // Pin the node while dragging
            const worldPos = this.renderer.screenToWorld(x, y);
            // We want to grab the node at its center or maintain offset?
            // For simplicity, let's just pin it. 
            // Better: calculate offset from node center to mouse to prevent jumping
            const nodePos = this.layout.positions.get(nodeId);
            this.dragOffset = {
                x: nodePos.x - worldPos.x,
                y: nodePos.y - worldPos.y
            };

            this.layout.pinNode(nodeId, nodePos.x, nodePos.y);

        } else {
            // Deselect if clicked background
            this.renderer.selectedNodeId = null;
        }

        this.renderer.draw();
    }

    handleMouseMove(e) {
        if (this.isDragging && this.dragNodeId) {
            const rect = this.renderer.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const worldPos = this.renderer.screenToWorld(x, y);

            // Apply drag offset
            const newX = worldPos.x + this.dragOffset.x;
            const newY = worldPos.y + this.dragOffset.y;

            this.layout.pinNode(this.dragNodeId, newX, newY);
        }
    }

    handleMouseUp(e) {
        if (this.isDragging && this.dragNodeId) {
            // Stop dragging
            // Optional: keep it pinned? Or unpin to let physics take over?
            // Spec usually implies "drag to position", so we might want to keep it pinned 
            // OR let it settle. For now let's unpin but with 0 velocity so it stays roughly there unless pushed.
            // Actually, for "manual arrangement", pinning is better. 
            // But if user wants auto-layout, they might want unpin.
            // Let's unpin for now to keep the "floating" feel, but set velocity to 0.

            // Decision: release pin so physics continues.
            this.layout.unpinNode(this.dragNodeId);

            this.isDragging = false;
            this.dragNodeId = null;
        }
    }
}
