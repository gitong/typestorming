/**
 * TypeStorming Layout — D3-Force based simulation
 */

import * as d3 from 'd3';

export class ForceLayout {
    constructor(graph) {
        this.graph = graph;
        this.simulation = null;
        this.nodeData = [];
        this.linkData = [];
        this.onTick = null;

        this._nodeMap = new Map(); // id -> node datum (for fx/fy pinning)
    }

    init() {
        this.simulation = d3.forceSimulation()
            .force('charge', d3.forceManyBody().strength(-800))
            .force('link', d3.forceLink().id(d => d.id).distance(300).strength(0.3))
            .force('center', d3.forceCenter(0, 0))
            .force('collide', d3.forceCollide().radius(150))
            .alphaDecay(0.02)
            .on('tick', () => {
                if (this.onTick) this.onTick();
            });

        this.simulation.stop();
    }

    update() {
        // Build node data — preserve existing positions
        const existingPositions = new Map();
        for (const nd of this.nodeData) {
            existingPositions.set(nd.id, { x: nd.x, y: nd.y, vx: nd.vx, vy: nd.vy, fx: nd.fx, fy: nd.fy });
        }

        this.nodeData = [];
        this._nodeMap.clear();

        for (const [id, node] of this.graph.nodes) {
            const existing = existingPositions.get(id);
            const datum = {
                id,
                title: node.title,
                body: node.body,
                level: node.level || 1,
                x: existing ? existing.x : (Math.random() - 0.5) * 300,
                y: existing ? existing.y : (Math.random() - 0.5) * 300,
                vx: existing ? existing.vx : 0,
                vy: existing ? existing.vy : 0,
                fx: existing ? existing.fx : null,
                fy: existing ? existing.fy : null,
            };
            this.nodeData.push(datum);
            this._nodeMap.set(id, datum);
        }

        // Build link data
        this.linkData = [];
        for (const edge of this.graph.edges) {
            if (this._nodeMap.has(edge.from) && this._nodeMap.has(edge.to)) {
                this.linkData.push({
                    source: edge.from,
                    target: edge.to,
                    label: edge.label || '',
                });
            }
        }

        // Update simulation
        this.simulation.nodes(this.nodeData);
        this.simulation.force('link').links(this.linkData);

        // Reheat
        this.simulation.alpha(0.3).restart();
    }

    pinNode(id, x, y) {
        const datum = this._nodeMap.get(id);
        if (datum) {
            datum.fx = x;
            datum.fy = y;
        }
    }

    unpinNode(id) {
        const datum = this._nodeMap.get(id);
        if (datum) {
            datum.fx = null;
            datum.fy = null;
        }
    }

    getNodePosition(id) {
        const datum = this._nodeMap.get(id);
        return datum ? { x: datum.x, y: datum.y } : null;
    }

    stop() {
        if (this.simulation) this.simulation.stop();
    }

    reLayout() {
        // Step 1: Unpin all nodes
        for (const datum of this.nodeData) {
            datum.fx = null;
            datum.fy = null;
        }

        // Step 2: BFS tree-layout for initial positions (reduces crossings)
        const adjacency = new Map();
        const inDegree = new Map();
        for (const datum of this.nodeData) {
            adjacency.set(datum.id, []);
            inDegree.set(datum.id, 0);
        }
        for (const link of this.linkData) {
            const from = link.source.id || link.source;
            const to = link.target.id || link.target;
            if (adjacency.has(from)) adjacency.get(from).push(to);
            inDegree.set(to, (inDegree.get(to) || 0) + 1);
        }

        // Find roots (no incoming edges)
        const roots = this.nodeData.filter(d => (inDegree.get(d.id) || 0) === 0);
        if (roots.length === 0 && this.nodeData.length > 0) roots.push(this.nodeData[0]);

        const visited = new Set();
        const levelSpacingX = 300;
        const levelSpacingY = 150;
        let currentCol = 0;

        for (const root of roots) {
            // BFS from each root
            const queue = [{ id: root.id, depth: 0 }];
            visited.add(root.id);
            const levels = new Map(); // depth -> [ids]

            while (queue.length > 0) {
                const { id, depth } = queue.shift();
                if (!levels.has(depth)) levels.set(depth, []);
                levels.get(depth).push(id);

                const children = adjacency.get(id) || [];
                for (const child of children) {
                    if (!visited.has(child)) {
                        visited.add(child);
                        queue.push({ id: child, depth: depth + 1 });
                    }
                }
            }

            // Position nodes by level
            for (const [depth, ids] of levels) {
                ids.forEach((id, idx) => {
                    const datum = this._nodeMap.get(id);
                    if (datum) {
                        datum.x = currentCol * levelSpacingX + (idx - (ids.length - 1) / 2) * levelSpacingY;
                        datum.y = depth * levelSpacingY;
                        datum.vx = 0;
                        datum.vy = 0;
                    }
                });
            }
            currentCol++;
        }

        // Place any unvisited nodes
        let orphanIdx = 0;
        for (const datum of this.nodeData) {
            if (!visited.has(datum.id)) {
                datum.x = currentCol * levelSpacingX + orphanIdx * 100;
                datum.y = 0;
                datum.vx = 0;
                datum.vy = 0;
                orphanIdx++;
            }
        }

        // Step 3: Restart simulation to refine
        this.simulation.alpha(0.8).restart();
    }
}
