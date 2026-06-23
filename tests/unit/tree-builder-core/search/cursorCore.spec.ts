import { describe, expect, it } from 'vitest'
import { matchAt, matchPositionOf, stepMatch } from '@/tree-builder-core'

const matches = [10, 20, 30]

describe('cursor (match navigation)', () => {
  describe('matchAt', () => {
    it('returns the match at an in-range ordinal', () => {
      expect(matchAt(matches, 0)).toBe(10)
      expect(matchAt(matches, 2)).toBe(30)
    })

    it('wraps past the end and before the start', () => {
      expect(matchAt(matches, 3)).toBe(10)
      expect(matchAt(matches, -1)).toBe(30)
    })

    it('returns undefined when there are no matches', () => {
      expect(matchAt([], 0)).toBeUndefined()
    })
  })

  describe('matchPositionOf', () => {
    it('finds the position of the current key', () => {
      expect(matchPositionOf(matches, 20)).toBe(1)
    })

    it('falls back to 0 for an unknown or absent current key', () => {
      expect(matchPositionOf(matches, 99)).toBe(0)
      expect(matchPositionOf(matches, undefined)).toBe(0)
    })
  })

  describe('stepMatch', () => {
    it('with no current match, next selects the first and prev the last', () => {
      expect(stepMatch(matches, 0, undefined, 1)).toBe(10)
      expect(stepMatch(matches, 0, undefined, -1)).toBe(30)
    })

    it('steps forward and backward from the current match', () => {
      expect(stepMatch(matches, 1, 20, 1)).toBe(30)
      expect(stepMatch(matches, 1, 20, -1)).toBe(10)
    })

    it('wraps at both ends', () => {
      expect(stepMatch(matches, 2, 30, 1)).toBe(10) // last → first
      expect(stepMatch(matches, 0, 10, -1)).toBe(30) // first → last
    })

    it('returns undefined when there are no matches', () => {
      expect(stepMatch([], 0, undefined, 1)).toBeUndefined()
    })
  })
})
