"use client";

import { Handle, Position, type NodeProps } from "reactflow";

type FamilyNodeData = {
  parents?: string[];
  children?: string[];
  direction?: "TB" | "LR";
};

export const FamilyNode = ({ data }: NodeProps<FamilyNodeData>) => {
  const direction = data?.direction ?? "TB";
  const sourcePosition = direction === "LR" ? Position.Right : Position.Bottom;
  const targetPosition = direction === "LR" ? Position.Left : Position.Top;
  return (
    <div className="family-node">
      <Handle type="target" position={targetPosition} style={{ opacity: 0 }} />
      <Handle type="source" position={sourcePosition} style={{ opacity: 0 }} />
    </div>
  );
};
