import type { ClassifierNode } from '@/preview/data/classifier'

export const MAX_NODES = 2_000_000

export function countNodes(nodes: readonly ClassifierNode[]): number {
  let total = 0
  const stack = Array.from(nodes)
  while (stack.length > 0) {
    const node = stack.pop() as ClassifierNode
    total++
    if (node.children) for (const child of node.children) stack.push(child)
  }
  return total
}

function clone(node: ClassifierNode, prefix: string): ClassifierNode {
  const next: ClassifierNode = { ...node, id: prefix + node.id }
  if (node.children) next.children = node.children.map((child) => clone(child, prefix))
  return next
}

function tile(base: ClassifierNode[], target: number): ClassifierNode[] {
  const per = countNodes(base)
  let copies = Math.round(target / per)
  if (copies < 1) copies = 1
  const out = Array.from(base)
  for (let t = 1; t < copies; t++) {
    for (const root of base) out.push(clone(root, `${t}-`))
  }
  return out
}

function limit(base: ClassifierNode[], target: number): ClassifierNode[] {
  let budget = target
  function take(node: ClassifierNode): ClassifierNode | null {
    if (budget <= 0) return null
    budget--
    const next: ClassifierNode = { id: node.id, description: node.description }
    if (node.children) {
      const kids: ClassifierNode[] = []
      for (const child of node.children) {
        if (budget <= 0) break
        const taken = take(child)
        if (taken) kids.push(taken)
      }
      if (kids.length > 0) next.children = kids
    }
    return next
  }
  const out: ClassifierNode[] = []
  for (const root of base) {
    if (budget <= 0) break
    const taken = take(root)
    if (taken) out.push(taken)
  }
  return out
}

async function loadClassifier(): Promise<ClassifierNode[]> {
  const module = await import('@/preview/data/classifier.json')
  return module.default as ClassifierNode[]
}

let originalCount: number | undefined

export async function originalNodeCount(): Promise<number> {
  originalCount ??= countNodes(await loadClassifier())
  return originalCount
}

export async function loadTreeData(target?: number): Promise<ClassifierNode[]> {
  const classifier = await loadClassifier()
  if (target === undefined || !Number.isFinite(target)) return classifier
  if (target <= 0) return []
  if (target < countNodes(classifier)) return limit(classifier, target)
  return tile(classifier, target)
}

export function clampNodeCount(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0
  if (value > MAX_NODES) return MAX_NODES
  return Math.floor(value)
}

export function readNodesParam(): number | undefined {
  const param = new URLSearchParams(window.location.search).get('nodes')
  if (!param) return undefined
  const value = Number(param)
  if (!Number.isFinite(value) || value < 0) return undefined
  return clampNodeCount(value)
}
