export type Task = {
  id: string
  title: string
  /** Minutes the task is expected to take; omit if you prefer not to estimate */
  durationMinutes: number | null
  /** Where in the day — 24h "HH:mm" */
  startTime: string
  done: boolean
}
