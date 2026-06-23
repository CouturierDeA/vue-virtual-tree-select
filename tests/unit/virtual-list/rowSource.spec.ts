import { describe, expect, it } from 'vitest'
import { fromArray, keyMappedRowSource } from '@/virtual-list/rowSource'

type Item = { id: string; label: string }

const items: Item[] = [
  { id: 'a', label: 'Apple' },
  { id: 'b', label: 'Banana' },
  { id: 'c', label: 'Cherry' },
]

describe('fromArray row source', () => {
  it('length reflects the backing array', () => {
    const source = fromArray(items, { keyOf: (item) => item.id, rowOf: (item) => item })
    expect(source.length).toBe(3)
  })

  it('keyAt and rowAt map each position through keyOf/rowOf', () => {
    const source = fromArray(items, { keyOf: (item) => item.id, rowOf: (item) => item.label })
    expect(source.keyAt(0)).toBe('a')
    expect(source.keyAt(2)).toBe('c')
    expect(source.rowAt(1)).toBe('Banana')
  })

  it('keyOf and rowOf receive the row index', () => {
    const source = fromArray(items, {
      keyOf: (_item, rowIndex) => rowIndex,
      rowOf: (item, rowIndex) => `${rowIndex}:${item.id}`,
    })
    expect(source.keyAt(2)).toBe(2)
    expect(source.rowAt(0)).toBe('0:a')
  })

  it('indexOf finds the first position whose key matches', () => {
    const source = fromArray(items, { keyOf: (item) => item.id, rowOf: (item) => item })
    expect(source.indexOf('b')).toBe(1)
  })

  it('indexOf returns -1 for an unknown key', () => {
    const source = fromArray(items, { keyOf: (item) => item.id, rowOf: (item) => item })
    expect(source.indexOf('zzz')).toBe(-1)
  })

  it('a custom indexOf overrides the default linear scan', () => {
    const source = fromArray(items, {
      keyOf: (item) => item.id,
      rowOf: (item) => item,
      indexOf: (key) => (key === 'c' ? 99 : -1),
    })
    // 'a' sits at index 0, so a default scan would return 0; the override returns -1.
    expect(source.indexOf('a')).toBe(-1)
    expect(source.indexOf('c')).toBe(99)
  })

  it('fallbackFor is exposed only when the adapter provides it', () => {
    const without = fromArray(items, { keyOf: (item) => item.id, rowOf: (item) => item })
    expect(without.fallbackFor).toBeUndefined()

    const withFallback = fromArray(items, {
      keyOf: (item) => item.id,
      rowOf: (item) => item,
      fallbackFor: (key) => (key === 'x' ? 'a' : undefined),
    })
    expect(withFallback.fallbackFor?.('x')).toBe('a')
    expect(withFallback.fallbackFor?.('y')).toBeUndefined()
  })
})

describe('keyMappedRowSource', () => {
  it('maps source keys at the RowSource boundary', () => {
    const inner = fromArray([0, 1, 2], { keyOf: (index) => index, rowOf: (index) => index * 10 })
    const source = keyMappedRowSource<number, number, string>(inner, {
      toOuterKey: (key) => `node:${key}`,
      toInnerKey: (key) => {
        const raw = key.slice('node:'.length)
        const index = Number(raw)
        return Number.isInteger(index) ? index : undefined
      },
    })

    expect(source.length).toBe(3)
    expect(source.keyAt(2)).toBe('node:2')
    expect(source.rowAt(2)).toBe(20)
    expect(source.indexOf('node:1')).toBe(1)
    expect(source.indexOf('missing')).toBe(-1)
  })

  it('maps fallback keys through the same lens', () => {
    const inner = fromArray([0, 1, 2], {
      keyOf: (index) => index,
      rowOf: (index) => index,
      indexOf: (key) => (typeof key === 'number' ? key : -1),
      fallbackFor: (key) => (key === 2 ? 1 : undefined),
    })
    const source = keyMappedRowSource<number, number, string>(inner, {
      toOuterKey: (key) => `node:${key}`,
      toInnerKey: (key) => {
        const index = Number(key.slice('node:'.length))
        return Number.isInteger(index) ? index : undefined
      },
    })

    expect(source.fallbackFor?.('node:2')).toBe('node:1')
    expect(source.fallbackFor?.('node:0')).toBeUndefined()
  })
})

describe('object reference keys', () => {
  it('fromArray keys rows by object identity', () => {
    const nodes = [{ id: 0 }, { id: 1 }, { id: 2 }]
    const source = fromArray(nodes, { keyOf: (node) => node, rowOf: (node) => node.id })

    expect(source.keyAt(1)).toBe(nodes[1])
    expect(source.indexOf(nodes[2])).toBe(2)
    // a structurally-equal but distinct reference must not match
    expect(source.indexOf({ id: 1 })).toBe(-1)
  })

  it('keyMappedRowSource maps an inner index key to an outer object key and back', () => {
    const nodes = [{ id: 0 }, { id: 1 }, { id: 2 }]
    const byRef = new Map(nodes.map((node, index) => [node, index] as const))
    const inner = fromArray([0, 1, 2], {
      keyOf: (index) => index,
      rowOf: (index) => index * 10,
      indexOf: (key) => (typeof key === 'number' ? key : -1),
      fallbackFor: (key) => (key === 2 ? 1 : undefined),
    })
    const source = keyMappedRowSource<number, number, (typeof nodes)[number]>(inner, {
      toOuterKey: (index) => nodes[index]!,
      toInnerKey: (node) => byRef.get(node),
    })

    expect(source.keyAt(1)).toBe(nodes[1])
    expect(source.rowAt(2)).toBe(20)
    expect(source.indexOf(nodes[1])).toBe(1)
    expect(source.indexOf({ id: 1 })).toBe(-1)
    expect(source.fallbackFor?.(nodes[2])).toBe(nodes[1])
    expect(source.fallbackFor?.(nodes[0])).toBeUndefined()
  })
})
