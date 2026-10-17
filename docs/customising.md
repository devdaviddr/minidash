# Customising the dashboard

Everything here is in the browser. Nothing is sent to the agent, and nothing about your layout leaves your machine.

## Themes
The **System / Light / Dark** switch is in the header. System (the default) follows your operating system and changes live when it does. Your choice is remembered in this browser and applied before the page paints, so there is no flash of the wrong theme. Charts recolour at once.

Both themes meet WCAG AA contrast (4.5:1) for text. A test reads the real colour tokens and fails the build if a pair drops below that.

## The customise panel
Click **Customise** in the header. A panel opens on the right and the dashboard shifts over so you can watch it change as you work. Press **Escape** or the close button to finish; focus returns to the Customise button.

| You can | How |
| --- | --- |
| Show or hide a card, or the summary strip | The checkbox next to its name |
| Change a card's width | 1 column, 2 columns or Full width |
| Reorder cards | Drag the handle (below), or the ↑ and ↓ buttons |
| Hide details inside a card | Open **Details shown** on that card and untick what you do not want |
| Start over | **Reset to default** (asks you to confirm) |
| Move your layout to another browser | **Export layout** and **Import layout…** |

Widths apply on large screens, where the grid has four columns. On smaller screens cards stack in one column, in your chosen order.

### Reordering
While the panel is open, every card shows a **⠿ Drag** handle at its top edge.

- **Mouse or touch:** drag the handle. (Touch needs a short press first, so scrolling still works.)
- **Keyboard:** Tab to a handle, press **Space** to pick the card up, move it with the **arrow keys**, and press **Space** to drop it. **Escape** cancels. Screen readers hear each step announced.
- **Buttons:** in the panel, **Move … earlier** and **Move … later** shift a card by one place among the cards you can see. Hidden cards never absorb a step. This is the simplest route if dragging is awkward.

### Details you can hide
| Card | Details |
| --- | --- |
| Summary strip | CPU, GPU, Memory, Network, Power |
| CPU | History chart, Per-core bars, Load average |
| GPU & power | History chart, CPU clusters, Temperatures, Fans |
| Unified memory | History chart, Breakdown bar, Swap |
| Network | History chart, Interface list |
| Storage | I/O chart, Per-volume throughput |
| Shares & accounts | Mounted on this Mac, Shared by this Mac, Connected clients |
| Containers | Runtimes that are not running |
| Processes | Owner column, GPU note |

Hiding a detail removes only that detail. The rest of the card, and every other card, is untouched.

## Saving, exporting and importing
Your layout is saved automatically in this browser (`localStorage`, key `minidash.layout`; the theme is `minidash.theme`). Clearing the site's data resets both. If the browser will not let minidash store anything, the panel says so and the layout lasts until you close the page.

**Export layout** downloads `minidash-layout.json`. **Import layout…** reads one back. Import checks the file first:

- A file that is not valid JSON, is not a minidash layout, or comes from a newer minidash is **refused with a message, and your layout is not changed**.
- Things a different version could legitimately produce are repaired, and the panel tells you what it did: unknown cards or details are ignored, a card missing from the file is added with its defaults (so cards from a newer minidash appear automatically), and an unusable width falls back to the card's default.

### File format
```json
{
  "version": 1,
  "summary": { "visible": true, "hidden": ["power"] },
  "cards": [
    { "id": "gpu", "visible": true, "span": 2, "hidden": [] },
    { "id": "cpu", "visible": true, "span": 4, "hidden": ["cores"] }
  ]
}
```
The order of `cards` is the display order. `span` is 1, 2 or 4. Card ids: `cpu`, `gpu`, `memory`, `network`, `storage`, `shares`, `containers`, `processes`. The theme is not part of the file, because it often differs per device.

## Wall display
`?wall` in the URL, or the **Wall display** button, hides the process table and the shares card and enlarges the type. It is applied on top of your layout and never changes it, so turning it off brings those cards back.

## Ideas
- **Wall screen:** hide Processes and Shares, set CPU and Network to full width, and hide the per-core bars.
- **Phone:** hide the summary strip, history charts and Containers, and keep CPU, Memory and Storage.
- **Quiet server:** hide Fans, Temperatures and the process note.

## Accessibility
Every control in the panel has an accessible name and a visible focus style, drag and drop has a full keyboard path, the live region announces drags, and animations stop under your system's reduced-motion setting.

## Limits
- One layout per browser. There are no named layouts and no sync between devices (use export and import).
- Cards flow in a grid. You choose order and width, not exact positions.
- Colours are not customisable beyond Light and Dark.
