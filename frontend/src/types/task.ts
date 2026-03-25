export type Subtask = {
  id: string
  text: string
  done: boolean
}

export type SubtaskListStyle = 'bullet' | 'ordered'

export type Task = {
  id: string
  title: string
  /** Stable id: work | project | custom slug */
  categoryId: string
  subtasks: Subtask[]
  subtaskListStyle: SubtaskListStyle
  /** Minutes the task is expected to take; omit if you prefer not to estimate */
  durationMinutes: number | null
  /** Where in the day — 24h "HH:mm" */
  startTime: string
  done: boolean
}
