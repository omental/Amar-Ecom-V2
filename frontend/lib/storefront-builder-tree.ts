import { MAX_BUILDER_DEPTH, type BuilderBlock } from "@/lib/storefront-builder";

export type BuilderTreeLocation = { parentId: string | null; index: number; depth: number };
export type BuilderDropPosition = "before" | "inside" | "after";
export type BuilderDropTarget = { targetId: string | null; position: BuilderDropPosition };
export type BuilderMoveResult = { tree: BuilderBlock[]; moved: boolean; reason?: string };
export type BuilderChildValidator = (parent: BuilderBlock | null, child: BuilderBlock) => boolean;

export function walkBuilderTree(nodes: BuilderBlock[], visitor: (node: BuilderBlock, location: BuilderTreeLocation) => void, parentId: string | null = null, depth = 0) {
  nodes.forEach((node, index) => {
    visitor(node, { parentId, index, depth });
    walkBuilderTree(node.children, visitor, node.id, depth + 1);
  });
}

export function findBuilderLocation(nodes: BuilderBlock[], id: string): BuilderTreeLocation | null {
  let found: BuilderTreeLocation | null = null;
  walkBuilderTree(nodes, (node, location) => { if (!found && node.id === id) found = location; });
  return found;
}

export function findBuilderParent(nodes: BuilderBlock[], id: string): BuilderBlock | null {
  const location = findBuilderLocation(nodes, id);
  if (!location?.parentId) return null;
  return findTreeNode(nodes, location.parentId);
}

export function findTreeNode(nodes: BuilderBlock[], id: string): BuilderBlock | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = findTreeNode(node.children, id);
    if (nested) return nested;
  }
  return null;
}

export function isBuilderDescendant(nodes: BuilderBlock[], ancestorId: string, candidateId: string) {
  const ancestor = findTreeNode(nodes, ancestorId);
  return ancestor ? Boolean(findTreeNode(ancestor.children, candidateId)) : false;
}

export function removeTreeNode(nodes: BuilderBlock[], id: string): { tree: BuilderBlock[]; node: BuilderBlock | null } {
  let removed: BuilderBlock | null = null;
  const visit = (items: BuilderBlock[]): BuilderBlock[] => items.flatMap((item) => {
    if (item.id === id) { removed = item; return []; }
    return [{ ...item, children: visit(item.children) }];
  });
  return { tree: visit(nodes), node: removed };
}

export function insertTreeNode(nodes: BuilderBlock[], parentId: string | null, index: number, node: BuilderBlock): BuilderBlock[] {
  if (parentId === null) {
    const target = Math.max(0, Math.min(index, nodes.length));
    return [...nodes.slice(0, target), node, ...nodes.slice(target)];
  }
  return nodes.map((item) => item.id === parentId
    ? { ...item, children: insertTreeNode(item.children, null, index, node) }
    : { ...item, children: insertTreeNode(item.children, parentId, index, node) });
}

export function replaceTreeNode(nodes: BuilderBlock[], id: string, updater: (node: BuilderBlock) => BuilderBlock): BuilderBlock[] {
  return nodes.map((node) => node.id === id ? updater(node) : { ...node, children: replaceTreeNode(node.children, id, updater) });
}

export function wrapTreeNode(nodes: BuilderBlock[], id: string, wrapper: BuilderBlock): BuilderMoveResult {
  const location = findBuilderLocation(nodes, id);
  if (!location) return { tree: nodes, moved: false, reason: "The selected node no longer exists." };
  const removed = removeTreeNode(nodes, id);
  if (!removed.node) return { tree: nodes, moved: false, reason: "The selected node could not be wrapped." };
  return { tree: insertTreeNode(removed.tree, location.parentId, location.index, { ...wrapper, children: [removed.node] }), moved: true };
}

