import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import '../styles/App.css'
import {
  categoryColor,
  loadCategories,
  saveCategories,
  slugifyLabel,
} from '../lib/categories'
import { CornerDecor } from './CornerDecor'
import { DayCalendar } from './DayCalendar'
import { PersonFigure } from './PersonFigure'
import {
  loadMonthGoalsLines,
  monthKeyFromDateKey,
  newMonthGoalLine,
  saveMonthGoalsLines,
  type MonthGoalLine,
} from '../lib/monthGoals'
import { loadTasksForDate, saveTasksForDate, todayKey } from '../lib/storage'
import { applyTheme, readThemeFromDom, type Theme } from '../lib/theme'
import type { Subtask, SubtaskListStyle, Task } from '../types/task'

/** Reserved `<select>` value to show inline “new category” name */
const ADD_CATEGORY_OPTION = '__add__'

/** One non-empty line → one subtask; reuse ids when line index/text matches */
function subtasksFromTextarea(text: string, previous: Subtask[]): Subtask[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  return lines.map((line, i) => {
    const prev = previous[i]
    if (prev && prev.text === line) return prev
    if (prev) return { ...prev, text: line }
    return { id: crypto.randomUUID(), text: line, done: false }
  })
}

function sortByStartTime(a: Task, b: Task): number {
  return a.startTime.localeCompare(b.startTime)
}

function sortForTaskList(a: Task, b: Task): number {
  if (a.done !== b.done) return a.done ? 1 : -1
  return a.startTime.localeCompare(b.startTime)
}

function formatTimeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Minutes field: digits only; empty means no estimate */
function parseDurationMinutes(raw: string): number | null {
  const t = raw.replace(/\D/g, '').trim()
  if (t === '') return null
  const n = parseInt(t, 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

const DAY_END_MIN = 24 * 60

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Matches DayCalendar: null/0 duration → 30 min for end time */
function taskDurationForEnd(task: Task): number {
  return task.durationMinutes != null && task.durationMinutes > 0
    ? task.durationMinutes
    : 30
}

function taskEndMinutes(task: Task): number {
  return Math.min(timeToMinutes(task.startTime) + taskDurationForEnd(task), DAY_END_MIN)
}

function localNowMinutes(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

function minutesToHHmm(total: number): string {
  const clamped = Math.min(Math.max(0, total), DAY_END_MIN - 1)
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** New task default: now, or after the latest task end — whichever is later */
function defaultStartTimeForNewTask(existing: Task[]): string {
  const now = localNowMinutes()
  if (existing.length === 0) return minutesToHHmm(now)
  let maxEnd = 0
  for (const t of existing) {
    maxEnd = Math.max(maxEnd, taskEndMinutes(t))
  }
  return minutesToHHmm(Math.max(now, maxEnd))
}

export default function App() {
  const [dateKey, setDateKey] = useState(todayKey)
  const [tasks, setTasks] = useState<Task[]>(() => loadTasksForDate(todayKey()))
  const [categories, setCategories] = useState(loadCategories)
  const [theme, setTheme] = useState<Theme>(() => readThemeFromDom())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [durationInput, setDurationInput] = useState('')
  const [startTime, setStartTime] = useState(() =>
    minutesToHHmm(localNowMinutes()),
  )
  const [categoryId, setCategoryId] = useState('work')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [subtaskText, setSubtaskText] = useState('')
  const [subtaskListStyle, setSubtaskListStyle] =
    useState<SubtaskListStyle>('bullet')

  const [sheetOpen, setSheetOpen] = useState(false)
  const [cardEntered, setCardEntered] = useState(false)
  const [sheetExit, setSheetExit] = useState<null | 'done' | 'cancel'>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const exitTransitionDoneRef = useRef(false)
  const subtaskGutterRef = useRef<HTMLDivElement>(null)
  const subtaskTextareaRef = useRef<HTMLTextAreaElement>(null)
  const monthGoalInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  const onSubtaskTextareaScroll = (
    e: React.UIEvent<HTMLTextAreaElement>,
  ) => {
    const g = subtaskGutterRef.current
    if (g) g.scrollTop = e.currentTarget.scrollTop
  }
  const onSubtaskGutterScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const t = subtaskTextareaRef.current
    if (t) t.scrollTop = e.currentTarget.scrollTop
  }

  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  useEffect(() => {
    saveCategories(categories)
  }, [categories])

  const syncDayIfNeeded = useCallback(() => {
    const k = todayKey()
    if (k !== dateKey) {
      setDateKey(k)
      setTasks(loadTasksForDate(k))
    }
  }, [dateKey])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') syncDayIfNeeded()
    }
    window.addEventListener('focus', syncDayIfNeeded)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('focus', syncDayIfNeeded)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [syncDayIfNeeded])

  useEffect(() => {
    saveTasksForDate(dateKey, tasks)
  }, [dateKey, tasks])

  const monthKey = useMemo(() => monthKeyFromDateKey(dateKey), [dateKey])
  const monthLabel = useMemo(() => {
    const [y, mo] = monthKey.split('-').map(Number)
    const dt = new Date(y, mo - 1, 1)
    return dt.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }, [monthKey])

  const [monthGoalLines, setMonthGoalLines] = useState<MonthGoalLine[]>(() =>
    loadMonthGoalsLines(monthKeyFromDateKey(todayKey())),
  )

  useEffect(() => {
    setMonthGoalLines(loadMonthGoalsLines(monthKey))
  }, [monthKey])

  const updateMonthGoalLine = (id: string, text: string) => {
    setMonthGoalLines((prev) => {
      const next = prev.map((l) => (l.id === id ? { ...l, text } : l))
      saveMonthGoalsLines(monthKey, next)
      return next
    })
  }

  const removeMonthGoalLine = (id: string) => {
    setMonthGoalLines((prev) => {
      if (prev.length <= 1) {
        const next = [{ ...prev[0], text: '' }]
        saveMonthGoalsLines(monthKey, next)
        return next
      }
      const next = prev.filter((l) => l.id !== id)
      saveMonthGoalsLines(monthKey, next)
      return next
    })
  }

  const onMonthGoalKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    lineId: string,
  ) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const idx = monthGoalLines.findIndex((l) => l.id === lineId)
    if (idx === -1) return
    if (idx < monthGoalLines.length - 1) {
      const nextId = monthGoalLines[idx + 1].id
      requestAnimationFrame(() => {
        monthGoalInputRefs.current.get(nextId)?.focus()
      })
      return
    }
    const newLine = newMonthGoalLine()
    setMonthGoalLines((prev) => {
      const next = [...prev, newLine]
      saveMonthGoalsLines(monthKey, next)
      return next
    })
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        monthGoalInputRefs.current.get(newLine.id)?.focus()
      })
    })
  }

  useEffect(() => {
    if (!sheetOpen || prefersReducedMotion) return
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setCardEntered(true))
    })
    return () => cancelAnimationFrame(id)
  }, [sheetOpen, prefersReducedMotion])

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  const sortedByTime = useMemo(() => [...tasks].sort(sortByStartTime), [tasks])
  const sortedForList = useMemo(() => [...tasks].sort(sortForTaskList), [tasks])
  const subtaskDraftLines = useMemo(
    () => subtaskText.split('\n'),
    [subtaskText],
  )

  const resetSheetForm = () => {
    setEditingId(null)
    setTitle('')
    setDurationInput('')
    setStartTime(defaultStartTimeForNewTask(tasks))
    setCategoryId('work')
    setNewCategoryName('')
    setAddingCategory(false)
    setSubtaskText('')
    setSubtaskListStyle('bullet')
  }

  const addCustomCategory = () => {
    const label = newCategoryName.trim()
    if (!label) return
    let id = slugifyLabel(label)
    if (categories.some((c) => c.id === id)) {
      setCategoryId(id)
      setNewCategoryName('')
      setAddingCategory(false)
      return
    }
    let n = 0
    while (categories.some((c) => c.id === id)) {
      n += 1
      id = `${slugifyLabel(label)}-${n}`
    }
    setCategories((prev) => [...prev, { id, label }])
    setCategoryId(id)
    setNewCategoryName('')
    setAddingCategory(false)
  }

  const openAdd = () => {
    exitTransitionDoneRef.current = false
    resetSheetForm()
    setSheetExit(null)
    setCardEntered(prefersReducedMotion)
    setSheetOpen(true)
  }

  const openEdit = (task: Task) => {
    exitTransitionDoneRef.current = false
    setEditingId(task.id)
    setTitle(task.title)
    setDurationInput(
      task.durationMinutes == null ? '' : String(Math.floor(task.durationMinutes)),
    )
    setStartTime(task.startTime)
    setCategoryId(task.categoryId)
    setSubtaskText(task.subtasks.map((s) => s.text).join('\n'))
    setSubtaskListStyle(task.subtaskListStyle)
    setNewCategoryName('')
    setAddingCategory(false)
    setSheetExit(null)
    setCardEntered(prefersReducedMotion)
    setSheetOpen(true)
  }

  const closeSheet = () => {
    setSheetOpen(false)
    setCardEntered(false)
    setSheetExit(null)
    setEditingId(null)
    setNewCategoryName('')
    setSubtaskText('')
    setAddingCategory(false)
    exitTransitionDoneRef.current = false
  }

  const startCancel = () => {
    if (sheetExit) return
    if (prefersReducedMotion) {
      closeSheet()
      return
    }
    setSheetExit('cancel')
  }

  const commitFromForm = () => {
    const t = title.trim()
    if (!t) return
    const durationMinutes = parseDurationMinutes(durationInput)
    const previousForSubtasks =
      editingId != null
        ? (tasks.find((x) => x.id === editingId)?.subtasks ?? [])
        : []
    const mergedSubtasks = subtasksFromTextarea(
      subtaskText,
      previousForSubtasks,
    )
    const payload = {
      title: t,
      categoryId,
      subtasks: mergedSubtasks,
      subtaskListStyle,
      durationMinutes,
      startTime,
    }
    if (editingId) {
      setTasks((prev) =>
        prev
          .map((x) =>
            x.id === editingId ? { ...x, ...payload } : x,
          )
          .sort(sortByStartTime),
      )
    } else {
      const next: Task = {
        id: crypto.randomUUID(),
        ...payload,
        done: false,
      }
      setTasks((prev) => [...prev, next].sort(sortByStartTime))
    }
  }

  const submitForm = (e: FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    if (sheetExit) return
    if (prefersReducedMotion) {
      commitFromForm()
      setSheetOpen(false)
      setCardEntered(false)
      setSheetExit(null)
      setEditingId(null)
      return
    }
    exitTransitionDoneRef.current = false
    setSheetExit('done')
  }

  const handleCardTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    if (!sheetExit) return
    if (e.propertyName !== 'transform') return
    if (exitTransitionDoneRef.current) return
    exitTransitionDoneRef.current = true
    if (sheetExit === 'done') commitFromForm()
    closeSheet()
  }

  useEffect(() => {
    if (!sheetOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [sheetOpen])

  useEffect(() => {
    if (!sheetOpen) return
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return
      ev.preventDefault()
      if (sheetExit) return
      if (!prefersReducedMotion && !cardEntered) return
      if (prefersReducedMotion) {
        closeSheet()
      } else {
        setSheetExit('cancel')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen, sheetExit, cardEntered, prefersReducedMotion])

  const toggleDone = (id: string) => {
    setTasks((prev) =>
      prev.map((x) => (x.id === id ? { ...x, done: !x.done } : x)),
    )
  }

  const toggleSubtaskDone = (taskId: string, subId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t
        return {
          ...t,
          subtasks: t.subtasks.map((s) =>
            s.id === subId ? { ...s, done: !s.done } : s,
          ),
        }
      }),
    )
  }

  const confirmRemoveTask = (id: string) => {
    setTasks((prev) => prev.filter((x) => x.id !== id))
    setRemovingId(null)
  }

  const beginRemoveTask = (id: string) => {
    if (prefersReducedMotion) {
      confirmRemoveTask(id)
      return
    }
    setRemovingId(id)
  }

  const onRemoveAnimationEnd = (e: React.AnimationEvent<HTMLLIElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.animationName !== 'taskRowCancel') return
    const id = removingId
    if (id) confirmRemoveTask(id)
  }

  const prettyDate = useMemo(() => {
    const [y, mo, d] = dateKey.split('-').map(Number)
    const dt = new Date(y, mo - 1, d)
    return dt.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
  }, [dateKey])

  const categoryLabel = (id: string) =>
    categories.find((c) => c.id === id)?.label ?? id

  const sheetIdle = cardEntered && !sheetExit
  const cardClass = [
    'task-overlay__card',
    cardEntered && 'task-overlay__card--entered',
    sheetExit === 'done' && 'task-overlay__card--exit-done',
    sheetExit === 'cancel' && 'task-overlay__card--exit-cancel',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <CornerDecor theme={theme} />
      <div className="app-shell">
        <aside className="app-goals" aria-label="Monthly goals">
          <div className="month-goals-panel">
            <h2 className="month-goals-panel__title" id="month-goals-heading">
              {monthLabel}
            </h2>
            <p className="month-goals-panel__sub">Monthly goals</p>
            <div className="month-goals-panel__notebook">
              <ul
                className="month-goals-lines"
                aria-labelledby="month-goals-heading"
              >
                {monthGoalLines.map((line, index) => (
                  <li key={line.id} className="month-goals-line">
                    <span className="month-goals-line__gutter" aria-hidden>
                      {index + 1}.
                    </span>
                    <input
                      type="text"
                      className="month-goals-line__input"
                      ref={(el) => {
                        if (el) monthGoalInputRefs.current.set(line.id, el)
                        else monthGoalInputRefs.current.delete(line.id)
                      }}
                      value={line.text}
                      onChange={(e) =>
                        updateMonthGoalLine(line.id, e.target.value)
                      }
                      onKeyDown={(e) => onMonthGoalKeyDown(e, line.id)}
                      placeholder="Type a goal…"
                      spellCheck
                      aria-label={`Goal ${index + 1}`}
                    />
                    <button
                      type="button"
                      className="btn-ghost month-goals-line__remove"
                      onClick={() => removeMonthGoalLine(line.id)}
                      aria-label={`Remove goal ${index + 1}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        <div className="app app-main">
          <header className="app-header">
            <div>
              <h1 className="app-title">Today</h1>
              <p className="app-sub">{prettyDate}</p>
            </div>
            <div className="app-header-actions">
              <button
                type="button"
                className="btn-theme"
                onClick={toggleTheme}
                aria-label={
                  theme === 'dark'
                    ? 'Switch to light theme'
                    : 'Switch to dark theme'
                }
              >
                {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
              <button type="button" className="btn-primary" onClick={openAdd}>
                Add task
              </button>
            </div>
          </header>

          <div className="app-main-notes">
            <p className="app-main-notes__intro">
              One day, one list. Categories and subtasks keep the day clear—use
              the timeline on the right to see your day by time.
            </p>

          <div className="app-list-region">
            {sortedForList.length === 0 ? (
              <p className="app-empty">
                Nothing here yet. Add what you will do today.
              </p>
            ) : (
              <ul className="task-list" aria-label="Today's tasks">
                {sortedForList.map((task) => {
                  const RowList =
                    task.subtaskListStyle === 'ordered' ? 'ol' : 'ul'
                  return (
                  <li
                    key={task.id}
                    className={[
                      'task-row',
                      task.done && 'done',
                      removingId === task.id && 'task-row--removing',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onAnimationEnd={onRemoveAnimationEnd}
                  >
                    <label className="task-check">
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={() => toggleDone(task.id)}
                        disabled={removingId === task.id}
                        aria-label={`Mark done: ${task.title}`}
                      />
                    </label>
                    <div className="task-main-col">
                      <button
                        type="button"
                        className="task-main"
                        onClick={() => openEdit(task)}
                        disabled={removingId === task.id}
                      >
                        <span className="task-meta-row">
                          <span className="task-when">
                            {formatTimeLabel(task.startTime)}
                            {task.durationMinutes != null && (
                              <>
                                <span className="task-sep">·</span>
                                {`${task.durationMinutes} min`}
                              </>
                            )}
                          </span>
                          <span
                            className="task-cat-badge"
                            style={{
                              borderColor: categoryColor(task.categoryId),
                              color: categoryColor(task.categoryId),
                            }}
                          >
                            {categoryLabel(task.categoryId)}
                          </span>
                        </span>
                        <span className="task-title">{task.title}</span>
                      </button>
                      {task.subtasks.length > 0 && (
                        <RowList
                          className={`task-subtasks task-subtasks--${task.subtaskListStyle}`}
                        >
                          {task.subtasks.map((s) => (
                            <li key={s.id}>
                              <label className="task-subtask-label">
                                <input
                                  type="checkbox"
                                  checked={s.done}
                                  onChange={() =>
                                    toggleSubtaskDone(task.id, s.id)
                                  }
                                  disabled={removingId === task.id}
                                />
                                <span
                                  className={
                                    s.done ? 'task-subtask-done' : undefined
                                  }
                                >
                                  {s.text}
                                </span>
                              </label>
                            </li>
                          ))}
                        </RowList>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn-ghost task-remove"
                      onClick={() => beginRemoveTask(task.id)}
                      disabled={removingId !== null}
                      aria-label={`Remove ${task.title}`}
                    >
                      Remove
                    </button>
                  </li>
                  )
                })}
              </ul>
            )}
          </div>
          </div>
        </div>

        <aside className="app-calendar" aria-label="Day timeline">
          <DayCalendar tasks={sortedByTime} categories={categories} />
        </aside>

        {sheetOpen && (
          <div
            className="task-overlay"
            role="dialog"
            aria-modal
            aria-labelledby="task-sheet-title"
          >
            <button
              type="button"
              className="task-overlay__backdrop"
              aria-label="Close"
              onClick={() => {
                if (sheetIdle) startCancel()
              }}
            />
            <div className="task-overlay__stage">
              <div className="task-overlay__person">
                <PersonFigure idle={sheetIdle} />
              </div>
              <div
                className={cardClass}
                onTransitionEnd={handleCardTransitionEnd}
              >
                <form className="modal-form" onSubmit={submitForm}>
                  <h2 className="modal-title" id="task-sheet-title">
                    {editingId ? 'Edit task' : 'New task'}
                  </h2>
                  <p className="task-overlay__hint">
                    {editingId
                      ? 'Your card is back—adjust and save when ready.'
                      : 'Here is your card—fill it in, then tap Done.'}
                  </p>
                  <div className="field-group field-group--what">
                    <span className="field-group__label">What</span>
                    <input
                      id="task-title-input"
                      className="field-group__title-input"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Short description"
                      autoFocus={sheetIdle}
                      required
                      disabled={!sheetIdle}
                      aria-label="Task title"
                    />
                    <div className="field-group__subtasks">
                      <span className="field-group__sub-label">Subtasks</span>
                      <div
                        className="subtask-style-toggle"
                        role="group"
                        aria-label="Subtask list style"
                      >
                        <label className="subtask-style-option">
                          <input
                            type="radio"
                            name="subtaskStyle"
                            checked={subtaskListStyle === 'bullet'}
                            onChange={() => setSubtaskListStyle('bullet')}
                            disabled={!sheetIdle}
                          />
                          Bullets
                        </label>
                        <label className="subtask-style-option">
                          <input
                            type="radio"
                            name="subtaskStyle"
                            checked={subtaskListStyle === 'ordered'}
                            onChange={() => setSubtaskListStyle('ordered')}
                            disabled={!sheetIdle}
                          />
                          Numbers
                        </label>
                      </div>
                      <div
                        className={[
                          'subtask-editor',
                          `subtask-editor--${subtaskListStyle}`,
                          !sheetIdle && 'subtask-editor--disabled',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <div
                          ref={subtaskGutterRef}
                          className="subtask-editor__gutter"
                          aria-hidden
                          onScroll={onSubtaskGutterScroll}
                        >
                          {subtaskListStyle === 'ordered' ? (
                            <ol className="subtask-editor__gutter-list">
                              {subtaskDraftLines.map((_, i) => (
                                <li key={i}>{'\u200B'}</li>
                              ))}
                            </ol>
                          ) : (
                            <ul className="subtask-editor__gutter-list">
                              {subtaskDraftLines.map((_, i) => (
                                <li key={i}>{'\u200B'}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <textarea
                          ref={subtaskTextareaRef}
                          className="subtask-editor__input"
                          value={subtaskText}
                          onChange={(e) => setSubtaskText(e.target.value)}
                          onScroll={onSubtaskTextareaScroll}
                          wrap="off"
                          placeholder="One subtask per line..."
                          rows={5}
                          disabled={!sheetIdle}
                          spellCheck={false}
                          aria-label="Subtasks, one per line"
                        />
                      </div>
                    </div>
                  </div>

                  <label className="field">
                    <span>Category</span>
                    <div className="category-field">
                      <select
                        value={
                          addingCategory ? ADD_CATEGORY_OPTION : categoryId
                        }
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === ADD_CATEGORY_OPTION) {
                            setAddingCategory(true)
                            setNewCategoryName('')
                          } else {
                            setCategoryId(v)
                            setAddingCategory(false)
                            setNewCategoryName('')
                          }
                        }}
                        disabled={!sheetIdle}
                        aria-label="Category"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                        <option value={ADD_CATEGORY_OPTION}>
                          + Add new category…
                        </option>
                      </select>
                      {addingCategory && (
                        <div className="category-field__add">
                          <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) =>
                              setNewCategoryName(e.target.value)
                            }
                            placeholder="Name for new category"
                            disabled={!sheetIdle}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                addCustomCategory()
                              }
                            }}
                            aria-label="New category name"
                          />
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={addCustomCategory}
                            disabled={!sheetIdle}
                          >
                            Add
                          </button>
                        </div>
                      )}
                    </div>
                  </label>

                  <div className="field-row">
                    <label className="field">
                      <span>Starts</span>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        required
                        disabled={!sheetIdle}
                      />
                    </label>
                    <label className="field">
                      <span>Minutes (optional)</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        value={durationInput}
                        onChange={(e) =>
                          setDurationInput(e.target.value.replace(/\D/g, ''))
                        }
                        placeholder="Digits only"
                        disabled={!sheetIdle}
                      />
                    </label>
                  </div>

                  <p className="modal-hint">
                    Minutes accept numbers only. Subtasks: one line each in the
                    box above. Add a category from the bottom of the category
                    menu.
                  </p>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={startCancel}
                      disabled={!sheetIdle}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={!sheetIdle}
                    >
                      {editingId ? 'Save' : 'Done'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
