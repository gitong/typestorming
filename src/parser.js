
export function parseMarkdown(text) {
  const nodes = new Map();
  const edges = [];
  const lines = text.split('\n');
  
  // Regex patterns
  const nodePattern = /^(\w+)\[title:\s*"([^"]*)",\s*body:\s*"([^"]*)"\]/;
  const labeledEdgePattern = /^(\w+)\s*-\[([^\]]+)\]->\s*(\w+)/;
  const unlabeledEdgePattern = /^(\w+)\s*-->\s*(\w+)/;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Parse Node
    const nodeMatch = trimmed.match(nodePattern);
    if (nodeMatch) {
      const [_, id, title, body] = nodeMatch;
      if (!nodes.has(id)) {
        nodes.set(id, { id, title, body });
      }
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
      edges.push({ from, to });
      continue;
    }
  }
  
  return { nodes, edges };
}

export function serializeGraph(nodes, edges) {
  let output = '## Nodes\n';
  for (const node of nodes.values()) {
    output += `${node.id}[title: "${node.title}", body: "${node.body}"]\n`;
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
