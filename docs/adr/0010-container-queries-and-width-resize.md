# 10. Container queries and width-only resize

Status: accepted

## Context
Spec 1.2.0 asks for cards that look right at any width, a way to resize them by dragging, and click-to-select with a sidebar. A card can be one column wide or the full row, on a phone or a wall display, so the same screen shows cards of very different widths.

## Decision
- **Card-aware layout with CSS container queries.** The shared `Card` is a size container (`@container`). Everything inside that depends on space uses container variants (`@xl:`, `@3xl:`), never viewport ones. Tailwind v4 provides them with no plugin. A test fails if a card uses a viewport breakpoint for its inner layout, and another checks that every card uses container variants.
- **A viewport grid for the page:** one column below 768 px, two from 768 px, four from 1024 px. Widths map onto it: at two columns widths 2 to 4 take the row and width 1 takes half.
- **Resize changes width only, snapped to whole columns** (1 to 4, which adds a 3-column width). Height stays content-driven. The snapping is a pure, unit-tested function; the drag uses pointer capture; the same control is a keyboard slider.
- **Selection is transient UI state**, held in the app, never stored and never part of the layout.
- **Escape belongs to the innermost thing in progress.** The resize grip listens in the capture phase and marks the key handled, so cancelling a drag does not also deselect the card or close the panel. dnd-kit handles its own Escape earlier in the event path.

## Consequences
- A card is correct at any width without JavaScript measuring it, and a width change never triggers layout code.
- Container queries are supported by current Chrome, Edge, Safari and Firefox. Older browsers fall back to the un-queried (stacked) layout.
- jsdom cannot evaluate container queries, so tests assert the structure that makes them work and the visual result is reviewed by eye. The behaviour that can be automated (snapping, keys, dispatch only on change, persistence, Escape order) is.
- The layout version stays 1: the new width is additive. A 1.1.0 build importing a file with width 3 resets that width to the default.
- No new dependencies.

## Rejected alternatives
- **A `ResizeObserver` hook that sets a size class:** testable in jsdom, but it re-renders on every resize and duplicates what CSS does natively.
- **Viewport breakpoints inside cards:** the wrong unit, because one viewport hosts cards of every width.
- **Height resizing:** cards could clip data or leave empty space, and the layout file would need a row-span field. Not requested once width-only was chosen.
- **Resizing with dnd-kit:** it is built for moving and sorting, not edge resizing.
- **A resize library:** a dependency for about twenty lines of arithmetic.
- **Storing the selection in the layout:** it is transient and would be written to storage on every click.
