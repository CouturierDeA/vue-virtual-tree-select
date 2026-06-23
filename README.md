# vue-virtual-tree-select

High-performance Vue 3 tree select playground focused on large nested datasets,
virtualized rendering, search, and scalable tree projection.

## Preview

[Open live preview](https://CouturierDeA.github.io/vue-virtual-tree-select/)

## Why This Exists

Tree selects get expensive when the dataset is large: expanding and collapsing
nodes can force array reindexing, filtering can materialize huge lists, and row
height measurement can make scrolling unstable.

This project explores a faster architecture:

- virtualized rows with measured heights;
- tree projection over indexed structures instead of eagerly rebuilt arrays;
- composable view strategies for plain, filtered, and compact tree projections;
- selection strategies such as `independent`, `cascadeAll`, and `cascadeCompact`;
- separation between public node keys and internal hot-path `NodeIndex` data.

## How It Works

The tree is converted into an indexed flat projection before rendering.
This allows the UI to work with a virtualized list instead of a deeply nested tree.

When nodes are expanded or collapsed, the visible list is not rebuilt.
Instead, visibility is derived from the indexed tree on demand.
This avoids repeated reindexing work when large branches are shown or hidden.

The custom VirtualList renders only a moving slice of rows. It extends that
slice near the viewport edges, trims rows that are far away, and restores the
scroll anchor after window changes. This keeps DOM size and measurement work
bounded even for huge row counts.

This approach also helps avoid browser scroll-size limits. Scroll containers
cannot grow indefinitely because browsers impose a maximum practical scrollable
element height. Generic virtualizers that depend on a single massive scroll
surface eventually run into those limits when row counts become extremely large.

## Current Demo

The demo uses a nested classifier dataset and shows:

- virtual scrolling over a large tree;
- expand/collapse state;
- checkbox selection with strategy switching;
- search highlighting and match navigation;
- plain and compact filtered tree projections driven by view strategies.

## Development

```sh
npm install
npm run dev
```

The dev server is started with Vite.

## Build

```sh
npm run build
```

## Tests

```sh
npm run test:unit
npm run test:browser
npm run test:e2e
```
