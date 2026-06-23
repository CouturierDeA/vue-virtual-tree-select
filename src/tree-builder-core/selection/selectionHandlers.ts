import type { SelectionContext, SelectionHandler } from '@/tree-builder-core/types'

function cascadeUp<K>(ctx: SelectionContext<K>): void {
  for (const key of ctx.ancestors()) {
    const kids = ctx.childrenOf(key)
    let checkedKids = 0
    let indeterminateKids = 0
    for (const child of kids) {
      if (ctx.isChecked(child)) checkedKids++
      else if (ctx.isIndeterminate(child)) indeterminateKids++
    }
    if (kids.length > 0 && checkedKids === kids.length) {
      ctx.setChecked(key, true)
      ctx.setIndeterminate(key, false)
    } else if (checkedKids > 0 || indeterminateKids > 0) {
      ctx.setChecked(key, false)
      ctx.setIndeterminate(key, true)
    } else {
      ctx.setChecked(key, false)
      ctx.setIndeterminate(key, false)
    }
  }
}

function cascadeUpIndeterminate<K>(ctx: SelectionContext<K>): void {
  const process = (key: K) => {
    if (ctx.isChecked(key)) {
      ctx.setIndeterminate(key, false)
      return
    }
    const kids = ctx.childrenOf(key)
    if (kids.length === 0) {
      ctx.setIndeterminate(key, false)
      return
    }
    let touched = false
    for (const child of kids) {
      if (ctx.isChecked(child) || ctx.isIndeterminate(child)) {
        touched = true
        break
      }
    }
    ctx.setIndeterminate(key, touched)
  }
  process(ctx.key)
  for (const key of ctx.ancestors()) process(key)
}

export const independent: SelectionHandler<unknown> = {
  onToggle(ctx) {
    ctx.setChecked(ctx.key, !ctx.isChecked(ctx.key))
    cascadeUpIndeterminate(ctx)
  },
}

export const cascadeAll: SelectionHandler<unknown> = {
  onToggle(ctx) {
    const next = !ctx.isChecked(ctx.key)
    ctx.setChecked(ctx.key, next)
    ctx.setIndeterminate(ctx.key, false)
    for (const descendant of ctx.descendants()) {
      if (ctx.isDisabled(descendant)) continue
      ctx.setChecked(descendant, next)
      ctx.setIndeterminate(descendant, false)
    }
    cascadeUp(ctx)
  },
}

export const cascadeCompact: SelectionHandler<unknown> = {
  onToggle: cascadeAll.onToggle,
  shouldEmit(key, ctx) {
    for (const ancestor of ctx.ancestorsOf(key)) {
      if (ctx.isChecked(ancestor)) return false
    }
    return true
  },
}
