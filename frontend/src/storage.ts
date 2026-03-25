import type { Task } from './types'

const PREFIX = 'zen-day-tasks:'

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function loadTasksForDate(dateKey: string): Task[] {
  try {
    const raw = localStorage.getItem(PREFIX + dateKey)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isTask)
  } catch {
    return []
  }
}

export function saveTasksForDate(dateKey: string, tasks: Task[]): void {
  localStorage.setItem(PREFIX + dateKey, JSON.stringify(tasks))
}

function isTask(x: unknown): x is Task {
  if (x === null || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.title === 'string' &&
    (o.durationMinutes === null || typeof o.durationMinutes === 'number') &&
    typeof o.startTime === 'string' &&
    typeof o.done === 'boolean'
  )
}
