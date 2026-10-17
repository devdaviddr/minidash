import type { ComponentType } from 'react'
import { ContainersCard } from '../components/ContainersCard'
import { CpuCard } from '../components/CpuCard'
import { DisksCard } from '../components/DisksCard'
import { GpuCard } from '../components/GpuCard'
import { MemoryCard } from '../components/MemoryCard'
import { NetworkCard } from '../components/NetworkCard'
import { ProcessesCard } from '../components/ProcessesCard'
import { SharesCard } from '../components/SharesCard'
import type { CardId } from './catalogue'
import type { CardProps } from './parts'

/** Which component draws each card. The catalogue (catalogue.ts) says what exists; this says how to draw it.
 * Typing it as a Record over CardId means adding a catalogue entry without a component fails to compile. */
export const COMPONENTS: Record<CardId, ComponentType<CardProps>> = {
  cpu: CpuCard,
  gpu: GpuCard,
  memory: MemoryCard,
  network: NetworkCard,
  storage: DisksCard,
  shares: SharesCard,
  containers: ContainersCard,
  processes: ProcessesCard,
}
