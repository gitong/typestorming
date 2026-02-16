
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
        for (const edge of this.graph.edges) {
            const source = this.layout.positions.get(edge.from);
            const target = this.layout.positions.get(edge.to);
            if (!source || !target) continue;

            this.drawArrow(ctx, source.x, source.y, target.x, target.y, edge.label);
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

    drawArrow(ctx, x1, y1, x2, y2, label) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const angle = Math.atan2(dy, dx);
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Shorten line to not overlap node rect (approx)
        const nodeRadius = 80; // width/2 roughly
        const startX = x1 + Math.cos(angle) * nodeRadius * 0.8;
        const startY = y1 + Math.sin(angle) * 30 * 0.8; // height/2 roughly
        const endX = x2 - Math.cos(angle) * nodeRadius * 0.9;
        const endY = y2 - Math.sin(angle) * 30 * 0.9;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2, endX, endY);
        ctx.stroke();

        // Arrowhead
        const arrowSize = 6;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - arrowSize * Math.cos(angle - Math.PI / 6), endY - arrowSize * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(endX - arrowSize * Math.cos(angle + Math.PI / 6), endY - arrowSize * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fillStyle = '#6366f1';
        ctx.fill();

        // Label
        if (label) {
            ctx.save();
            ctx.translate((x1 + x2) / 2, (y1 + y2) / 2);
            // Rotate text to align with line, but keep readable (upright)
            let textAngle = angle;
            if (textAngle > Math.PI / 2 || textAngle < -Math.PI / 2) textAngle += Math.PI;
            // ctx.rotate(textAngle); // Optional: rotate label with line. Disabling for now for readability

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
