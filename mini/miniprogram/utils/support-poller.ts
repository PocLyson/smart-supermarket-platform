export interface SupportPollerDependencies {
  poll(): Promise<void>
  schedule(callback: () => void, delay: number): ReturnType<typeof setTimeout>
  cancel(timer?: ReturnType<typeof setTimeout>): void
  intervalMs: number
}

export interface SupportPoller {
  start(): void
  stop(): void
}

export const createSupportPoller = ({ poll, schedule, cancel, intervalMs }: SupportPollerDependencies): SupportPoller => {
  let active = false
  let running = false
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const run = async (ownGeneration: number) => {
    if (!active || running || ownGeneration !== generation) return
    running = true
    try {
      await poll()
    } finally {
      running = false
      if (active) {
        const nextGeneration = generation
        timer = schedule(() => void run(nextGeneration), intervalMs)
      }
    }
  }

  return {
    start: () => {
      if (active) return
      active = true
      generation += 1
      void run(generation)
    },
    stop: () => {
      active = false
      generation += 1
      cancel(timer)
      timer = undefined
    },
  }
}
