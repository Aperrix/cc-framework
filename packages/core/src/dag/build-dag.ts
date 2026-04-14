import type { Node } from "../schema/node.ts";

export interface DagLayer {
  nodeIds: string[];
}

export function buildDag(nodes: Node[]): DagLayer[] {
  const nodeMap = new Map<string, Node>();
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    inDegree.set(node.id, 0);
    dependents.set(node.id, []);
  }

  for (const node of nodes) {
    for (const dep of node.depends_on) {
      if (!nodeMap.has(dep)) {
        throw new Error(`Node "${node.id}" depends on "${dep}" which does not exist`);
      }
      inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1);
      dependents.get(dep)!.push(node.id);
    }
  }

  const layers: DagLayer[] = [];
  const remaining = new Set(nodes.map((n) => n.id));

  while (remaining.size > 0) {
    const ready: string[] = [];
    for (const id of remaining) {
      if (inDegree.get(id) === 0) {
        ready.push(id);
      }
    }

    if (ready.length === 0) {
      throw new Error(`Cycle detected in DAG — remaining nodes: ${[...remaining].join(", ")}`);
    }

    layers.push({ nodeIds: ready });

    for (const id of ready) {
      remaining.delete(id);
      for (const dependent of dependents.get(id)!) {
        inDegree.set(dependent, inDegree.get(dependent)! - 1);
      }
    }
  }

  return layers;
}
