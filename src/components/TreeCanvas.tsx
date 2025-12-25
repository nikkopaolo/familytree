"use client";

import { useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MiniMap, Node } from "reactflow";
import "reactflow/dist/style.css";
import { PersonNode } from "./PersonNode";
import { buildTreeGraph, filterTree, TreeLayoutDirection } from "@/lib/tree";
import type { Person, PersonPosition, Relationship } from "@/lib/types";

type TreeCanvasProps = {
  persons: Person[];
  relationships: Relationship[];
  positions: PersonPosition[];
  manualPositions: Record<string, { x: number; y: number }>;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  selectedPersonId: string;
  onSelectPerson: (id: string) => void;
  rootId: string;
  onRootChange: (id: string) => void;
  maxDepth: number;
  onMaxDepthChange: (value: number) => void;
  maxNodes: number;
  onMaxNodesChange: (value: number) => void;
};

const nodeTypes = { person: PersonNode };

export const TreeCanvas = ({
  persons,
  relationships,
  positions,
  manualPositions,
  onUpdatePosition,
  selectedPersonId,
  onSelectPerson,
  rootId,
  onRootChange,
  maxDepth,
  onMaxDepthChange,
  maxNodes,
  onMaxNodesChange,
}: TreeCanvasProps) => {
  const [direction, setDirection] = useState<TreeLayoutDirection>("TB");
  const hasPeople = persons.length > 0;

  const { filteredPersons, filteredRelationships } = useMemo(() => {
    if (!hasPeople) {
      return { filteredPersons: [], filteredRelationships: [] };
    }
    return filterTree(persons, relationships, {
      rootId: rootId || persons[0]?.id || "",
      maxDepth,
      maxNodes,
    });
  }, [hasPeople, maxDepth, maxNodes, persons, relationships, rootId]);

  const { nodes, edges } = useMemo(() => {
    if (!hasPeople) {
      return { nodes: [], edges: [] };
    }
    return buildTreeGraph({
      persons: filteredPersons,
      relationships: filteredRelationships,
      positions,
      direction,
      manualPositions,
    });
  }, [filteredPersons, filteredRelationships, positions, direction, manualPositions, hasPeople]);

  const nodeHighlight = useMemo(() => {
    const selected = new Set([selectedPersonId]);
    return nodes.map((node) => ({
      ...node,
      selected: selected.has(node.id),
    })) as Node[];
  }, [nodes, selectedPersonId]);

  if (!hasPeople) {
    return (
      <section className="glass-card flex h-[640px] flex-col gap-4 rounded-3xl p-6">
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

  return (
    <section className="glass-card flex h-[640px] flex-col gap-4 rounded-3xl p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Focus Branch
          </p>
          <select
            className="mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
            value={rootId}
            onChange={(event) => onRootChange(event.target.value)}
          >
            {persons.map((person) => (
              <option key={person.id} value={person.id}>
                {person.fullName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Max Generations
          </p>
          <input
            type="number"
            min={1}
            max={8}
            className="mt-2 w-32 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
            value={maxDepth}
            onChange={(event) => onMaxDepthChange(Number(event.target.value))}
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Max Nodes
          </p>
          <input
            type="number"
            min={5}
            max={120}
            className="mt-2 w-32 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
            value={maxNodes}
            onChange={(event) => onMaxNodesChange(Number(event.target.value))}
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Layout
          </p>
          <div className="mt-2 flex gap-2">
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
        <div className="ml-auto rounded-2xl bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
          Showing {filteredPersons.length} people - {filteredRelationships.length} links
        </div>
      </div>
      <div className="graph-grid relative h-full w-full overflow-hidden rounded-3xl border border-slate-200 bg-white/70">
        <ReactFlow
          nodes={nodeHighlight}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          onNodeClick={(_, node) => onSelectPerson(node.id)}
          onNodeDragStop={(_, node) => onUpdatePosition(node.id, node.position.x, node.position.y)}
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
