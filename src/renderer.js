/**
 * TypeStorming Renderer — D3.js SVG-based rendering
 * Renders nodes as rounded rect groups, edges as curved paths with arrowheads.
 */

import * as d3 from 'd3';

export class Renderer {
    constructor(container, graph, layout) {
        this.container = container;
        this.graph = graph;
        this.layout = layout;

        this.selectedNodeId = null;
        this.onNodeClick = null;
        this.onNodeDblClick = null;
        this.onBackgroundClick = null;
        this.onDragEnd = null;

        // Node sizing
        this.nodeWidth = 170;
        this.nodeHeight = 64;
        this.nodeRadius = 10;

        this._setup();
    }

    _setup() {
        // Create SVG
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('id', 'graph-svg');

        // Defs (arrowheads, filters)
        const defs = this.svg.append('defs');

        // Arrowhead marker
        defs.append('marker')
            .attr('id', 'arrowhead')
            .attr('viewBox', '0 0 10 7')
            .attr('refX', 10)
            .attr('refY', 3.5)
            .attr('markerWidth', 10)
            .attr('markerHeight', 7)
            .attr('orient', 'auto')
            .append('polygon')
            .attr('points', '0 0, 10 3.5, 0 7')
            .attr('fill', '#6366f1');

        // Glow filter for selection
        const glowFilter = defs.append('filter')
            .attr('id', 'glow')
            .attr('x', '-50%')
            .attr('y', '-50%')
            .attr('width', '200%')
            .attr('height', '200%');
        glowFilter.append('feGaussianBlur')
            .attr('stdDeviation', '4')
            .attr('result', 'blur');
        glowFilter.append('feFlood')
            .attr('flood-color', '#6366f1')
            .attr('flood-opacity', '0.6')
            .attr('result', 'color');
        glowFilter.append('feComposite')
            .attr('in', 'color')
            .attr('in2', 'blur')
            .attr('operator', 'in')
            .attr('result', 'shadow');
        const glowMerge = glowFilter.append('feMerge');
        glowMerge.append('feMergeNode').attr('in', 'shadow');
        glowMerge.append('feMergeNode').attr('in', 'SourceGraphic');

        // Main group for zoom/pan
        this.g = this.svg.append('g').attr('class', 'canvas-root');

        // Layer groups (edges below nodes)
        this.edgeGroup = this.g.append('g').attr('class', 'edges-layer');
        this.edgeLabelGroup = this.g.append('g').attr('class', 'edge-labels-layer');
        this.nodeGroup = this.g.append('g').attr('class', 'nodes-layer');

        // Zoom behavior
        this.zoom = d3.zoom()
            .scaleExtent([0.1, 5])
            .on('zoom', (event) => {
                this.g.attr('transform', event.transform);
            });

        this.svg.call(this.zoom);

        // Set initial transform: center the viewport on (0,0)
        requestAnimationFrame(() => {
            const svgNode = this.svg.node();
            if (svgNode) {
                const w = svgNode.clientWidth || window.innerWidth;
                const h = svgNode.clientHeight || window.innerHeight;
                const initialTransform = d3.zoomIdentity.translate(w / 2, h / 2);
                this.svg.call(this.zoom.transform, initialTransform);
            }
        });

        // Click on background to deselect
        this.svg.on('click', (event) => {
            if (event.target === this.svg.node()) {
                this.selectedNodeId = null;
                this._updateSelection();
                if (this.onBackgroundClick) this.onBackgroundClick();
            }
        });
    }

    // Build edge set for reciprocal check
    _buildEdgeSet() {
        const set = new Set();
        for (const edge of this.graph.edges) {
            set.add(`${edge.from}->${edge.to}`);
        }
        return set;
    }

