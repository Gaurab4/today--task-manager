import { useEffect, useMemo, useState } from 'react'
import { categoryColor as catColor } from '../lib/categories'
import type { Category } from '../lib/categories'
import type { Task } from '../types/task'

type Props = {
  tasks: Task[]
  categories: Category[]
}

const DAY_START_MIN = 0
const DAY_END_MIN = 24 * 60
const RANGE = DAY_END_MIN - DAY_START_MIN

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function formatHourLabel(totalMin: number): string {
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function localNowMinutes(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

export function DayCalendar({ tasks, categories }: Props) {
  const [nowMinutes, setNowMinutes] = useState(localNowMinutes)
  const label = (id: string) =>
    categories.find((c) => c.id === id)?.label ?? id
  const slots = useMemo(() => {
    const hours: number[] = []
    for (let h = 0; h <= 24; h += 1) hours.push(h)
    return hours
  }, [])

  const blocks = useMemo(() => {
    return tasks.map((task) => {
      const start = timeToMinutes(task.startTime)
      const dur =
        task.durationMinutes != null && task.durationMinutes > 0
          ? task.durationMinutes
          : 30
      const end = start + dur
      const top = ((Math.max(start, DAY_START_MIN) - DAY_START_MIN) / RANGE) * 100
      const rawH = ((Math.min(end, DAY_END_MIN) - Math.max(start, DAY_START_MIN)) / RANGE) * 100
      const height = Math.max(rawH, 3.2)
      const clipped = start < DAY_START_MIN || end > DAY_END_MIN
      return { task, top, height, clipped }
    })
  }, [tasks])

  useEffect(() => {
    const tick = () => setNowMinutes(localNowMinutes())
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [])

  const nowTop = useMemo(() => {
    const clamped = Math.min(Math.max(nowMinutes, DAY_START_MIN), DAY_END_MIN)
    return ((clamped - DAY_START_MIN) / RANGE) * 100
  }, [nowMinutes])

  return (
    <div className="day-calendar">
      <h2 className="day-calendar__title">Today</h2>
      <p className="day-calendar__sub">By start time</p>
      <div className="day-calendar__grid">
        <div className="day-calendar__times" aria-hidden>
          {slots.map((h) => (
            <div key={h} className="day-calendar__time-row">
              <span className="day-calendar__time-label">
                {formatHourLabel(h * 60)}
              </span>
            </div>
          ))}
        </div>
        <div className="day-calendar__track">
          <div
            className="day-calendar__now-line"
            style={{ top: `${nowTop}%` }}
            title={`Current time: ${formatHourLabel(nowMinutes)}`}
          >
            <span className="day-calendar__now-dot" />
          </div>
          {slots.slice(0, -1).map((h) => (
            <div key={h} className="day-calendar__hour-line" />
          ))}
          <div className="day-calendar__blocks">
            {blocks.map(({ task, top, height, clipped }) => (
              <div
                key={task.id}
                className={`day-calendar__block${task.done ? ' day-calendar__block--done' : ''}`}
                style={{
                  top: `${top}%`,
                  height: `${height}%`,
                  borderColor: catColor(task.categoryId),
                  background: `color-mix(in oklab, ${catColor(task.categoryId)} 22%, var(--bg))`,
                }}
                title={`${task.title} · ${formatHourLabel(timeToMinutes(task.startTime))}`}
              >
                <span className="day-calendar__block-time">
                  {formatHourLabel(timeToMinutes(task.startTime))}
                </span>
                <span className="day-calendar__block-title">{task.title}</span>
                <span className="day-calendar__block-cat">
                  {label(task.categoryId)}
                </span>
                {clipped && (
                  <span className="day-calendar__block-note">…</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
