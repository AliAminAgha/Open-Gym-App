import { describe, it, expect } from 'vitest'
import { buildPartnerSummary, parsePartnerSummary, buildWeekActivity, PARTNER_FMT } from './partner-summary.js'
import { streakWeeks } from './history.js'

const state = (over = {}) => ({
  unit: 'kg', workouts: [], bodyweight: [], routines: [], week: {}, dayPlan: {},
  profile: null, ...over
})

describe('buildWeekActivity', () => {
  it('marks trained days in the current Mon–Sun week', () => {
    // 2026-09-13 is a Sunday; week Mon 8 – Sun 14
    const today = new Date(2026, 8, 13)
    const activity = buildWeekActivity([{ d: '2026-09-10' }, { d: '2026-09-13' }], today)
    expect(activity).toEqual([false, false, false, true, false, false, true])
  })
})

describe('buildPartnerSummary', () => {
  it('includes streak and counts without workout entries', () => {
    const S = state({
      workouts: [
        { d: '2026-09-10', end: 1 },
        { d: '2026-09-13', end: 2 }
      ],
      profile: {
        completedAt: '2026-01-01', goal: 'fatloss', targetW: 75,
        age: 30, sex: 'male', heightCm: 180, experience: 'beginner',
        daysPerWeek: 3, sessionMin: 45, preferredDays: [1, 3, 5],
        activity: 'moderate', location: 'gym', equipment: [], style: 'ppl',
        favorites: [], avoid: [], nutrition: { enabled: false, log: [] }
      },
      bodyweight: [{ d: '2026-09-13', w: 80, t: 1 }]
    })
    const summary = buildPartnerSummary(S, 'Alex')
    expect(summary.opengym_partner).toBe(PARTNER_FMT)
    expect(summary.name).toBe('Alex')
    expect(summary.streakWeeks).toBe(streakWeeks(S))
    expect(summary.workoutsThisMonth).toBeGreaterThanOrEqual(2)
    expect(summary.totalWorkouts).toBe(2)
    expect(summary.goal).toMatchObject({ type: 'fatloss', currentW: 80, targetW: 75 })
    expect(summary.weekActivity).toHaveLength(7)
    expect(summary).not.toHaveProperty('workouts')
  })
})

describe('parsePartnerSummary', () => {
  it('round-trips a built summary', () => {
    const built = buildPartnerSummary(state({ workouts: [{ d: '2026-09-13' }] }), 'Sam')
    const parsed = parsePartnerSummary(JSON.stringify(built))
    expect(parsed.name).toBe('Sam')
    expect(parsed.streakWeeks).toBe(built.streakWeeks)
    expect(parsed.weekActivity).toEqual(built.weekActivity)
  })

  it('rejects invalid files', () => {
    expect(() => parsePartnerSummary('{}')).toThrow(/partner progress/i)
  })
})
