import { describe, expect, it } from "vite-plus/test";
import { buildDag, type DagLayer } from "../../src/dag/build-dag.ts";
import type { Node } from "../../src/schema/node.ts";

function makeNode(id: string, deps: string[] = []): Node {
  return {
    id,
    prompt: `Do ${id}`,
    depends_on: deps,
    trigger_rule: "all_success",
    context: "fresh",
  } as Node;
}

describe("buildDag", () => {
  it("puts independent nodes in the same layer", () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
    const layers = buildDag(nodes);
    expect(layers).toHaveLength(1);
    expect(layers[0].nodeIds).toEqual(expect.arrayContaining(["a", "b", "c"]));
  });

  it("builds sequential layers from dependencies", () => {
    const nodes = [makeNode("a"), makeNode("b", ["a"]), makeNode("c", ["b"])];
    const layers = buildDag(nodes);
    expect(layers).toHaveLength(3);
    expect(layers[0].nodeIds).toEqual(["a"]);
    expect(layers[1].nodeIds).toEqual(["b"]);
    expect(layers[2].nodeIds).toEqual(["c"]);
  });

  it("groups parallel nodes in the same layer", () => {
    const nodes = [
      makeNode("scope"),
      makeNode("review-a", ["scope"]),
      makeNode("review-b", ["scope"]),
      makeNode("synthesize", ["review-a", "review-b"]),
    ];
    const layers = buildDag(nodes);
    expect(layers).toHaveLength(3);
    expect(layers[0].nodeIds).toEqual(["scope"]);
    expect(layers[1].nodeIds).toEqual(expect.arrayContaining(["review-a", "review-b"]));
    expect(layers[2].nodeIds).toEqual(["synthesize"]);
  });

  it("detects cycles", () => {
    const nodes = [makeNode("a", ["b"]), makeNode("b", ["a"])];
    expect(() => buildDag(nodes)).toThrow(/cycle/i);
  });

  it("detects missing dependencies", () => {
    const nodes = [makeNode("a", ["nonexistent"])];
    expect(() => buildDag(nodes)).toThrow(/nonexistent/i);
  });
});
