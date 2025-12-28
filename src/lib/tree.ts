import dagre from "dagre";
import type { Edge, Node } from "reactflow";
import type { Person, Relationship, PersonPosition } from "./types";

const NODE_WIDTH = 280;
const NODE_HEIGHT = 170;
const FAMILY_NODE_SIZE = 12;
const PARTNER_EDGE_WEIGHT = 8;
const PARTNER_EDGE_MINLEN = 1;
const FAMILY_PARENT_GAP = 60;
const FAMILY_CHILD_GAP = 60;
const FAMILY_VERTICAL_GAP = 90;

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
    nodesep: direction === "TB" ? 120 : 100,
    ranksep: direction === "TB" ? 260 : 220,
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

  const familyCenters = new Map<string, { x: number; y: number }>(
    familyLayoutPositions
  );

  const familyAdj = new Map<string, string[]>();
  familyById.forEach((family) => {
    familyAdj.set(family.id, []);
  });
  familyEdges.forEach((edge) => {
    familyAdj.get(edge.from)?.push(edge.to);
  });

  const incomingCounts = new Map(familyIncoming);
  const familyQueue = [...roots]
    .sort((left, right) => {
      const leftPos = familyLayoutPositions.get(left.id) ?? { x: 0, y: 0 };
      const rightPos = familyLayoutPositions.get(right.id) ?? { x: 0, y: 0 };
      return direction === "TB" ? leftPos.x - rightPos.x : leftPos.y - rightPos.y;
    })
    .map((family) => family.id);

  const orderedFamilyIds: string[] = [];
  while (familyQueue.length > 0) {
    const familyId = familyQueue.shift();
    if (!familyId) break;
    orderedFamilyIds.push(familyId);
    const neighbors = familyAdj.get(familyId) ?? [];
    neighbors.forEach((neighbor) => {
      const nextCount = (incomingCounts.get(neighbor) ?? 0) - 1;
      incomingCounts.set(neighbor, nextCount);
      if (nextCount === 0) {
        familyQueue.push(neighbor);
      }
    });
  }

  if (orderedFamilyIds.length < familyById.size) {
    familyById.forEach((family) => {
      if (!orderedFamilyIds.includes(family.id)) {
        orderedFamilyIds.push(family.id);
      }
    });
  }

  const personPositions = new Map<string, { x: number; y: number }>();

  const average = (values: number[]) =>
    values.reduce((acc, value) => acc + value, 0) / values.length;

  const placeFamily = (family: FamilyUnit) => {
    let center = familyCenters.get(family.id) ?? { x: 0, y: 0 };
    const parents = [...family.parents].sort(compareByName);
    const parentCount = parents.length;

    if (parentCount > 0) {
      const existingParents = parents.filter((parentId) =>
        personPositions.has(parentId)
      );

      if (existingParents.length > 0) {
        if (direction === "TB") {
          const avgParentY = average(
            existingParents.map((parentId) => personPositions.get(parentId)?.y ?? 0)
          );
          center = {
            x: center.x,
            y: avgParentY + (NODE_HEIGHT / 2 + FAMILY_VERTICAL_GAP),
          };
        } else {
          const avgParentX = average(
            existingParents.map((parentId) => personPositions.get(parentId)?.x ?? 0)
          );
          center = {
            x: avgParentX + (NODE_WIDTH / 2 + FAMILY_VERTICAL_GAP),
            y: center.y,
          };
        }
      }

      if (direction === "TB") {
        const totalWidth =
          parentCount * NODE_WIDTH + (parentCount - 1) * FAMILY_PARENT_GAP;
        let startX = center.x - totalWidth / 2;
        const parentY = center.y - (NODE_HEIGHT / 2 + FAMILY_VERTICAL_GAP);

        if (existingParents.length > 0) {
          const deltas = existingParents.map((parentId) => {
            const index = parents.indexOf(parentId);
            if (index < 0) return 0;
            const desiredX =
              startX + NODE_WIDTH / 2 + index * (NODE_WIDTH + FAMILY_PARENT_GAP);
            const actualX = personPositions.get(parentId)?.x ?? desiredX;
            return actualX - desiredX;
          });
          const delta = average(deltas);
          center = { x: center.x + delta, y: center.y };
          startX = center.x - totalWidth / 2;
        }

        parents.forEach((parentId, index) => {
          const x =
            startX + NODE_WIDTH / 2 + index * (NODE_WIDTH + FAMILY_PARENT_GAP);
          personPositions.set(parentId, { x, y: parentY });
        });

        const avgParentX = average(
          parents.map((parentId) => personPositions.get(parentId)?.x ?? center.x)
        );
        center = { x: avgParentX, y: center.y };
      } else {
        const totalHeight =
          parentCount * NODE_HEIGHT + (parentCount - 1) * FAMILY_PARENT_GAP;
        let startY = center.y - totalHeight / 2;
        const parentX = center.x - (NODE_WIDTH / 2 + FAMILY_VERTICAL_GAP);

        if (existingParents.length > 0) {
          const deltas = existingParents.map((parentId) => {
            const index = parents.indexOf(parentId);
            if (index < 0) return 0;
            const desiredY =
              startY + NODE_HEIGHT / 2 + index * (NODE_HEIGHT + FAMILY_PARENT_GAP);
            const actualY = personPositions.get(parentId)?.y ?? desiredY;
            return actualY - desiredY;
          });
          const delta = average(deltas);
          center = { x: center.x, y: center.y + delta };
          startY = center.y - totalHeight / 2;
        }

        parents.forEach((parentId, index) => {
          const y =
            startY + NODE_HEIGHT / 2 + index * (NODE_HEIGHT + FAMILY_PARENT_GAP);
          personPositions.set(parentId, { x: parentX, y });
        });

        const avgParentY = average(
          parents.map((parentId) => personPositions.get(parentId)?.y ?? center.y)
        );
        center = { x: center.x, y: avgParentY };
      }
    }

    familyCenters.set(family.id, center);

    if (family.children.length === 0) return;

    const sortedChildren = [...family.children].sort((leftId, rightId) => {
      const leftPos = personPositions.get(leftId);
      const rightPos = personPositions.get(rightId);
      if (leftPos && rightPos) {
        return direction === "TB" ? leftPos.x - rightPos.x : leftPos.y - rightPos.y;
      }
      if (leftPos) return -1;
      if (rightPos) return 1;
      return compareByName(leftId, rightId);
    });

    if (direction === "TB") {
      const totalWidth =
        sortedChildren.length * NODE_WIDTH +
        (sortedChildren.length - 1) * FAMILY_CHILD_GAP;
      const startX = center.x - totalWidth / 2;
      const childY = center.y + (NODE_HEIGHT / 2 + FAMILY_VERTICAL_GAP);

      sortedChildren.forEach((childId, index) => {
        const existing = personPositions.get(childId);
        if (existing) {
          personPositions.set(childId, { x: existing.x, y: childY });
          return;
        }
        const x =
          startX + NODE_WIDTH / 2 + index * (NODE_WIDTH + FAMILY_CHILD_GAP);
        personPositions.set(childId, { x, y: childY });
      });
    } else {
      const totalHeight =
        sortedChildren.length * NODE_HEIGHT +
        (sortedChildren.length - 1) * FAMILY_CHILD_GAP;
      const startY = center.y - totalHeight / 2;
      const childX = center.x + (NODE_WIDTH / 2 + FAMILY_VERTICAL_GAP);

      sortedChildren.forEach((childId, index) => {
        const existing = personPositions.get(childId);
        if (existing) {
          personPositions.set(childId, { x: childX, y: existing.y });
          return;
        }
        const y =
          startY + NODE_HEIGHT / 2 + index * (NODE_HEIGHT + FAMILY_CHILD_GAP);
        personPositions.set(childId, { x: childX, y });
      });
    }
  };

  orderedFamilyIds.forEach((familyId) => {
    const family = familyById.get(familyId);
    if (!family) return;
    placeFamily(family);
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

  const familyConnectorEdges: Edge[] = [];
  const familyEdgesOut: Edge[] = [];
  const siblingEdges: Edge[] = [];
  const partnerEdges: Edge[] = [];
  const siblingLabelStyle = {
    fill: "rgba(22, 101, 52, 0.75)",
    fontSize: 10,
    fontWeight: 600,
  };

  const explicitPartnerPairs = new Set(
    partnerLinks.map((rel) => normalizePair(rel.parentId, rel.childId))
  );

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
        style: { stroke: "rgba(31, 41, 51, 0.7)", strokeWidth: 2.5 },
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
        labelBgStyle: { fill: "rgba(255, 250, 241, 0.9)" },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 8,
        className: "edge-parent",
        style: { stroke: "rgba(31, 41, 51, 0.7)", strokeWidth: 2.5 },
      });
    });

    if (family.children.length > 1) {
      const sorted = [...family.children]
        .map((childId) => ({
          id: childId,
          pos: resolvedCenters.get(childId) ?? { x: 0, y: 0 },
        }))
        .sort((left, right) =>
          direction === "TB" ? left.pos.x - right.pos.x : left.pos.y - right.pos.y
        )
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

    if (family.parents.length === 2) {
      const pairKey = normalizePair(family.parents[0], family.parents[1]);
      if (!explicitPartnerPairs.has(pairKey)) {
        const edge = getPartnerEdge(family.parents[0], family.parents[1]);
        partnerEdges.push({
          id: `partner:${family.id}`,
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
        });
      }
    }
  });

  partnerLinks.forEach((rel) => {
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
      labelBgStyle: { fill: "rgba(255, 250, 241, 0.9)" },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 8,
      className: "edge-partner",
      style: {
        stroke: "rgba(234, 179, 8, 0.7)",
        strokeWidth: 2.5,
        strokeDasharray: "6 4",
      },
    });
  });

  return {
    nodes: [...nodes, ...familyNodes],
    edges: [...familyConnectorEdges, ...familyEdgesOut, ...partnerEdges, ...siblingEdges],
  };
};