    draw() {
        const nodes = this.layout.nodeData;
        const links = this.layout.linkData;
        const edgeSet = this._buildEdgeSet();

        // ===== EDGES =====
        const edgePaths = this.edgeGroup.selectAll('.edge-path')
            .data(links, d => `${d.source.id || d.source}-${d.target.id || d.target}`);

        edgePaths.exit().remove();

        const edgeEnter = edgePaths.enter()
            .append('path')
            .attr('class', 'edge-path')
            .attr('fill', 'none')
            .attr('stroke', '#6366f1')
            .attr('stroke-width', 2)
            .attr('marker-end', 'url(#arrowhead)')
            .attr('stroke-opacity', 0.7);

        const allEdges = edgeEnter.merge(edgePaths);
        allEdges.attr('d', d => this._edgePath(d, edgeSet));

        // ===== EDGE LABELS =====
        const edgeLabels = this.edgeLabelGroup.selectAll('.edge-label-group')
            .data(links.filter(d => d.label), d => `${d.source.id || d.source}-${d.target.id || d.target}`);

        edgeLabels.exit().remove();

        const labelEnter = edgeLabels.enter()
            .append('g')
            .attr('class', 'edge-label-group');

        labelEnter.append('rect')
            .attr('class', 'edge-label-bg')
            .attr('rx', 3)
            .attr('ry', 3);

        labelEnter.append('text')
            .attr('class', 'edge-label-text')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('fill', '#94a3b8')
            .attr('font-size', '11px')
            .attr('font-family', 'Inter, sans-serif');

        const allLabels = labelEnter.merge(edgeLabels);
        allLabels.each((d, i, els) => {
            const g = d3.select(els[i]);
            const sx = typeof d.source === 'object' ? d.source.x : 0;
            const sy = typeof d.source === 'object' ? d.source.y : 0;
            const tx = typeof d.target === 'object' ? d.target.x : 0;
            const ty = typeof d.target === 'object' ? d.target.y : 0;
            const mx = (sx + tx) / 2;
            const my = (sy + ty) / 2;

            // Check for reciprocal — if so, offset label
            const hasReciprocal = edgeSet.has(`${d.target.id || d.target}->${d.source.id || d.source}`);
            let lx = mx, ly = my;
            if (hasReciprocal) {
                const dx = tx - sx;
                const dy = ty - sy;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                lx = mx + (-dy / len) * 30;
                ly = my + (dx / len) * 30;
            }

            const text = g.select('text').text(d.label);
            g.attr('transform', `translate(${lx}, ${ly})`);

            // Size bg rect to text
            const bbox = text.node().getBBox();
            g.select('rect')
                .attr('x', bbox.x - 4)
                .attr('y', bbox.y - 2)
                .attr('width', bbox.width + 8)
                .attr('height', bbox.height + 4)
                .attr('fill', '#0f172a')
                .attr('stroke', 'none');
        });

        // ===== NODES =====
        const nodeGroups = this.nodeGroup.selectAll('.node-group')
            .data(nodes, d => d.id);

        nodeGroups.exit().remove();

        const nodeEnter = nodeGroups.enter()
            .append('g')
            .attr('class', 'node-group')
            .attr('cursor', 'pointer')
            .call(this._drag());

        // Background rect
        nodeEnter.append('rect')
            .attr('class', 'node-rect')
            .attr('width', this.nodeWidth)
            .attr('height', this.nodeHeight)
            .attr('rx', this.nodeRadius)
            .attr('ry', this.nodeRadius)
            .attr('x', -this.nodeWidth / 2)
            .attr('y', -this.nodeHeight / 2);

        // Title text
        nodeEnter.append('text')
            .attr('class', 'node-title')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('y', -8)
            .attr('fill', '#f8fafc')
            .attr('font-weight', 'bold')
            .attr('font-size', '14px')
            .attr('font-family', 'Inter, sans-serif');

        // Body text
        nodeEnter.append('text')
            .attr('class', 'node-body')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('y', 14)
            .attr('fill', '#94a3b8')
            .attr('font-size', '12px')
            .attr('font-family', 'Inter, sans-serif');

        // Click + Dblclick on node
        nodeEnter.on('click', (event, d) => {
            event.stopPropagation();
            this.selectedNodeId = d.id;
            this._updateSelection();
            if (this.onNodeClick) this.onNodeClick(d.id);
        });

        nodeEnter.on('dblclick', (event, d) => {
            event.stopPropagation();
            if (this.onNodeDblClick) this.onNodeDblClick(d.id);
        });

        const allNodes = nodeEnter.merge(nodeGroups);

        // Update positions
        allNodes.attr('transform', d => `translate(${d.x}, ${d.y})`);

        // Update text content (truncate)
        allNodes.select('.node-title')
            .text(d => d.title.length > 22 ? d.title.substring(0, 19) + '…' : d.title);

        allNodes.select('.node-body')
            .text(d => {
                const b = d.body || '';
                return b.length > 25 ? b.substring(0, 22) + '…' : b;
            });

        this._updateSelection();
    }

