/**
 * TypeStorming Parser — Spec-compliant markdown graph notation
 * Format: NodeID[#Title; Body]
 * Edges: A --> B  or  A -[label]-> B
 */

export function parseMarkdown(text) {
  const nodes = new Map();
  const edges = [];
  const warnings = [];
  const lines = text.split('\n');

  // Regex patterns
  // Node: NodeID[#Title; Body]  or  NodeID[##Title; Body]
  const nodePattern = /^(\w+)\[([^\]]+)\]/;
  const labeledEdgePattern = /^(\w+)\s*-\[([^\]]+)\]->\s*(\w+)/;
  const unlabeledEdgePattern = /^(\w+)\s*-->\s*(\w+)/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') && trimmed.includes(' ')) continue; // skip section headers like "## Nodes"

    // Parse Node
    const nodeMatch = trimmed.match(nodePattern);
    if (nodeMatch) {
      const [_, id, inner] = nodeMatch;

      // Check for duplicate
      if (nodes.has(id)) {
        warnings.push(`Duplicate NodeID "${id}" ignored (line: ${trimmed})`);
        continue;
      }

      // Parse inner: expect #Title; Body  or  ##Title; Body etc.
      let title = '';
      let body = '';
      let level = 1;

      // Extract heading level
      const headingMatch = inner.match(/^(#{1,6})\s*(.*)/);
      if (headingMatch) {
        level = headingMatch[1].length;
        const rest = headingMatch[2];

        // Split on first semicolon for title ; body
        const semiIdx = rest.indexOf(';');
        if (semiIdx !== -1) {
          title = rest.substring(0, semiIdx).trim();
          body = rest.substring(semiIdx + 1).trim();
        } else {
          title = rest.trim();
        }
      } else {
        // No heading marker — treat entire inner as title
        const semiIdx = inner.indexOf(';');
        if (semiIdx !== -1) {
          title = inner.substring(0, semiIdx).trim();
          body = inner.substring(semiIdx + 1).trim();
        } else {
          title = inner.trim();
        }
      }

      nodes.set(id, { id, title, body, level });
      continue;
    }

    // Parse Labeled Edge
    const labeledMatch = trimmed.match(labeledEdgePattern);
    if (labeledMatch) {
      const [_, from, label, to] = labeledMatch;
      edges.push({ from, to, label });
      continue;
    }

    // Parse Unlabeled Edge
    const unlabeledMatch = trimmed.match(unlabeledEdgePattern);
    if (unlabeledMatch) {
      const [_, from, to] = unlabeledMatch;
      edges.push({ from, to, label: '' });
      continue;
    }
  }

  return { nodes, edges, warnings };
}

export function serializeGraph(nodes, edges) {
  let output = '## Nodes\n';
  for (const node of nodes.values()) {
    const hashes = '#'.repeat(node.level || 1);
    if (node.body) {
      output += `${node.id}[${hashes}${node.title}; ${node.body}]\n`;
    } else {
      output += `${node.id}[${hashes}${node.title}; ]\n`;
    }
  }

  output += '\n## Relationships\n';
  for (const edge of edges) {
    if (edge.label) {
      output += `${edge.from} -[${edge.label}]-> ${edge.to}\n`;
    } else {
      output += `${edge.from} --> ${edge.to}\n`;
    }
  }

  return output;
}
