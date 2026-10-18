/** Pure data describing every card and the parts inside it. The single source of truth: layout
 * validation, the customise panel and the grid all derive from it, so a new card is one entry. */

export type Span = 1 | 2 | 3 | 4
export const SPANS: Span[] = [1, 2, 3, 4]

export interface PartDef {
  id: string
  label: string
}

export interface CardDef {
  id: string
  title: string
  defaultSpan: Span
  parts: PartDef[]
}

/** Order here is the default display order (the 0.1.0 order). */
export const CARDS = [
  { id: 'cpu', title: 'CPU', defaultSpan: 2, parts: [
    { id: 'chart', label: 'History chart' },
    { id: 'cores', label: 'Per-core reactor' },
    { id: 'load', label: 'Load average' },
  ] },
  { id: 'gpu', title: 'GPU & power', defaultSpan: 2, parts: [
    { id: 'chart', label: 'History chart' },
    { id: 'clusters', label: 'CPU clusters' },
    { id: 'temps', label: 'Temperatures' },
    { id: 'fans', label: 'Fans' },
  ] },
  { id: 'memory', title: 'Unified memory', defaultSpan: 2, parts: [
    { id: 'chart', label: 'History chart' },
    { id: 'breakdown', label: 'Breakdown bar' },
    { id: 'swap', label: 'Swap' },
  ] },
  { id: 'network', title: 'Network', defaultSpan: 2, parts: [
    { id: 'chart', label: 'History chart' },
    { id: 'interfaces', label: 'Interface list' },
  ] },
  { id: 'storage', title: 'Storage', defaultSpan: 2, parts: [
    { id: 'chart', label: 'I/O chart' },
    { id: 'throughput', label: 'Per-volume throughput' },
  ] },
  { id: 'shares', title: 'Shares & accounts', defaultSpan: 2, parts: [
    { id: 'mounts', label: 'Mounted on this Mac' },
    { id: 'offered', label: 'Shared by this Mac' },
    { id: 'clients', label: 'Connected clients' },
  ] },
  { id: 'containers', title: 'Containers', defaultSpan: 4, parts: [
    { id: 'stopped', label: 'Runtimes that are not running' },
  ] },
  { id: 'processes', title: 'Processes', defaultSpan: 4, parts: [
    { id: 'user', label: 'Owner column' },
    { id: 'note', label: 'GPU note' },
  ] },
] as const satisfies readonly CardDef[]

export type CardId = (typeof CARDS)[number]['id']
export const CARD_IDS: CardId[] = CARDS.map((c) => c.id)

export const SUMMARY_PARTS: PartDef[] = [
  { id: 'cpu', label: 'CPU' },
  { id: 'gpu', label: 'GPU' },
  { id: 'memory', label: 'Memory' },
  { id: 'network', label: 'Network' },
  { id: 'power', label: 'Power' },
]

export const cardDef = (id: string): CardDef | undefined => CARDS.find((c) => c.id === id)

/** Part ids that exist for a card (or for the summary strip). */
export function partIds(id: string): string[] {
  if (id === 'summary') return SUMMARY_PARTS.map((p) => p.id)
  return cardDef(id)?.parts.map((p) => p.id) ?? []
}
