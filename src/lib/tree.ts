import dagre from "dagre";
import type { Edge, Node } from "reactflow";
import type { Person, Relationship, PersonPosition } from "./types";

const NODE_WIDTH = 280;
const NODE_HEIGHT = 170;
const FAMILY_NODE_SIZE = 12;
const PARTNER_EDGE_WEIGHT = 8;
const PARTNER_EDGE_MINLEN = 1;
const FAMILY_PARENT_GAP = 90;
const FAMILY_CHILD_GAP = 110;
const FAMILY_VERTICAL_GAP = 120;

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
  type FamilyUnit = {
    id: string;
    key: string;
    parents: string[];
    children: string[];
  };

  const personById = new Map(persons.map((person) => [person.id, person]));
  const compareByName = (leftId: string, rightId: string) => {
    const leftName = personById.get(leftId)?.fullName ?? "";
    const rightName = personById.get(rightId)?.fullName ?? "";
    return leftName.localeCompare(rightName, undefined, { sensitivity: "base" });
  };

  const parentLinks = relationships.filter(
    (rel) =>
      rel.relationshipType === "parent" &&
      personById.has(rel.parentId) &&
      personById.has(rel.childId)
  );
  const partnerLinks = relationships.filter(
    (rel) =>
      rel.relationshipType === "partner" &&
      personById.has(rel.parentId) &&
      personById.has(rel.childId)
  );

  const normalizePair = (left: string, right: string) =>
    left < right ? `${left}|${right}` : `${right}|${left}`;

  const parentsByChild = new Map<string, Set<string>>();
  parentLinks.forEach((rel) => {
    if (!parentsByChild.has(rel.childId)) {
      parentsByChild.set(rel.childId, new Set());
    }
    parentsByChild.get(rel.childId)?.add(rel.parentId);
  });

  const familyByKey = new Map<string, FamilyUnit>();
  const familyById = new Map<string, FamilyUnit>();
  const parentFamiliesByPerson = new Map<string, Set<string>>();

  const registerParentFamily = (family: FamilyUnit) => {
    family.parents.forEach((parentId) => {
      const existing = parentFamiliesByPerson.get(parentId) ?? new Set<string>();
      existing.add(family.id);
      parentFamiliesByPerson.set(parentId, existing);
    });
  };

  const ensureFamily = (key: string, parents: string[]) => {
    const existing = familyByKey.get(key);
    if (existing) return existing;
    const family: FamilyUnit = {
      id: `family:${key}`,
      key,
      parents: [...parents].sort(compareByName),
      children: [],
    };
    familyByKey.set(key, family);
    familyById.set(family.id, family);
    registerParentFamily(family);
    return family;
  };

  parentsByChild.forEach((parentSet, childId) => {
    const parentIds = Array.from(parentSet).sort(compareByName);
    if (parentIds.length === 0) return;
    const parents = parentIds.length >= 2 ? parentIds.slice(0, 2) : parentIds;
    const key =
      parents.length === 1
        ? `single:${parents[0]}`
        : `pair:${normalizePair(parents[0], parents[1])}`;
    const family = ensureFamily(key, parents);
    if (!family.children.includes(childId)) {
      family.children.push(childId);
    }
  });

  partnerLinks.forEach((rel) => {
    const pairKey = `pair:${normalizePair(rel.parentId, rel.childId)}`;
    ensureFamily(pairKey, [rel.parentId, rel.childId]);
  });

  const personsInFamily = new Set<string>();
  familyById.forEach((family) => {
    family.parents.forEach((parentId) => personsInFamily.add(parentId));
    family.children.forEach((childId) => personsInFamily.add(childId));
  });

  persons.forEach((person) => {
    if (!personsInFamily.has(person.id)) {
      ensureFamily(`solo:${person.id}`, [person.id]);
    }
  });

  const familyEdges: Array<{ from: string; to: string }> = [];
  const familyIncoming = new Map<string, number>();
  familyById.forEach((family) => familyIncoming.set(family.id, 0));

  const familyEdgeKeys = new Set<string>();
  familyById.forEach((family) => {
    family.children.forEach((childId) => {
      const childFamilies = parentFamiliesByPerson.get(childId);
      if (!childFamilies) return;
      childFamilies.forEach((childFamilyId) => {
        if (childFamilyId === family.id) return;
        const edgeKey = `${family.id}->${childFamilyId}`;
        if (familyEdgeKeys.has(edgeKey)) return;
        familyEdgeKeys.add(edgeKey);
        familyEdges.push({ from: family.id, to: childFamilyId });
        familyIncoming.set(
          childFamilyId,
          (familyIncoming.get(childFamilyId) ?? 0) + 1
        );
      });
    });
  });

  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: direction,
    nodesep: direction === "TB" ? 180 : 150,
    ranksep: direction === "TB" ? 300 : 260,
    edgesep: 40,
    ranker: "network-simplex",
  });

  const getFamilySize = (family: FamilyUnit) => {
    const parentCount = Math.max(family.parents.length, 1);
    const childCount = Math.max(family.children.length, 1);
    if (direction === "TB") {
      const parentWidth =
        parentCount * NODE_WIDTH + (parentCount - 1) * FAMILY_PARENT_GAP;
      const childWidth =
        childCount * NODE_WIDTH + (childCount - 1) * FAMILY_CHILD_GAP;
      return {
        width: Math.max(parentWidth, childWidth, NODE_WIDTH),
        height: NODE_HEIGHT * 2 + FAMILY_VERTICAL_GAP * 2,
      };
    }
    const parentHeight =
      parentCount * NODE_HEIGHT + (parentCount - 1) * FAMILY_PARENT_GAP;
    const childHeight =
      childCount * NODE_HEIGHT + (childCount - 1) * FAMILY_CHILD_GAP;
    return {
      width: NODE_WIDTH * 2 + FAMILY_VERTICAL_GAP * 2,
      height: Math.max(parentHeight, childHeight, NODE_HEIGHT),
    };
  };

  familyById.forEach((family) => {
    const size = getFamilySize(family);
    graph.setNode(family.id, size);
  });

  familyEdges.forEach((edge) => {
    graph.setEdge(edge.from, edge.to, { weight: 1, minlen: 1 });
  });

  const roots = Array.from(familyById.values()).filter(
    (family) => (familyIncoming.get(family.id) ?? 0) === 0
  );

  if (roots.length > 1) {
    const rootId = "family:root";
    graph.setNode(rootId, { width: 1, height: 1 });
    roots.forEach((root) => {
      graph.setEdge(rootId, root.id, { weight: 0.1, minlen: 1 });
    });
  }

  dagre.layout(graph);

  const familyLayoutPositions = new Map<string, { x: number; y: number }>();
  familyById.forEach((family) => {
    const layout = graph.node(family.id) ?? { x: 0, y: 0 };
    familyLayoutPositions.set(family.id, { x: layout.x, y: layout.y });
  });

  const parentAnchors = new Map<string, Array<{ x: number; y: number }>>();
  const addAnchor = (personId: string, x: number, y: number) => {
    const anchors = parentAnchors.get(personId) ?? [];
    anchors.push({ x, y });
    parentAnchors.set(personId, anchors);
  };

  familyById.forEach((family) => {
    if (family.parents.length === 0) return;
    const layout = familyLayoutPositions.get(family.id) ?? { x: 0, y: 0 };
    const parentCount = family.parents.length;
    if (direction === "TB") {
      const totalWidth =
        parentCount * NODE_WIDTH + (parentCount - 1) * FAMILY_PARENT_GAP;
      const startX = layout.x - totalWidth / 2;
      const parentY = layout.y - (NODE_HEIGHT / 2 + FAMILY_VERTICAL_GAP);
      family.parents.forEach((parentId, index) => {
        const anchorX = startX + index * (NODE_WIDTH + FAMILY_PARENT_GAP);
        addAnchor(parentId, anchorX, parentY);
      });
    } else {
      const totalHeight =
        parentCount * NODE_HEIGHT + (parentCount - 1) * FAMILY_PARENT_GAP;
      const startY = layout.y - totalHeight / 2;
      const parentX = layout.x - (NODE_WIDTH / 2 + FAMILY_VERTICAL_GAP);
      family.parents.forEach((parentId, index) => {
        const anchorY = startY + index * (NODE_HEIGHT + FAMILY_PARENT_GAP);
        addAnchor(parentId, parentX, anchorY);
      });
    }
  });

  const personPositions = new Map<string, { x: number; y: number }>();
  parentAnchors.forEach((anchors, personId) => {
    const avgX = anchors.reduce((acc, item) => acc + item.x, 0) / anchors.length;
    const avgY = anchors.reduce((acc, item) => acc + item.y, 0) / anchors.length;
    personPositions.set(personId, { x: avgX, y: avgY });
  });

  const familyCenters = new Map<string, { x: number; y: number }>();
  familyById.forEach((family) => {
    const layout = familyLayoutPositions.get(family.id) ?? { x: 0, y: 0 };
    if (family.parents.length > 0) {
      const parentPositions = family.parents
        .map((parentId) => personPositions.get(parentId))
        .filter(Boolean) as Array<{ x: number; y: number }>;
      if (parentPositions.length > 0) {
        if (direction === "TB") {
          const avgX =
            parentPositions.reduce((acc, item) => acc + item.x, 0) /
            parentPositions.length;
          familyCenters.set(family.id, { x: avgX, y: layout.y });
          return;
        }
        const avgY =
          parentPositions.reduce((acc, item) => acc + item.y, 0) /
          parentPositions.length;
        familyCenters.set(family.id, { x: layout.x, y: avgY });
        return;
      }
    }
    familyCenters.set(family.id, layout);
  });

  familyById.forEach((family) => {
    const center = familyCenters.get(family.id) ?? { x: 0, y: 0 };
    const leafChildren = family.children.filter(
      (childId) => !parentAnchors.has(childId)
    );
    if (leafChildren.length === 0) return;
    const sortedChildren = [...leafChildren].sort(compareByName);
    if (direction === "TB") {
      const totalWidth =
        sortedChildren.length * NODE_WIDTH +
        (sortedChildren.length - 1) * FAMILY_CHILD_GAP;
      const startX = center.x - totalWidth / 2;
      const childY = center.y + (NODE_HEIGHT / 2 + FAMILY_VERTICAL_GAP);
      sortedChildren.forEach((childId, index) => {
        if (personPositions.has(childId)) return;
        const x = startX + index * (NODE_WIDTH + FAMILY_CHILD_GAP);
        personPositions.set(childId, { x, y: childY });
      });
    } else {
      const totalHeight =
        sortedChildren.length * NODE_HEIGHT +
        (sortedChildren.length - 1) * FAMILY_CHILD_GAP;
      const startY = center.y - totalHeight / 2;
      const childX = center.x + (NODE_WIDTH / 2 + FAMILY_VERTICAL_GAP);
      sortedChildren.forEach((childId, index) => {
        if (personPositions.has(childId)) return;
        const y = startY + index * (NODE_HEIGHT + FAMILY_CHILD_GAP);
        personPositions.set(childId, { x: childX, y });
      });
    }
  });

  persons.forEach((person) => {
    if (!personPositions.has(person.id)) {
      personPositions.set(person.id, { x: 0, y: 0 });
    }
  });

  const storedPositions = buildPositionMap(positions);
  const resolvedPositions = new Map<string, { x: number; y: number }>();
  const resolvedCenters = new Map<string, { x: number; y: number }>();

  const nodes: Node[] = persons.map((person) => {
    const computed = personPositions.get(person.id) ?? { x: 0, y: 0 };
    const stored = storedPositions.get(person.id);
    const manual = manualPositions[person.id];
    const layoutTopLeft = {
      x: computed.x - NODE_WIDTH / 2,
      y: computed.y - NODE_HEIGHT / 2,
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

  const familyNodes: Node[] = Array.from(familyById.values()).map((family) => {
    const center = familyCenters.get(family.id) ?? { x: 0, y: 0 };
    return {
      id: family.id,
      type: "family",
      data: {
        parents: family.parents,
        children: family.children,
        direction,
      },
      position: {
        x: center.x - FAMILY_NODE_SIZE / 2,
        y: center.y - FAMILY_NODE_SIZE / 2,
      },
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: false,
    };
  });

  const labelStyle = {
    fill: "var(--tree-label)",
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

  const familyConnectorEdges: Edge[] = [];
  const familyEdgesOut: Edge[] = [];
  const siblingEdges: Edge[] = [];
  const partnerEdges: Edge[] = [];
  const siblingLabelStyle = {
    fill: "var(--tree-sibling-label)",
    fontSize: 10,
    fontWeight: 600,
  };

  const familyByPairKey = new Map<string, FamilyUnit>();
  familyById.forEach((family) => {
    if (family.parents.length === 2) {
      familyByPairKey.set(normalizePair(family.parents[0], family.parents[1]), family);
    }
  });

  familyById.forEach((family) => {
    family.parents.forEach((parentId) => {
      familyConnectorEdges.push({
        id: `${parentId}->${family.id}`,
        source: parentId,
        target: family.id,
        sourceHandle: parentSourceHandle,
        type: "step",
        animated: false,
        className: "edge-parent",
        style: { stroke: "var(--tree-edge)", strokeWidth: 3 },
      });
    });

    family.children.forEach((childId) => {
      familyEdgesOut.push({
        id: `${family.id}->${childId}`,
        source: family.id,
        target: childId,
        targetHandle: parentTargetHandle,
        type: "step",
        animated: false,
        label: "Child of",
        labelStyle,
        labelBgStyle: { fill: "var(--tree-label-bg)" },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 8,
        className: "edge-parent",
        style: { stroke: "var(--tree-edge)", strokeWidth: 3 },
      });
    });

    if (family.children.length > 1) {
      const sorted = [...family.children]
        .map((childId) => ({
          id: childId,
          x: resolvedCenters.get(childId)?.x ?? 0,
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
          labelBgStyle: { fill: "var(--tree-sibling-label-bg)" },
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 8,
          className: "edge-sibling",
          style: {
            stroke: "var(--tree-sibling)",
            strokeWidth: 2.5,
            strokeDasharray: "4 4",
          },
        });
      }
    }
  });

  partnerLinks.forEach((rel) => {
    const pairKey = normalizePair(rel.parentId, rel.childId);
    const family = familyByPairKey.get(pairKey);
    if (family && family.children.length > 0) return;
    const edge = getPartnerEdge(rel.parentId, rel.childId);
    partnerEdges.push({
      id: rel.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      type: "smoothstep",
      animated: false,
      label: "Partner of",
      labelStyle,
      labelBgStyle: { fill: "var(--tree-label-bg)" },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 8,
      className: "edge-partner",
      style: {
        stroke: "var(--tree-partner)",
        strokeWidth: 3,
        strokeDasharray: "6 4",
      },
    });
  });

  return {
    nodes: [...nodes, ...familyNodes],
    edges: [...familyConnectorEdges, ...familyEdgesOut, ...partnerEdges, ...siblingEdges],
  };
};
