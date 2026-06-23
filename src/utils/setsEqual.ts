export function setsEqual<T>(a: ReadonlySet<T>, b: ReadonlySet<T>) {
  if (a.size !== b.size) return false
  for (const x of a) if (!b.has(x)) return false
  return true
}
