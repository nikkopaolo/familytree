"use client";

import { useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";
import { PersonNode } from "./PersonNode";
import { FamilyNode } from "./FamilyNode";
import {
  buildTreeGraph,
  filterTree,
  TreeGenerationDirection,
  TreeLayoutDirection,
} from "@/lib/tree";
import type { Person, PersonPosition, Relationship } from "@/lib/types";

type TreeCanvasProps = {
  persons: Person[];
  relationships: Relationship[];
  positions: PersonPosition[];
  manualPositions: Record<string, { x: number; y: number }>;
  canEditPerson: (person: Person) => boolean;
  onAddChild: (parentId: string) => void;
  onAddPartner: (personId: string) => void;
  onUpdatePerson: (personId: string, payload: Record<string, unknown>) => Promise<void> | void;
  onDeleteRelationship: (relationshipId: string) => void;
  onLinkParent: (childId: string, parentId: string) => void;
  onLinkChild: (parentId: string, childId: string) => void;
  onLinkPartner: (
    personId: string,
    partnerId: string,
    marriageDate?: string | null
  ) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  selectedPersonId: string;
  onSelectPerson: (id: string) => void;
  rootId: string;
  onRootChange: (id: string) => void;
  maxDepth: number;
  onMaxDepthChange: (value: number) => void;
  maxDepthValue: number;
  isMaxDepthUnlimited: boolean;
  onToggleMaxDepthUnlimited: (value: boolean) => void;
  maxNodes: number;
  onMaxNodesChange: (value: number) => void;
  maxNodesValue: number;
  isMaxNodesUnlimited: boolean;
  onToggleMaxNodesUnlimited: (value: boolean) => void;
};

const nodeTypes = { person: PersonNode, family: FamilyNode };

export const TreeCanvas = ({
  persons,
  relationships,
  positions,
  manualPositions,
  canEditPerson,
  onAddChild,
  onAddPartner,
  onUpdatePerson,
  onDeleteRelationship,
  onLinkParent,
  onLinkChild,
  onLinkPartner,
  onUpdatePosition,
  selectedPersonId,
  onSelectPerson,
  rootId,
  onRootChange,
  maxDepth,
  onMaxDepthChange,
  maxDepthValue,
  isMaxDepthUnlimited,
  onToggleMaxDepthUnlimited,
  maxNodes,
  onMaxNodesChange,
  maxNodesValue,
  isMaxNodesUnlimited,
  onToggleMaxNodesUnlimited,
}: TreeCanvasProps) => {
  const [direction, setDirection] = useState<TreeLayoutDirection>("TB");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isArranging, setIsArranging] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "alive" | "deceased">("all");
  const [generationDirection, setGenerationDirection] =
    useState<TreeGenerationDirection>("both");
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [editingNodeId, setEditingNodeId] = useState("");
  const hasPeople = persons.length > 0;
  const sortedPersons = useMemo(
    () =>
      [...persons].sort((a, b) =>
        a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" })
      ),
    [persons]
  );

  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  const { filteredPersons, filteredRelationships } = useMemo(() => {
    if (!hasPeople) {
      return { filteredPersons: [], filteredRelationships: [] };
    }
    return filterTree(persons, relationships, {
      rootId: rootId || persons[0]?.id || "",
      maxDepth,
      maxNodes,
      generationDirection,
    });
  }, [generationDirection, hasPeople, maxDepth, maxNodes, persons, relationships, rootId]);

  const { nodes, edges } = useMemo(() => {
    if (!hasPeople) {
      return { nodes: [], edges: [] };
    }
    const statusFilteredPersons =
      statusFilter === "all"
        ? filteredPersons
        : filteredPersons.filter((person) =>
            statusFilter === "alive" ? person.isAlive : !person.isAlive
          );
    const statusIds = new Set(statusFilteredPersons.map((person) => person.id));
    const statusFilteredRelationships = filteredRelationships.filter(
      (rel) => statusIds.has(rel.parentId) && statusIds.has(rel.childId)
    );
    return buildTreeGraph({
      persons: statusFilteredPersons,
      relationships: statusFilteredRelationships,
      positions,
      direction,
      manualPositions,
    });
  }, [
    filteredPersons,
    filteredRelationships,
    positions,
    direction,
    manualPositions,
    hasPeople,
    statusFilter,
  ]);

  const shouldAutoFit = useMemo(() => Object.keys(manualPositions).length === 0, [manualPositions]);

  useEffect(() => {
    if (!flowInstance || !shouldAutoFit) return;
    if (nodes.length === 0) return;
    flowInstance.fitView({ padding: 0.2, duration: 300 });
  }, [
    flowInstance,
    shouldAutoFit,
    nodes.length,
    edges.length,
    direction,
    rootId,
  ]);

  useEffect(() => {
    if (!pendingFocusId || !flowInstance) return;
    const targetNode = nodes.find((node) => node.id === pendingFocusId);
    if (!targetNode) return;
    flowInstance.fitView({ nodes: [targetNode], padding: 0.4, duration: 400 });
    setPendingFocusId(null);
  }, [flowInstance, nodes, pendingFocusId]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return persons
      .filter((person) => person.fullName.toLowerCase().includes(query))
      .slice(0, 8);
  }, [persons, searchQuery]);

  const handleFocusPerson = (personId: string) => {
    setPendingFocusId(personId);
    onSelectPerson(personId);
    const person = persons.find((item) => item.id === personId);
    if (person) {
      setSearchQuery(person.fullName);
    }
  };

  const nodeHighlight = useMemo(() => {
    const selected = new Set([selectedPersonId]);
    return nodes.map((node) => ({
      ...node,
      selected: selected.has(node.id),
    })) as Node[];
  }, [nodes, selectedPersonId]);

  const relationshipStats = useMemo(() => {
    const parentsMap = new Map<string, Set<string>>();
    const childrenMap = new Map<string, Set<string>>();
    const partnersMap = new Map<string, Set<string>>();
    const siblingsMap = new Map<string, Set<string>>();

    persons.forEach((person) => {
      parentsMap.set(person.id, new Set());
      childrenMap.set(person.id, new Set());
      partnersMap.set(person.id, new Set());
      siblingsMap.set(person.id, new Set());
    });

    relationships.forEach((rel) => {
      if (rel.relationshipType === "parent") {
        parentsMap.get(rel.childId)?.add(rel.parentId);
        childrenMap.get(rel.parentId)?.add(rel.childId);
      }
      if (rel.relationshipType === "partner") {
        partnersMap.get(rel.parentId)?.add(rel.childId);
        partnersMap.get(rel.childId)?.add(rel.parentId);
      }
    });

    parentsMap.forEach((parentIds, childId) => {
      parentIds.forEach((parentId) => {
        childrenMap.get(parentId)?.forEach((siblingId) => {
          if (siblingId !== childId) {
            siblingsMap.get(childId)?.add(siblingId);
          }
        });
      });
    });

    return new Map(
      persons.map((person) => [
        person.id,
        {
          parents: parentsMap.get(person.id)?.size ?? 0,
          children: childrenMap.get(person.id)?.size ?? 0,
          partners: partnersMap.get(person.id)?.size ?? 0,
          siblings: siblingsMap.get(person.id)?.size ?? 0,
        },
      ])
    );
  }, [persons, relationships]);

  const relationshipDetails = useMemo(() => {
    const sortByName = (a: Person, b: Person) =>
      a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" });
    const map = new Map<
      string,
      {
        parents: Array<{ id: string; person: Person }>;
        children: Array<{ id: string; person: Person }>;
        partners: Array<{ id: string; person: Person; marriageDate?: string }>;
        eligibleParents: Person[];
        eligibleChildren: Person[];
        eligiblePartners: Person[];
      }
    >();

    persons.forEach((person) => {
      map.set(person.id, {
        parents: [],
        children: [],
        partners: [],
        eligibleParents: [],
        eligibleChildren: [],
        eligiblePartners: [],
      });
    });

    relationships.forEach((rel) => {
      if (rel.relationshipType === "parent") {
        const parent = persons.find((person) => person.id === rel.parentId);
        const child = persons.find((person) => person.id === rel.childId);
        if (parent && map.has(rel.childId)) {
          map.get(rel.childId)?.parents.push({ id: rel.id, person: parent });
        }
        if (child && map.has(rel.parentId)) {
          map.get(rel.parentId)?.children.push({ id: rel.id, person: child });
        }
      }
      if (rel.relationshipType === "partner") {
        const parent = persons.find((person) => person.id === rel.parentId);
        const child = persons.find((person) => person.id === rel.childId);
        if (parent && map.has(rel.childId)) {
          map.get(rel.childId)?.partners.push({
            id: rel.id,
            person: parent,
            marriageDate: rel.marriageDate,
          });
        }
        if (child && map.has(rel.parentId)) {
          map.get(rel.parentId)?.partners.push({
            id: rel.id,
            person: child,
            marriageDate: rel.marriageDate,
          });
        }
      }
    });

    persons.forEach((person) => {
      const entry = map.get(person.id);
      if (!entry) return;
      const parentIds = new Set(entry.parents.map((item) => item.person.id));
      const childIds = new Set(entry.children.map((item) => item.person.id));
      const partnerIds = new Set(entry.partners.map((item) => item.person.id));
      entry.eligibleParents = persons
        .filter((candidate) => candidate.id !== person.id && !parentIds.has(candidate.id))
        .sort(sortByName);
      entry.eligibleChildren = persons
        .filter((candidate) => candidate.id !== person.id && !childIds.has(candidate.id))
        .sort(sortByName);
      entry.eligiblePartners = persons
        .filter((candidate) => candidate.id !== person.id && !partnerIds.has(candidate.id))
        .sort(sortByName);
    });

    return map;
  }, [persons, relationships]);

  const interactiveNodes = useMemo(() => {
    const mapped = nodeHighlight.map((node) => {
      if (node.type !== "person") {
        return node;
      }
      const person = node.data as Person;
      const stats = relationshipStats.get(person.id) ?? {
        parents: 0,
        children: 0,
        partners: 0,
        siblings: 0,
      };
      const links = relationshipDetails.get(person.id) ?? {
        parents: [],
        children: [],
        partners: [],
        eligibleParents: [],
        eligibleChildren: [],
        eligiblePartners: [],
      };
      const isEditing = editingNodeId === node.id;
      return {
        ...node,
        zIndex: isEditing ? 1000 : node.zIndex,
        style: {
          ...(node.style ?? {}),
          zIndex: isEditing ? 1000 : node.style?.zIndex,
        },
        data: {
          person,
          stats,
          links,
          canEdit: canEditPerson(person),
          onAddChild: () => onAddChild(person.id),
          onAddPartner: () => onAddPartner(person.id),
          onUpdate: (payload: Record<string, unknown>) => onUpdatePerson(person.id, payload),
          onEditStateChange: (id: string, editing: boolean) => {
            setEditingNodeId((prev) => {
              if (editing) return id;
              return prev === id ? "" : prev;
            });
          },
          onDeleteRelationship,
          onLinkParent: (parentId: string) => onLinkParent(person.id, parentId),
          onLinkChild: (childId: string) => onLinkChild(person.id, childId),
          onLinkPartner: (partnerId: string, marriageDate?: string | null) =>
            onLinkPartner(person.id, partnerId, marriageDate),
        },
      };
    });
    if (!editingNodeId) return mapped;
    const editingIndex = mapped.findIndex((node) => node.id === editingNodeId);
    if (editingIndex === -1) return mapped;
    const editingNode = mapped[editingIndex];
    return [
      ...mapped.slice(0, editingIndex),
      ...mapped.slice(editingIndex + 1),
      editingNode,
    ];
  }, [
    nodeHighlight,
    relationshipStats,
    relationshipDetails,
    canEditPerson,
    onAddChild,
    onAddPartner,
    onUpdatePerson,
    onDeleteRelationship,
    onLinkParent,
    onLinkChild,
    onLinkPartner,
    editingNodeId,
  ]);

  const handleAutoArrange = async () => {
    if (isArranging || filteredPersons.length === 0) return;
    setIsArranging(true);
    const { nodes: layoutNodes } = buildTreeGraph({
      persons: filteredPersons,
      relationships: filteredRelationships,
      positions: [],
      direction,
      manualPositions: {},
    });
    const updates = layoutNodes
      .filter((node) => node.type === "person")
      .map((node) =>
        Promise.resolve(onUpdatePosition(node.id, node.position.x, node.position.y))
      );
    await Promise.all(updates);
    setTimeout(() => {
      flowInstance?.fitView({ padding: 0.2, duration: 300 });
    }, 50);
    setIsArranging(false);
  };

  if (!hasPeople) {
    return (
      <section className="glass-card flex min-h-[560px] h-[calc(100vh-320px)] flex-col gap-4 rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Tree</p>
            <h3 className="mt-2 text-xl text-slate-900">Start your family tree</h3>
            <p className="mt-1 text-sm text-slate-600">
              No members yet. Click <span className="font-semibold">Add Member</span> above or import a JSON file to
              include relationships.
            </p>
          </div>
        </div>
        <div className="graph-grid relative flex h-full w-full items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-white/70">
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 text-center shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Empty canvas</p>
            <p className="mt-1 text-xs text-slate-500">
              Once you add people and link parents/children, you will see the full tree here.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const containerClass = isFullscreen
    ? "glass-card fixed inset-4 z-50 flex h-[calc(100vh-2rem)] flex-col gap-3 rounded-3xl p-4"
    : "glass-card flex min-h-[560px] h-[calc(100vh-320px)] flex-col gap-3 rounded-3xl p-4";

  return (
    <section className={containerClass}>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Focus Branch
          </p>
          <select
            className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
            value={rootId}
            onChange={(event) => onRootChange(event.target.value)}
          >
            <option value="all">All members</option>
            {sortedPersons.map((person) => (
              <option key={person.id} value={person.id}>
                {person.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Find Member
          </p>
          <input
            className="mt-1 w-44 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
            placeholder="Search name"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          {searchResults.length > 0 && (
            <div className="absolute left-0 top-full z-20 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 text-xs shadow-lg">
              {searchResults.map((person) => (
                <button
                  key={person.id}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-slate-700 hover:bg-amber-50"
                  onClick={() => handleFocusPerson(person.id)}
                  type="button"
                >
                  <span className="truncate">{person.fullName}</span>
                  <span className="text-[10px] text-slate-400">Focus</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Max Generations
          </p>
          <input
            type="number"
            min={1}
            max={8}
            className="mt-1 w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
            value={maxDepthValue}
            onChange={(event) => onMaxDepthChange(Number(event.target.value))}
            disabled={isMaxDepthUnlimited}
          />
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={isMaxDepthUnlimited}
              onChange={(event) => onToggleMaxDepthUnlimited(event.target.checked)}
            />
            No limit
          </label>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Generation
          </p>
          <div className="mt-1 flex gap-2">
            {(["both", "forward", "backward"] as const).map((value) => (
              <button
                key={value}
                className={`rounded-full px-4 py-2 text-xs font-semibold ${
                  generationDirection === value
                    ? "bg-amber-500 text-white"
                    : "bg-white text-slate-600"
                }`}
                onClick={() => setGenerationDirection(value)}
                type="button"
              >
                {value === "both" ? "Both" : value === "forward" ? "Forward" : "Backward"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Max Nodes
          </p>
          <input
            type="number"
            min={5}
            max={120}
            className="mt-1 w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
            value={maxNodesValue}
            onChange={(event) => onMaxNodesChange(Number(event.target.value))}
            disabled={isMaxNodesUnlimited}
          />
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={isMaxNodesUnlimited}
              onChange={(event) => onToggleMaxNodesUnlimited(event.target.checked)}
            />
            No limit
          </label>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Filter
          </p>
          <div className="mt-1 flex gap-2">
            {(["all", "alive", "deceased"] as const).map((value) => (
              <button
                key={value}
                className={`rounded-full px-4 py-2 text-xs font-semibold ${
                  statusFilter === value
                    ? "bg-amber-500 text-white"
                    : "bg-white text-slate-600"
                }`}
                onClick={() => setStatusFilter(value)}
                type="button"
              >
                {value === "all" ? "All" : value === "alive" ? "Alive" : "Deceased"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Layout
          </p>
          <div className="mt-1 flex gap-2">
            <button
              className={`rounded-full px-4 py-2 text-xs font-semibold ${
                direction === "TB"
                  ? "bg-amber-500 text-white"
                  : "bg-white text-slate-600"
              }`}
              onClick={() => setDirection("TB")}
            >
              Vertical
            </button>
            <button
              className={`rounded-full px-4 py-2 text-xs font-semibold ${
                direction === "LR"
                  ? "bg-amber-500 text-white"
                  : "bg-white text-slate-600"
              }`}
              onClick={() => setDirection("LR")}
            >
              Horizontal
            </button>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleAutoArrange}
            disabled={isArranging}
            type="button"
          >
            {isArranging ? "Arranging..." : "Auto arrange"}
          </button>
          <button
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:text-slate-900"
            onClick={() => setIsFullscreen((prev) => !prev)}
            type="button"
          >
            {isFullscreen ? "Exit full screen" : "Full screen"}
          </button>
          <div className="rounded-2xl bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
            Showing {filteredPersons.length} people - {filteredRelationships.length} links
          </div>
        </div>
      </div>
      <div className="graph-grid relative h-full w-full overflow-hidden rounded-3xl border border-slate-200 bg-white/70">
        <ReactFlow
          nodes={interactiveNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          onInit={setFlowInstance}
          onNodeClick={(_, node) => {
            if (node.type === "person") {
              onSelectPerson(node.id);
            }
          }}
          onNodeDragStop={(_, node) => {
            if (node.type === "person") {
              onUpdatePosition(node.id, node.position.x, node.position.y);
            }
          }}
        >
          <MiniMap
            pannable
            nodeColor={() => "#f1b34c"}
            maskColor="rgba(255, 255, 255, 0.7)"
          />
          <Controls position="bottom-right" />
          <Background gap={20} color="rgba(31, 41, 51, 0.12)" />
        </ReactFlow>
      </div>
    </section>
  );
};
