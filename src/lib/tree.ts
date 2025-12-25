import dagre from "dagre";
import type { Edge, Node } from "reactflow";
import type { Person, Relationship, PersonPosition } from "./types";

const NODE_WIDTH = 230;
const NODE_HEIGHT = 110;

export type TreeLayoutDirection = "TB" | "LR";

export type TreeFilter = {
  rootId: string;
  maxDepth: number;
  maxNodes: number;
};

const buildPositionMap = (positions: PersonPosition[]) =>
  new Map(positions.map((pos) => [pos.personId, { x: pos.x, y: pos.y }]));

export const filterTree = (
  persons: Person[],
  relationships: Relationship[],
  filter: TreeFilter
) => {
  const personMap = new Map(persons.map((person) => [person.id, person]));
  const adjacency = new Map<string, string[]>();

  relationships
    .filter((rel) => rel.relationshipType === "parent")
    .forEach((rel) => {
      if (!adjacency.has(rel.parentId)) adjacency.set(rel.parentId, []);
      if (!adjacency.has(rel.childId)) adjacency.set(rel.childId, []);
      adjacency.get(rel.parentId)?.push(rel.childId);
      adjacency.get(rel.childId)?.push(rel.parentId);
    });

  const selected = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [
    { id: filter.rootId, depth: 0 },
  ];

  while (queue.length > 0 && selected.size < filter.maxNodes) {
    const current = queue.shift();
    if (!current) break;
    if (selected.has(current.id)) continue;
    if (!personMap.has(current.id)) continue;
    selected.add(current.id);

    if (current.depth < filter.maxDepth) {
      const neighbors = adjacency.get(current.id) ?? [];
      neighbors.forEach((neighborId) =>
        queue.push({ id: neighborId, depth: current.depth + 1 })
      );
    }
  }

  const filteredPersons = persons.filter((person) => selected.has(person.id));
  const filteredRelationships = relationships.filter(
    (rel) =>
      rel.relationshipType === "parent" &&
      selected.has(rel.parentId) &&
      selected.has(rel.childId)
  );

  return { filteredPersons, filteredRelationships };
};

export const buildTreeGraph = ({
  persons,
  relationships,
  positions,
  direction,
  manualPositions,
}: {
  persons: Person[];
  relationships: Relationship[];
  positions: PersonPosition[];
  direction: TreeLayoutDirection;
  manualPositions: Record<string, { x: number; y: number }>;
}) => {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: direction, nodesep: 40, ranksep: 90 });

  persons.forEach((person) => {
    graph.setNode(person.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  relationships
    .filter((rel) => rel.relationshipType === "parent")
    .forEach((rel) => {
      graph.setEdge(rel.parentId, rel.childId);
    });

  dagre.layout(graph);

  const storedPositions = buildPositionMap(positions);

  const nodes: Node[] = persons.map((person) => {
    const layoutPosition = graph.node(person.id) ?? { x: 0, y: 0 };
    const stored = storedPositions.get(person.id);
    const manual = manualPositions[person.id];
    const layoutTopLeft = {
      x: layoutPosition.x - NODE_WIDTH / 2,
      y: layoutPosition.y - NODE_HEIGHT / 2,
    };
    const position = manual ?? stored ?? layoutTopLeft;

    return {
      id: person.id,
      type: "person",
      data: person,
      position,
    };
  });

  const edges: Edge[] = relationships
    .filter((rel) => rel.relationshipType === "parent")
    .map((rel) => ({
      id: rel.id,
      source: rel.parentId,
      target: rel.childId,
      type: "smoothstep",
      animated: false,
      style: { stroke: "rgba(31, 41, 51, 0.5)", strokeWidth: 2 },
    }));

  return { nodes, edges };
};