/** Hoists invalid children to the closest compatible ancestor without discarding their data. */
export function sanitizeTreeRelationships(nodes: BuilderBlock[], canAccept: BuilderChildValidator, parent: BuilderBlock | null = null): BuilderBlock[] {
  const result: BuilderBlock[] = [];
  for (const node of nodes) {
    const acceptedChildren: BuilderBlock[] = [];
    const hoistedChildren: BuilderBlock[] = [];
    for (const child of node.children) {
      if (canAccept(node, child)) acceptedChildren.push(...sanitizeTreeRelationships([child], canAccept, node));
      else hoistedChildren.push(...sanitizeTreeRelationships([child], canAccept, parent));
    }
    const normalized = { ...node, children: acceptedChildren };
    if (canAccept(parent, normalized)) result.push(normalized, ...hoistedChildren);
    else result.push(...sanitizeTreeRelationships(normalized.children, canAccept, parent), { ...normalized, children: [] }, ...hoistedChildren);
  }
  return result;
}

function subtreeDepth(node: BuilderBlock): number {
  return node.children.length ? 1 + Math.max(...node.children.map(subtreeDepth)) : 0;
}

export function validateTreeMove(nodes: BuilderBlock[], nodeId: string, target: BuilderDropTarget, canAccept: BuilderChildValidator): { valid: boolean; reason?: string } {
  if (nodeId === target.targetId) return { valid: false, reason: "A node cannot be dropped onto itself." };
  if (target.targetId && isBuilderDescendant(nodes, nodeId, target.targetId)) return { valid: false, reason: "A parent cannot be moved into its descendant." };
  const sourceLocation = findBuilderLocation(nodes, nodeId);
  const moving = findTreeNode(nodes, nodeId);
  if (!sourceLocation || !moving) return { valid: false, reason: "The dragged node no longer exists." };

  let parent: BuilderBlock | null = null;
  let parentId: string | null = null;
  if (target.targetId === null) {
    parentId = null;
  } else if (target.position === "inside") {
    parent = findTreeNode(nodes, target.targetId);
    parentId = parent?.id || null;
  } else {
    const targetLocation = findBuilderLocation(nodes, target.targetId);
    if (!targetLocation) return { valid: false, reason: "The drop target no longer exists." };
    parentId = targetLocation.parentId;
    parent = parentId ? findTreeNode(nodes, parentId) : null;
  }
  if (!canAccept(parent, moving)) return { valid: false, reason: "That parent does not accept this block type." };

  const parentDepth = parentId ? (findBuilderLocation(nodes, parentId)?.depth ?? -1) + 1 : 0;
  if (parentDepth + subtreeDepth(moving) >= MAX_BUILDER_DEPTH) return { valid: false, reason: `Builder nesting is limited to ${MAX_BUILDER_DEPTH} levels.` };
  return { valid: true };
}

export function moveTreeNode(nodes: BuilderBlock[], nodeId: string, target: BuilderDropTarget, canAccept: BuilderChildValidator): BuilderMoveResult {
  const validation = validateTreeMove(nodes, nodeId, target, canAccept);
  if (!validation.valid) return { tree: nodes, moved: false, reason: validation.reason };
  const sourceLocation = findBuilderLocation(nodes, nodeId)!;
  let parentId: string | null = null;
  let index = 0;
  if (target.targetId === null) index = nodes.length;
  else if (target.position === "inside") { parentId = target.targetId; index = findTreeNode(nodes, target.targetId)?.children.length || 0; }
  else {
    const targetLocation = findBuilderLocation(nodes, target.targetId)!;
    parentId = targetLocation.parentId;
    index = targetLocation.index + (target.position === "after" ? 1 : 0);
  }

  const removed = removeTreeNode(nodes, nodeId);
  if (!removed.node) return { tree: nodes, moved: false, reason: "The dragged node could not be removed." };
  if (sourceLocation.parentId === parentId && sourceLocation.index < index) index -= 1;
  return { tree: insertTreeNode(removed.tree, parentId, index, removed.node), moved: true };
}
