export interface MatchSequence<K> {
  readonly length: number
  at(index: number): K | undefined
  indexOf?(value: K): number
  positionOf?(value: K): number
}

export function matchAt<K>(orderedMatches: MatchSequence<K>, ordinal: number): K | undefined {
  if (!orderedMatches.length) return undefined
  const wrapped =
    ((ordinal % orderedMatches.length) + orderedMatches.length) % orderedMatches.length
  return orderedMatches.at(wrapped)
}

export function matchPositionOf<K>(
  orderedMatches: MatchSequence<K>,
  currentKey: K | undefined,
): number {
  if (currentKey === undefined) return 0
  const position =
    orderedMatches.positionOf?.(currentKey) ?? orderedMatches.indexOf?.(currentKey) ?? -1
  if (position >= 0) return position
  return 0
}

export function stepMatch<K>(
  orderedMatches: MatchSequence<K>,
  currentMatchIndex: number,
  currentKey: K | undefined,
  direction: 1 | -1,
): K | undefined {
  if (!orderedMatches.length) return undefined
  let ordinal: number
  if (currentKey === undefined) {
    if (direction === 1) ordinal = 0
    else ordinal = -1
  } else {
    ordinal = currentMatchIndex + direction
  }
  return matchAt(orderedMatches, ordinal)
}
