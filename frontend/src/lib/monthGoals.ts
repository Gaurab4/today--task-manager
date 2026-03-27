const PREFIX = 'zen-month-goals:'

export type MonthGoalLine = {
  id: string
  text: string
}

export function monthKeyFromDateKey(dateKey: string): string {
  return dateKey.slice(0, 7)
}

function emptyLine(): MonthGoalLine {
  return { id: crypto.randomUUID(), text: '' }
}

export function newMonthGoalLine(): MonthGoalLine {
  return emptyLine()
}

/** Load goals as lines; migrates legacy plain-text storage */
export function loadMonthGoalsLines(monthKey: string): MonthGoalLine[] {
  try {
    const raw = localStorage.getItem(PREFIX + monthKey)
    if (raw == null || raw === '') {
      return [emptyLine()]
    }
    if (raw.trimStart().startsWith('[')) {
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return [emptyLine()]
      const out: MonthGoalLine[] = []
      for (const item of parsed) {
        if (
          item !== null &&
          typeof item === 'object' &&
          typeof (item as MonthGoalLine).id === 'string' &&
          typeof (item as MonthGoalLine).text === 'string'
        ) {
          out.push({
            id: (item as MonthGoalLine).id,
            text: (item as MonthGoalLine).text,
          })
        }
      }
      return out.length > 0 ? out : [emptyLine()]
    }
    // Legacy: one string with newlines
    const lines = raw.split('\n')
    return lines.map((text) => ({ id: crypto.randomUUID(), text }))
  } catch {
    return [emptyLine()]
  }
}

export function saveMonthGoalsLines(
  monthKey: string,
  lines: MonthGoalLine[],
): void {
  try {
    localStorage.setItem(PREFIX + monthKey, JSON.stringify(lines))
  } catch {
    /* ignore */
  }
}