    _edgePath(d, edgeSet) {
        const sx = typeof d.source === 'object' ? d.source.x : 0;
        const sy = typeof d.source === 'object' ? d.source.y : 0;
        const tx = typeof d.target === 'object' ? d.target.x : 0;
        const ty = typeof d.target === 'object' ? d.target.y : 0;

        const dx = tx - sx;
        const dy = ty - sy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        // Clip start/end to node boundary (approximate with ellipse)
        const nodeRx = this.nodeWidth / 2 + 4;
        const nodeRy = this.nodeHeight / 2 + 4;

        const angle = Math.atan2(dy, dx);
        const startX = sx + Math.cos(angle) * nodeRx;
        const startY = sy + Math.sin(angle) * nodeRy * 0.6;
        const endX = tx - Math.cos(angle) * nodeRx;
        const endY = ty - Math.sin(angle) * nodeRy * 0.6;

        // Check reciprocal
        const srcId = d.source.id || d.source;
        const tgtId = d.target.id || d.target;
        const hasReciprocal = edgeSet.has(`${tgtId}->${srcId}`);

        if (hasReciprocal) {
            // Curve to the right (from source's perspective)
            const mx = (startX + endX) / 2;
            const my = (startY + endY) / 2;
            const nx = -dy / dist;
            const ny = dx / dist;
            const cx = mx + nx * 40;
            const cy = my + ny * 40;
            return `M ${startX},${startY} Q ${cx},${cy} ${endX},${endY}`;
        }

        return `M ${startX},${startY} L ${endX},${endY}`;
    }

    _updateSelection() {
        this.nodeGroup.selectAll('.node-group').each((d, i, els) => {
            const g = d3.select(els[i]);
            const isSelected = d.id === this.selectedNodeId;
            g.select('.node-rect')
                .attr('fill', '#1e293b')
                .attr('stroke', isSelected ? '#6366f1' : '#334155')
                .attr('stroke-width', isSelected ? 2.5 : 1)
                .attr('filter', isSelected ? 'url(#glow)' : 'none');
        });
    }

    _drag() {
        const self = this;
        return d3.drag()
            .on('start', function (event, d) {
                if (!event.active) self.layout.simulation.alphaTarget(0.1).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', function (event, d) {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on('end', function (event, d) {
                if (!event.active) self.layout.simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
                if (self.onDragEnd) self.onDragEnd(d.id);
            });
    }

    centerOnNode(id) {
        const datum = this.layout._nodeMap.get(id);
        if (!datum) return;

        const svgNode = this.svg.node();
        const width = svgNode.clientWidth;
        const height = svgNode.clientHeight;

        const transform = d3.zoomIdentity
            .translate(width / 2, height / 2)
            .scale(1)
            .translate(-datum.x, -datum.y);

        this.svg.transition().duration(500).call(this.zoom.transform, transform);
    }

    // Get screen position of a node (for overlays like inline editing)
    getNodeScreenPosition(id) {
        const datum = this.layout._nodeMap.get(id);
        if (!datum) return null;

        const svgNode = this.svg.node();
        const transform = d3.zoomTransform(svgNode);
        const x = transform.applyX(datum.x);
        const y = transform.applyY(datum.y);

        return { x, y };
    }
}
