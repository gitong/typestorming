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
}
