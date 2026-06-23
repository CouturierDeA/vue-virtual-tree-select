export type HighlightPart = {
  matched: boolean
  text: string
}

export function getHighlightParts(text: string, query: string): HighlightPart[] {
  const trimmed = query.trim()
  if (!trimmed) return [{ matched: false, text }]
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text
    .split(new RegExp(`(${escaped})`, 'gi'))
    .filter((part) => part !== '')
    .map((part) => ({ matched: part.toLowerCase() === trimmed.toLowerCase(), text: part }))
}
