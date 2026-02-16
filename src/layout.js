
export class ForceLayout {
    constructor(graph) {
        this.graph = graph;
        this.positions = new Map(); // node id -> {x, y, vx, vy, pinned}
        this.width = 800;
        this.height = 600;
        this.animationId = null;

        // Physics constants -- adjusted for wider spacing
        this.repulsion = 50000;  // Greatly increased to push non-connected nodes apart
        this.springLength = 350; // Increased length for connections
        this.springStrength = 0.05; // Slightly weaker springs to allow repulsion to win
        this.damping = 0.9;
        this.centerPull = 0.01;

        // Subscribe to graph changes to re-warm simulation
        this.graph.subscribe(() => {
            this.initializePositions();
            this.start();
        });
    }

    initializePositions() {
        // Initialize new nodes with random positions near center
        for (const [id, node] of this.graph.nodes) {
            if (!this.positions.has(id)) {
                this.positions.set(id, {
                    x: this.width / 2 + (Math.random() - 0.5) * 200,
                    y: this.height / 2 + (Math.random() - 0.5) * 200,
                    vx: 0,
                    vy: 0,
                    pinned: false
                });
            }
        }

        // Remove deleted nodes
        for (const id of this.positions.keys()) {
            if (!this.graph.nodes.has(id)) {
                this.positions.delete(id);
            }
        }
    }

    setSize(width, height) {
        this.width = width;
        this.height = height;
    }

    pinNode(id, x, y) {
        if (this.positions.has(id)) {
            const pos = this.positions.get(id);
            pos.x = x;
            pos.y = y;
            pos.pinned = true;
            pos.vx = 0;
            pos.vy = 0;
            this.start(); // Wake up simulation
        }
    }

    unpinNode(id) {
        if (this.positions.has(id)) {
            this.positions.get(id).pinned = false;
            this.start();
        }
    }

    start() {
        if (!this.animationId) {
            this.tick();
        }
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    tick() {
        // Calculate forces
        const forces = new Map();
        for (const id of this.positions.keys()) {
            forces.set(id, { fx: 0, fy: 0 });
        }

        const nodes = Array.from(this.positions.keys());

        // Repulsion (Coulomb's Law-ish)
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const u = nodes[i];
                const v = nodes[j];
                const posU = this.positions.get(u);
                const posV = this.positions.get(v);

                let dx = posU.x - posV.x;
                let dy = posU.y - posV.y;
                let distSq = dx * dx + dy * dy || 1;
                let dist = Math.sqrt(distSq);

                const force = this.repulsion / distSq;
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;

                forces.get(u).fx += fx;
                forces.get(u).fy += fy;
                forces.get(v).fx -= fx;
                forces.get(v).fy -= fy;
            }
        }

        // Attraction (Springs)
        for (const edge of this.graph.edges) {
            if (!this.positions.has(edge.from) || !this.positions.has(edge.to)) continue;

            const u = edge.from;
            const v = edge.to;
            const posU = this.positions.get(u);
            const posV = this.positions.get(v);

            let dx = posU.x - posV.x;
            let dy = posU.y - posV.y;
            let dist = Math.sqrt(dx * dx + dy * dy) || 1;

            const force = (dist - this.springLength) * this.springStrength;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            forces.get(u).fx -= fx;
            forces.get(u).fy -= fy;
            forces.get(v).fx += fx;
            forces.get(v).fy += fy;
        }

        // Center gravity (pull to center)
        const cx = this.width / 2;
        const cy = this.height / 2;
        for (const id of nodes) {
            const pos = this.positions.get(id);
            forces.get(id).fx -= (pos.x - cx) * this.centerPull;
            forces.get(id).fy -= (pos.y - cy) * this.centerPull;
        }

        // Apply forces and update positions
        let totalV = 0;
        for (const id of nodes) {
            const pos = this.positions.get(id);
            const force = forces.get(id);

            if (!pos.pinned) {
                pos.vx = (pos.vx + force.fx) * this.damping;
                pos.vy = (pos.vy + force.fy) * this.damping;
                pos.x += pos.vx;
                pos.y += pos.vy;
                totalV += Math.abs(pos.vx) + Math.abs(pos.vy);
            }
        }

        // Stop loop if system is stable
        if (totalV < 0.5) {
            this.animationId = null;
            // Notify renderer final draw
            if (this.onTick) this.onTick();
        } else {
            if (this.onTick) this.onTick();
            this.animationId = requestAnimationFrame(() => this.tick());
        }
    }
}
