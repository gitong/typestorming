
export class Renderer {
    constructor(canvas, graph, layout) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.graph = graph;
        this.layout = layout;

        this.offset = { x: 0, y: 0 };
        this.scale = 1;
        this.selectedNodeId = null;
        this.hoverNodeId = null;

        // Connect layout tick to draw
        this.layout.onTick = () => this.draw();

        this.setupEvents();
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.layout.setSize(this.canvas.width, this.canvas.height);
        this.draw();
    }

    setupEvents() {
        // Zoom handling
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
    }

    handleWheel(e) {
        e.preventDefault();

        const zoomIntensity = 0.1;
        const delta = e.deltaY < 0 ? 1 : -1;
        const zoomFactor = Math.exp(delta * zoomIntensity);

        // Calculate world coordinates of mouse before zoom
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldPos = this.screenToWorld(mouseX, mouseY);

        // Apply zoom
        this.scale *= zoomFactor;

        // Clamp scale
        this.scale = Math.max(0.1, Math.min(this.scale, 5));

        // Calculate new screen position of that world point
        // screenX = (worldX - centerX) * scale + centerX + offset.x
        // We want screenX to remain mouseX, so we solve for offset.x
        // offset.x = mouseX - centerX - (worldX - centerX) * scale

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        this.offset.x = mouseX - centerX - (worldPos.x - centerX) * this.scale;
        this.offset.y = mouseY - centerY - (worldPos.y - centerY) * this.scale;

        this.draw();
    }

    screenToWorld(screenX, screenY) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        const worldX = (screenX - centerX - this.offset.x) / this.scale + centerX;
        const worldY = (screenY - centerY - this.offset.y) / this.scale + centerY;

        return { x: worldX, y: worldY };
    }

    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        ctx.translate(this.canvas.width / 2 + this.offset.x, this.canvas.height / 2 + this.offset.y);
        ctx.scale(this.scale, this.scale);
        // Translate back so (0,0) is center of canvas before offset
        ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);

        // Draw Edges
        ctx.strokeStyle = '#6366f1'; // accent color
        ctx.lineWidth = 2;

        // Map for quick lookup of inverse edges
        const edgeMap = new Set();
        for (const edge of this.graph.edges) {
            edgeMap.add(`${edge.from}-${edge.to}`);
        }

        for (const edge of this.graph.edges) {
            const source = this.layout.positions.get(edge.from);
            const target = this.layout.positions.get(edge.to);
            if (!source || !target) continue;

            // Check for reciprocal edge: target -> source
            const hasReciprocal = edgeMap.has(`${edge.to}-${edge.from}`);

            // If reciprocal exists, we curve to the right (offset positive)
            // Since the other edge will also curve to ITS right (which is our left), they separate.
            const offset = hasReciprocal ? 40 : 0;

            this.drawArrow(ctx, source.x, source.y, target.x, target.y, edge.label, offset);
        }

        // Draw Nodes
        for (const [id, node] of this.graph.nodes) {
            const pos = this.layout.positions.get(id);
            if (!pos) continue;

            this.drawNode(ctx, node, pos.x, pos.y, id === this.selectedNodeId);
        }

        ctx.restore();
    }

    drawNode(ctx, node, x, y, isSelected) {
        const w = 160;
        const h = 60;
        const r = 8;

        // Shadow/Glow
        if (isSelected) {
            ctx.shadowColor = '#6366f1';
            ctx.shadowBlur = 15;
        } else {
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            ctx.shadowBlur = 5;
        }
        ctx.shadowOffsetY = 2;

        // Box
        ctx.fillStyle = '#1e293b'; // slate-800
        ctx.beginPath();
        // roundRect polyfill or standard
        if (ctx.roundRect) {
            ctx.roundRect(x - w / 2, y - h / 2, w, h, r);
        } else {
            ctx.rect(x - w / 2, y - h / 2, w, h);
        }
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // Border
        ctx.strokeStyle = isSelected ? '#6366f1' : '#334155';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();

        // Text
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Title
        ctx.fillStyle = '#f8fafc'; // slate-50
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.fillText(node.title, x, y - 10);

        // Body
        ctx.fillStyle = '#94a3b8'; // slate-400
        ctx.font = '12px Inter, sans-serif';
        const body = node.body.length > 20 ? node.body.substring(0, 17) + '...' : node.body;
        ctx.fillText(body, x, y + 15);
    }

    drawArrow(ctx, x1, y1, x2, y2, label, offset = 0) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist === 0) return;

        // Midpoint
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;

        // Control point calculation (Normal vector * offset)
        // Normal vector (-dy, dx)
        let cx = mx;
        let cy = my;

        if (offset !== 0) {
            const len = Math.sqrt(dx * dx + dy * dy);
            const nx = -dy / len;
            const ny = dx / len;
            cx = mx + nx * offset;
            cy = my + ny * offset;
        }

        // Calculate intersection with Node Box (approximate)
        // We use the angle from Control Point to End Point for better arrow entry
        const angleToEnd = Math.atan2(y2 - cy, x2 - cx);
        const angleFromStart = Math.atan2(cy - y1, cx - x1);

        const nodeWidth = 160;
        const nodeHeight = 60;

        // Simple rectangular clipping approximation
        // For accurate clipping we'd need exact intersection, but this suffices for UI
        // We push the start/end points out from the node centers

        // Rough radius proxy
        const padding = 10;
        // Use a heuristic: shorter axis dominant
        const r = 50;

        const startX = x1 + Math.cos(angleFromStart) * r;
        const startY = y1 + Math.sin(angleFromStart) * 30; // ellipse-ish

        const endX = x2 - Math.cos(angleToEnd) * r;
        const endY = y2 - Math.sin(angleToEnd) * 30;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(cx, cy, endX, endY);
        ctx.stroke();

        // Arrowhead
        const arrowSize = 6;
        const arrowAngle = angleToEnd; // Tangent at end

        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - arrowSize * Math.cos(arrowAngle - Math.PI / 6), endY - arrowSize * Math.sin(arrowAngle - Math.PI / 6));
        ctx.lineTo(endX - arrowSize * Math.cos(arrowAngle + Math.PI / 6), endY - arrowSize * Math.sin(arrowAngle + Math.PI / 6));
        ctx.closePath();
        ctx.fillStyle = '#6366f1';
        ctx.fill();

        // Label
        if (label) {
            ctx.save();
            // Position at peak of curve (t=0.5 for Quad Bezier is actually p_0.5 = 0.25*P0 + 0.5*P1 + 0.25*P2)
            // But conceptually "cx, cy" is the control point, which pulls the curve.
            // The actual midpoint of the curve is:
            const midCurveX = 0.25 * startX + 0.5 * cx + 0.25 * endX;
            const midCurveY = 0.25 * startY + 0.5 * cy + 0.25 * endY;

            ctx.translate(midCurveX, midCurveY);

            ctx.font = '11px Inter, sans-serif';
            const textWidth = ctx.measureText(label).width;

            // Label Background
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-textWidth / 2 - 4, -8, textWidth + 8, 16);

            ctx.fillStyle = '#94a3b8';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, 0, 0);
            ctx.restore();
        }
    }

    // Hit testing logic for selection
    getNodeAt(x, y) {
        // Transform screen coords to world coords
        const worldPos = this.screenToWorld(x, y);
        const worldX = worldPos.x;
        const worldY = worldPos.y;

        for (const [id, _] of this.graph.nodes) {
            const pos = this.layout.positions.get(id);
            if (!pos) continue;

            const dx = Math.abs(worldX - pos.x);
            const dy = Math.abs(worldY - pos.y);

            if (dx < 80 && dy < 30) {
                return id;
            }
        }
        return null;
    }

    centerOnNode(id) {
        const layoutPos = this.layout.positions.get(id);
        if (!layoutPos) return;

        // We want world coordinates (layoutPos.x, layoutPos.y) to be at screen center
        // center = (world - center) * scale + center + offset
        // 0 = (world - center) * scale + offset
        // offset = -(world - center) * scale

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        this.offset.x = -(layoutPos.x - centerX) * this.scale;
        this.offset.y = -(layoutPos.y - centerY) * this.scale;

        this.draw();
    }

    worldToScreen(x, y) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        const screenX = (x - centerX) * this.scale + centerX + this.offset.x;
        const screenY = (y - centerY) * this.scale + centerY + this.offset.y;

        return { x: screenX, y: screenY };
    }
}
