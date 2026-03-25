import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import './App.css'
import { CornerDecor } from './CornerDecor'
import { PersonFigure } from './PersonFigure'
import { loadTasksForDate, saveTasksForDate, todayKey } from './storage'
import { applyTheme, readThemeFromDom, type Theme } from './theme'
import type { Task } from './types'

function sortByStartTime(a: Task, b: Task): number {
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

function parseDurationMinutes(raw: string): number | null {
  const t = raw.trim()
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

export default function App() {
  const [dateKey, setDateKey] = useState(todayKey)
  const [tasks, setTasks] = useState<Task[]>(() => loadTasksForDate(todayKey()))
  const [theme, setTheme] = useState<Theme>(() => readThemeFromDom())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [durationInput, setDurationInput] = useState('')
  const [startTime, setStartTime] = useState('09:00')

  const [sheetOpen, setSheetOpen] = useState(false)
  const [cardEntered, setCardEntered] = useState(false)
  const [sheetExit, setSheetExit] = useState<null | 'done' | 'cancel'>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const exitTransitionDoneRef = useRef(false)

  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

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

  const sorted = useMemo(() => [...tasks].sort(sortByStartTime), [tasks])

  const resetSheetForm = () => {
    setEditingId(null)
    setTitle('')
    setDurationInput('')
    setStartTime('09:00')
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
      task.durationMinutes == null ? '' : String(task.durationMinutes),
    )
    setStartTime(task.startTime)
    setSheetExit(null)
    setCardEntered(prefersReducedMotion)
    setSheetOpen(true)
  }

  const closeSheet = () => {
    setSheetOpen(false)
    setCardEntered(false)
    setSheetExit(null)
    setEditingId(null)
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
    if (editingId) {
      setTasks((prev) =>
        prev
          .map((x) =>
            x.id === editingId
              ? { ...x, title: t, durationMinutes, startTime }
              : x,
          )
          .sort(sortByStartTime),
      )
    } else {
      const next: Task = {
        id: crypto.randomUUID(),
        title: t,
        durationMinutes,
        startTime,
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
      <div className="app">
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

        <p className="app-philosophy">
          One day, one list. No ranks—only what you chose for this morning,
          afternoon, and evening.
        </p>

        {sorted.length === 0 ? (
          <p className="app-empty">
            Nothing here yet. Add what you will do today.
          </p>
        ) : (
          <ul className="task-list" aria-label="Today's tasks">
            {sorted.map((task) => (
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
                <button
                  type="button"
                  className="task-main"
                  onClick={() => openEdit(task)}
                  disabled={removingId === task.id}
                >
                  <span className="task-when">
                    {formatTimeLabel(task.startTime)}
                    <span className="task-sep">·</span>
                    {task.durationMinutes == null
                      ? '—'
                      : `${task.durationMinutes} min`}
                  </span>
                  <span className="task-title">{task.title}</span>
                </button>
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
            ))}
          </ul>
        )}

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
                  <label className="field">
                    <span>What</span>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Short description"
                      autoFocus={sheetIdle}
                      required
                      disabled={!sheetIdle}
                    />
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
                        inputMode="decimal"
                        value={durationInput}
                        onChange={(e) => setDurationInput(e.target.value)}
                        placeholder="Any amount, or leave empty"
                        autoComplete="off"
                        disabled={!sheetIdle}
                      />
                    </label>
                  </div>
                  <p className="modal-hint">
                    Start time places the task on your day. Leave minutes empty
                    if you do not want an estimate—there is no upper or lower
                    limit when you do.
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
