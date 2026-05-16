# V1 UI Design System Notes

Last reviewed: 2026-05-16

## Source Reference

Extracted from the legacy v1 React UI, primarily:
- `src/index.css`
- `src/components/Layout.tsx`
- `src/components/Dashboard.tsx`
- `src/components/Orders.tsx`
- `src/components/Inventory.tsx`
- `src/components/CRM.tsx`
- `src/components/Logistics.tsx`
- `src/components/Reports.tsx`

## Color Tokens

From `src/index.css`:

- `--color-bg: #F8FAFC`
- `--color-surf: #FFFFFF`
- `--color-surf-hover: #F1F5F9`
- `--color-brd: #E2E8F0`
- `--color-txt-pri: #0F172A`
- `--color-txt-sec: #475569`
- `--color-txt-mut: #94A3B8`
- `--color-accent: #2563EB`
- `--color-accent-hover: #1D4ED8`

Observed semantic usage:
- blue accent for primary actions and active UI
- slate surfaces for neutral structure
- emerald, amber, sky, rose status families
- soft tinted backgrounds instead of flat outlines only

## Typography

Configured font families:
- `--font-sans: "Plus Jakarta Sans", "Outfit", system-ui, sans-serif`
- `--font-display: "Outfit", "Plus Jakarta Sans", system-ui, sans-serif`
- `--font-mono: "JetBrains Mono", monospace`

Imported families:
- `Outfit`
- `Plus Jakarta Sans`
- `JetBrains Mono`
- `Poppins`
- `Caveat`

Observed patterns:
- display headings use tighter tracking and stronger weight
- micro-labels often use uppercase tracked text
- common label pattern: `text-[10px] font-black uppercase tracking-[0.15em]`
- body text stays compact and muted

## Buttons

Important utility names:
- `btn-primary`

Observed button style patterns:
- rounded pill or rounded-xl/2xl buttons
- dark primary fill or brand tint
- compact font weight with strong action clarity
- inline icon + label is common

## Cards

Important utility names:
- `card-base`
- `card-interactive`
- `glass-morphism`

Observed card patterns:
- large radius
- layered soft shadow
- subtle border
- white surface over light grey background
- metrics often use inner icon tiles or colored icon chips

Common classes seen:
- `rounded-xl`
- `rounded-2xl`
- `rounded-[20px]`
- `rounded-[24px]`
- `rounded-[2rem]`

## Shadows / Borders / Radius

Important tokens:
- `shadow-subtle`
- `shadow-premium`

Observed style:
- softer, more premium elevation than v2
- cards and panels rely on both border and shadow
- corners are noticeably rounder than standard admin UI

## Sidebar Layout

Observed in `Layout.tsx`:
- expanded width: `w-[240px]`
- collapsed width: `w-16`
- grouped nav sections
- nested items/subitems
- strong active markers
- mobile overlay/drawer behavior

Parity note:
- v2 currently needs grouped navigation, collapse behavior, and stronger active state treatment

## Topbar Layout

Observed in `Layout.tsx`:
- sticky topbar
- search field
- notifications area
- quick actions
- theme toggle
- profile summary/avatar

Parity note:
- v2 topbar is cleaner but much lighter than the v1 operations shell

## Status Badge Style

Observed in v1 pages:
- tinted backgrounds with soft rings or borders
- high-contrast text
- uppercase/tracked micro-labels
- stronger semantic color variety than a generic badge set

Typical families:
- emerald success
- amber pending
- sky info/in-transit
- rose danger
- slate inactive/default

## Table Density

Observed patterns:
- denser row presentation than v2
- row cells often include stacked metadata
- operational tables mix badges, timestamps, quick actions, and secondary text in one row
- tables frequently feel like mini dashboards rather than plain grids

## Inputs and Filters

Observed patterns:
- large-radius inputs
- grouped filter bars
- chip-style quick filters
- horizontal tab/filter strips with arrows in dense modules like inventory and orders

Useful extraction targets:
- filter chip pattern
- grouped search + select + action row
- tab strip with active pill state

## Modals and Drawers

Observed patterns:
- dense modal usage in orders, team, HR, tasks
- modal flows are part of normal operations, not rare exceptions
- content blocks inside modals still follow the same rounded panel language

## Spacing Patterns

Observed style:
- generous panel padding
- compact row density inside those panels
- bigger spacing between macro-sections than between row details

Common feel:
- large page-level shells
- dense module internals

## Recommended Translation to V2

- Preserve v2 route architecture and data boundaries
- Translate v1’s visual language into shared components
- Prefer:
  - richer headers
  - grouped filter bars
  - denser operations tables
  - stronger badges
  - more expressive shell chrome
- Avoid:
  - re-creating v1 monolith pages literally if v2 already split them safely

## Phase 14D Note

Phase `14D` applies the first safe translation layer into v2:
- v1-inspired shell tokens in `frontend/app/globals.css`
- shared ops components for headers, summary cards, badges, tables, tabs, action buttons, filter bars, and batch bars
- grouped sidebar and richer topbar
- dashboard landing page visual pass

Module-level route parity still remains for:
- orders
- logistics
- inventory
- CRM
- reports
