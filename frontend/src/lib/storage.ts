import type { Subtask, SubtaskListStyle, Task } from '../types/task'

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
    return parsed
      .map((x) => normalizeTask(x))
      .filter((t): t is Task => t !== null)
  } catch {
    return []
  }
}

export function saveTasksForDate(dateKey: string, tasks: Task[]): void {
  localStorage.setItem(PREFIX + dateKey, JSON.stringify(tasks))
}

function normalizeTask(x: unknown): Task | null {
  if (x === null || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  if (
    typeof o.id !== 'string' ||
    typeof o.title !== 'string' ||
    typeof o.startTime !== 'string' ||
    typeof o.done !== 'boolean'
  ) {
    return null
  }
  if (o.durationMinutes !== null && typeof o.durationMinutes !== 'number') {
    return null
  }

  const categoryId =
    typeof o.categoryId === 'string' && o.categoryId.length > 0
      ? o.categoryId
      : 'work'

  const subtasks: Subtask[] = []
  if (Array.isArray(o.subtasks)) {
    for (const st of o.subtasks) {
      if (st === null || typeof st !== 'object') continue
      const s = st as Record<string, unknown>
      if (
        typeof s.id === 'string' &&
        typeof s.text === 'string' &&
        typeof s.done === 'boolean'
      ) {
        subtasks.push({ id: s.id, text: s.text, done: s.done })
      }
    }
  }

  const subtaskListStyle: SubtaskListStyle =
    o.subtaskListStyle === 'ordered' ? 'ordered' : 'bullet'

  return {
    id: o.id,
    title: o.title,
    categoryId,
    subtasks,
    subtaskListStyle,
    durationMinutes:
      o.durationMinutes === null || typeof o.durationMinutes === 'number'
        ? (o.durationMinutes as number | null)
        : null,
    startTime: o.startTime,
    done: o.done,
  }
}
