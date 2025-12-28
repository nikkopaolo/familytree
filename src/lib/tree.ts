import dagre from "dagre";
import type { Edge, Node } from "reactflow";
import type { Person, Relationship, PersonPosition } from "./types";

const NODE_WIDTH = 280;
const NODE_HEIGHT = 170;
const FAMILY_NODE_SIZE = 12;
const PARTNER_EDGE_WEIGHT = 8;
const PARTNER_EDGE_MINLEN = 1;
const PARENT_EDGE_MINLEN = 1;
const CHILD_EDGE_MINLEN = 1;

export type TreeLayoutDirection = "TB" | "LR";
export type TreeGenerationDirection = "both" | "forward" | "backward";

export type TreeFilter = {
  rootId: string;
  maxDepth: number;
  maxNodes: number;
  generationDirection: TreeGenerationDirection;
};

const buildPositionMap = (positions: PersonPosition[]) =>
  new Map(positions.map((pos) => [pos.personId, { x: pos.x, y: pos.y }]));

export const filterTree = (
  persons: Person[],
  relationships: Relationship[],
  filter: TreeFilter
) => {
  const parentLinks = relationships.filter(
    (rel) => rel.relationshipType === "parent"
  );
  const personMap = new Map(persons.map((person) => [person.id, person]));
  const adjacency = new Map<string, string[]>();
  const addAdjacency = (fromId: string, toId: string) => {
    if (!adjacency.has(fromId)) adjacency.set(fromId, []);
    adjacency.get(fromId)?.push(toId);
  };

  const traversalMode = filter.rootId === "all" ? "both" : filter.generationDirection;
  parentLinks.forEach((rel) => {
    if (traversalMode === "forward" || traversalMode === "both") {
      addAdjacency(rel.parentId, rel.childId);
    }
    if (traversalMode === "backward" || traversalMode === "both") {
      addAdjacency(rel.childId, rel.parentId);
    }
  });

  const selected = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [];

  if (filter.rootId === "all") {
    const childIds = new Set(parentLinks.map((rel) => rel.childId));
    const roots = persons.filter((person) => !childIds.has(person.id));
    const seed = roots.length > 0 ? roots : persons;
    seed.forEach((person) => queue.push({ id: person.id, depth: 0 }));
  } else {
    queue.push({ id: filter.rootId, depth: 0 });
  }

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

  const partnerIds = new Set<string>();
  relationships
    .filter((rel) => rel.relationshipType === "partner")
    .forEach((rel) => {
      if (selected.has(rel.parentId)) partnerIds.add(rel.childId);
      if (selected.has(rel.childId)) partnerIds.add(rel.parentId);
    });
  partnerIds.forEach((id) => selected.add(id));

  const filteredRelationships = relationships.filter(
    (rel) =>
      (rel.relationshipType === "parent" || rel.relationshipType === "partner") &&
      selected.has(rel.parentId) &&
      selected.has(rel.childId)
  );

  const filteredPersons = persons.filter((person) => selected.has(person.id));

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
  graph.setGraph({
    rankdir: direction,
    nodesep: direction === "TB" ? 140 : 110,
    ranksep: direction === "TB" ? 240 : 190,
    edgesep: 30,
    ranker: "network-simplex",
  });

  persons.forEach((person) => {
    graph.setNode(person.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  const parentLinks = relationships.filter(
    (rel) => rel.relationshipType === "parent"
  );
  const partnerLinks = relationships.filter(
    (rel) => rel.relationshipType === "partner"
  );

  const normalizePair = (left: string, right: string) =>
    left < right ? `${left}|${right}` : `${right}|${left}`;
  const partnerPairMap = new Map<string, Relationship>();
  partnerLinks.forEach((rel) => {
    partnerPairMap.set(normalizePair(rel.parentId, rel.childId), rel);
  });

  const parentsByChild = new Map<string, string[]>();
  parentLinks.forEach((rel) => {
    const list = parentsByChild.get(rel.childId) ?? [];
    list.push(rel.parentId);
    parentsByChild.set(rel.childId, list);
  });

  const familyGroups = new Map<
    string,
    { id: string; parentA: string; parentB: string; children: Set<string> }
  >();
  const familyParentChildPairs = new Set<string>();
  const familyPairKeys = new Set<string>();

  parentsByChild.forEach((parentIds, childId) => {
    if (parentIds.length < 2) return;
    let pair: [string, string] | null = null;
    for (let i = 0; i < parentIds.length && !pair; i += 1) {
      for (let j = i + 1; j < parentIds.length; j += 1) {
        const key = normalizePair(parentIds[i], parentIds[j]);
        if (partnerPairMap.has(key)) {
          pair = [parentIds[i], parentIds[j]];
          break;
        }
      }
    }
    if (!pair) return;
    const pairKey = normalizePair(pair[0], pair[1]);
    familyPairKeys.add(pairKey);
    const existing = familyGroups.get(pairKey);
    if (existing) {
      existing.children.add(childId);
    } else {
      familyGroups.set(pairKey, {
        id: `family:${pairKey}`,
        parentA: pair[0],
        parentB: pair[1],
        children: new Set([childId]),
      });
    }
    familyParentChildPairs.add(`${pair[0]}|${childId}`);
    familyParentChildPairs.add(`${pair[1]}|${childId}`);
  });

  familyGroups.forEach((group) => {
    graph.setNode(group.id, { width: FAMILY_NODE_SIZE, height: FAMILY_NODE_SIZE });
    graph.setEdge(group.parentA, group.id, { weight: 1.2, minlen: 1 });
    graph.setEdge(group.parentB, group.id, { weight: 1.2, minlen: 1 });
    graph.setEdge(group.parentA, group.parentB, {
      weight: PARTNER_EDGE_WEIGHT,
      minlen: PARTNER_EDGE_MINLEN,
    });
    group.children.forEach((childId) => {
      graph.setEdge(group.id, childId, { weight: 2, minlen: CHILD_EDGE_MINLEN });
    });
  });

  partnerLinks.forEach((rel) => {
    if (familyPairKeys.has(normalizePair(rel.parentId, rel.childId))) return;
    graph.setEdge(rel.parentId, rel.childId, {
      weight: PARTNER_EDGE_WEIGHT,
      minlen: PARTNER_EDGE_MINLEN,
    });
  });

  parentLinks.forEach((rel) => {
    if (familyParentChildPairs.has(`${rel.parentId}|${rel.childId}`)) return;
    graph.setEdge(rel.parentId, rel.childId, {
      weight: 1.5,
      minlen: PARENT_EDGE_MINLEN,
    });
  });

  const connectivity = new Map<string, string[]>();
  const connect = (fromId: string, toId: string) => {
    if (!connectivity.has(fromId)) connectivity.set(fromId, []);
    connectivity.get(fromId)?.push(toId);
  };

  parentLinks.forEach((rel) => {
    connect(rel.parentId, rel.childId);
    connect(rel.childId, rel.parentId);
  });
  partnerLinks.forEach((rel) => {
    connect(rel.parentId, rel.childId);
    connect(rel.childId, rel.parentId);
  });

  const childIds = new Set(parentLinks.map((rel) => rel.childId));
  const visited = new Set<string>();
  const componentRoots: string[] = [];

  persons.forEach((person) => {
    if (visited.has(person.id)) return;
    const queue = [person.id];
    let rootCandidate = "";
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) continue;
      visited.add(current);
      if (!childIds.has(current) && !rootCandidate) {
        rootCandidate = current;
      }
      const neighbors = connectivity.get(current) ?? [];
      neighbors.forEach((neighbor) => {
        if (!visited.has(neighbor)) queue.push(neighbor);
      });
    }
    componentRoots.push(rootCandidate || person.id);
  });

  if (componentRoots.length > 1) {
    const virtualRootId = "virtual:root";
    graph.setNode(virtualRootId, { width: 1, height: 1 });
    componentRoots.forEach((rootId) => {
      graph.setEdge(virtualRootId, rootId, { weight: 0.1, minlen: 1 });
    });
  }

  dagre.layout(graph);

  const storedPositions = buildPositionMap(positions);

  const resolvedPositions = new Map<string, { x: number; y: number }>();
  const resolvedCenters = new Map<string, { x: number; y: number }>();

  const nodes: Node[] = persons.map((person) => {
    const layoutPosition = graph.node(person.id) ?? { x: 0, y: 0 };
    const stored = storedPositions.get(person.id);
    const manual = manualPositions[person.id];
    const layoutTopLeft = {
      x: layoutPosition.x - NODE_WIDTH / 2,
      y: layoutPosition.y - NODE_HEIGHT / 2,
    };
    const position = manual ?? stored ?? layoutTopLeft;
    resolvedPositions.set(person.id, position);
    resolvedCenters.set(person.id, {
      x: position.x + NODE_WIDTH / 2,
      y: position.y + NODE_HEIGHT / 2,
    });

    return {
      id: person.id,
      type: "person",
      data: person,
      position,
    };
  });
  const familyNodes: Node[] = Array.from(familyGroups.values()).map((group) => {
    const layoutPosition = graph.node(group.id) ?? { x: 0, y: 0 };
    const layoutTopLeft = {
      x: layoutPosition.x - FAMILY_NODE_SIZE / 2,
      y: layoutPosition.y - FAMILY_NODE_SIZE / 2,
    };
    const parentCenters = [group.parentA, group.parentB]
      .map((id) => resolvedCenters.get(id))
      .filter(Boolean) as Array<{ x: number; y: number }>;
    const childCenters = Array.from(group.children)
      .map((id) => resolvedCenters.get(id))
      .filter(Boolean) as Array<{ x: number; y: number }>;
    let centerX = layoutPosition.x;
    let centerY = layoutPosition.y;
    if (parentCenters.length > 0) {
      const avgX =
        parentCenters.reduce((acc, item) => acc + item.x, 0) / parentCenters.length;
      const avgY =
        parentCenters.reduce((acc, item) => acc + item.y, 0) / parentCenters.length;
      const maxParentY = Math.max(...parentCenters.map((item) => item.y));
      const maxParentX = Math.max(...parentCenters.map((item) => item.x));
      const minChildY = childCenters.length
        ? Math.min(...childCenters.map((item) => item.y))
        : maxParentY + 48;
      const minChildX = childCenters.length
        ? Math.min(...childCenters.map((item) => item.x))
        : maxParentX + 48;

      if (direction === "TB") {
        const gap = Math.max(16, Math.min(48, (minChildY - maxParentY) / 2));
        centerX = avgX;
        centerY = maxParentY + gap;
      } else {
        const gap = Math.max(16, Math.min(48, (minChildX - maxParentX) / 2));
        centerX = maxParentX + gap;
        centerY = avgY;
      }
    }

    return {
      id: group.id,
      type: "family",
      data: {
        parents: [group.parentA, group.parentB],
        children: Array.from(group.children),
        direction,
      },
      position: {
        x: centerX - FAMILY_NODE_SIZE / 2,
        y: centerY - FAMILY_NODE_SIZE / 2,
      },
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: false,
    };
  });

  const labelStyle = {
    fill: "rgba(31, 41, 51, 0.75)",
    fontSize: 10,
    fontWeight: 600,
  };
  const parentSourceHandle = direction === "LR" ? "parent-right" : "parent-bottom";
  const parentTargetHandle = direction === "LR" ? "parent-left" : "parent-top";

  const getPartnerEdge = (firstId: string, secondId: string) => {
    const firstCenter = resolvedCenters.get(firstId);
    const secondCenter = resolvedCenters.get(secondId);
    if (!firstCenter || !secondCenter) {
      return direction === "LR"
        ? {
            source: firstId,
            target: secondId,
            sourceHandle: "partner-bottom",
            targetHandle: "partner-top",
          }
        : {
            source: firstId,
            target: secondId,
            sourceHandle: "partner-right",
            targetHandle: "partner-left",
          };
    }
    const deltaX = secondCenter.x - firstCenter.x;
    const deltaY = secondCenter.y - firstCenter.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const useVertical = direction === "LR" ? absY >= absX : absY > absX;

    if (useVertical) {
      const sourceAbove = firstCenter.y <= secondCenter.y;
      return sourceAbove
        ? {
            source: firstId,
            target: secondId,
            sourceHandle: "partner-bottom",
            targetHandle: "partner-top",
          }
        : {
            source: secondId,
            target: firstId,
            sourceHandle: "partner-bottom",
            targetHandle: "partner-top",
          };
    }

    const sourceLeft = firstCenter.x <= secondCenter.x;
    return sourceLeft
      ? {
          source: firstId,
          target: secondId,
          sourceHandle: "partner-right",
          targetHandle: "partner-left",
        }
      : {
          source: secondId,
          target: firstId,
          sourceHandle: "partner-right",
          targetHandle: "partner-left",
        };
  };

  const parentEdges = parentLinks
    .filter((rel) => !familyParentChildPairs.has(`${rel.parentId}|${rel.childId}`))
    .map((rel) => ({
      id: rel.id,
      source: rel.parentId,
      target: rel.childId,
      sourceHandle: parentSourceHandle,
      targetHandle: parentTargetHandle,
      type: "step",
      animated: false,
      label: "Parent of",
      labelStyle,
      labelBgStyle: { fill: "rgba(255, 250, 241, 0.9)" },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 8,
      className: "edge-parent",
      style: { stroke: "rgba(31, 41, 51, 0.7)", strokeWidth: 2.5 },
    }));

  const partnerEdges = partnerLinks.map((rel) => {
    const edge = getPartnerEdge(rel.parentId, rel.childId);
    return {
      id: rel.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      type: "smoothstep",
      animated: false,
      label: "Partner of",
      labelStyle,
      labelBgStyle: { fill: "rgba(255, 250, 241, 0.9)" },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 8,
      className: "edge-partner",
      style: {
        stroke: "rgba(234, 179, 8, 0.7)",
        strokeWidth: 2.5,
        strokeDasharray: "6 4",
      },
    };
  });

  const familyConnectorEdges: Edge[] = [];
  const familyEdges: Edge[] = [];
  const siblingEdges: Edge[] = [];
  const siblingLabelStyle = {
    fill: "rgba(22, 101, 52, 0.75)",
    fontSize: 10,
    fontWeight: 600,
  };

  familyGroups.forEach((group) => {
    familyConnectorEdges.push({
      id: `${group.parentA}->${group.id}`,
      source: group.parentA,
      target: group.id,
      sourceHandle: parentSourceHandle,
      type: "step",
      animated: false,
      className: "edge-parent",
      style: { stroke: "rgba(31, 41, 51, 0.7)", strokeWidth: 2.5 },
    });
    familyConnectorEdges.push({
      id: `${group.parentB}->${group.id}`,
      source: group.parentB,
      target: group.id,
      sourceHandle: parentSourceHandle,
      type: "step",
      animated: false,
      className: "edge-parent",
      style: { stroke: "rgba(31, 41, 51, 0.7)", strokeWidth: 2.5 },
    });
    group.children.forEach((childId) => {
      familyEdges.push({
        id: `${group.id}->${childId}`,
        source: group.id,
        target: childId,
        targetHandle: parentTargetHandle,
        type: "step",
        animated: false,
        label: "Child of",
        labelStyle,
        labelBgStyle: { fill: "rgba(255, 250, 241, 0.9)" },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 8,
        className: "edge-parent",
        style: { stroke: "rgba(31, 41, 51, 0.7)", strokeWidth: 2.5 },
      });
    });

    const children = Array.from(group.children);
    if (children.length > 1) {
      const sorted = children
        .map((childId) => ({
          id: childId,
          x: resolvedCenters.get(childId)?.x ?? graph.node(childId)?.x ?? 0,
        }))
        .sort((a, b) => a.x - b.x)
        .map((item) => item.id);

      for (let i = 0; i < sorted.length - 1; i += 1) {
        const source = sorted[i];
        const target = sorted[i + 1];
        siblingEdges.push({
          id: `sibling:${source}:${target}`,
          source,
          target,
          type: "straight",
          animated: false,
          label: "Sibling of",
          labelStyle: siblingLabelStyle,
          labelBgStyle: { fill: "rgba(240, 253, 244, 0.9)" },
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 8,
          className: "edge-sibling",
          style: {
            stroke: "rgba(22, 101, 52, 0.45)",
            strokeWidth: 2,
            strokeDasharray: "4 4",
          },
        });
      }
    }
  });

  return {
    nodes: [...nodes, ...familyNodes],
    edges: [
      ...parentEdges,
      ...familyConnectorEdges,
      ...familyEdges,
      ...partnerEdges,
      ...siblingEdges,
    ],
  };
};
