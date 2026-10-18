/** Font size of the y-axis labels, in pixels. */
export const AXIS_FONT_PX = 11

export const AXIS_FONT = `${AXIS_FONT_PX}px ui-sans-serif, system-ui`

/**
 * Space around the plot, [top, right, bottom, left] in pixels.
 * Axis labels are centred on their gridlines, so the label on the bottom line (0%) and the one on the top line
 * stick out of the plot by half their height. Without this room the canvas slices them in half.
 */
export const CHART_PADDING: [number, number, number, number] = [
  Math.ceil(AXIS_FONT_PX / 2) + 3,
  0,
  Math.ceil(AXIS_FONT_PX / 2) + 3,
  0,
]
