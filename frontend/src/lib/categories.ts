export type Category = { id: string; label: string }

const STORAGE_KEY = 'zen-categories'

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'work', label: 'Work' },
  { id: 'project', label: 'Project' },
]

export function loadCategories(): Category[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...DEFAULT_CATEGORIES]
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return [...DEFAULT_CATEGORIES]
    const seen = new Set<string>()
    const out: Category[] = []
    for (const c of DEFAULT_CATEGORIES) {
      out.push(c)
      seen.add(c.id)
    }
    for (const item of parsed) {
      if (item === null || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      if (typeof o.id !== 'string' || typeof o.label !== 'string') continue
      if (seen.has(o.id)) continue
      seen.add(o.id)
      out.push({ id: o.id, label: o.label.trim() || o.id })
    }
    return out
  } catch {
    return [...DEFAULT_CATEGORIES]
  }
}

export function saveCategories(categories: Category[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(categories))
}

export function slugifyLabel(label: string): string {
  const s = label
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  return s || `category-${Date.now().toString(36)}`
}

export function categoryColor(categoryId: string): string {
  const palette = [
    '#4a6b8c',
    '#6b4a7a',
    '#4a7a6b',
    '#8c6b4a',
    '#5a6b8c',
    '#7a5a6b',
  ]
  let h = 0
  for (let i = 0; i < categoryId.length; i += 1) h = (h + categoryId.charCodeAt(i) * 13) % 1000
  if (categoryId === 'work') return '#3b6ea5'
  if (categoryId === 'project') return '#7c4a9e'
  return palette[h % palette.length]
}
