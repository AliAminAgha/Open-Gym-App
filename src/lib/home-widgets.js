// Home dashboard widgets — fixed core from onboarding, optional add-ons.
import { t } from './i18n.js'

/** Always shown (order matters). */
export const FIXED_HOME_WIDGETS = ['week', 'today', 'nutrition']

/** User-toggleable catalog. */
export const OPTIONAL_HOME_WIDGETS = [
  {
    id: 'goal',
    icon: 'target',
    label: 'Weight goal',
    desc: 'Distance to your target weight'
  },
  {
    id: 'stats',
    icon: 'chart',
    label: 'Quick stats',
    desc: 'Workouts, streak and 30-day weight'
  },
  {
    id: 'partner',
    icon: 'heart',
    label: 'Partner',
    desc: 'Shared streaks and progress'
  },
  {
    id: 'activity',
    icon: 'calendar',
    label: 'Activity map',
    desc: 'Heatmap of recent training'
  }
]

/** Default optional set for new profiles / upgrades. */
export const DEFAULT_HOME_WIDGETS = ['goal', 'stats']

export function optionalHomeCatalog() {
  return OPTIONAL_HOME_WIDGETS.map(w => ({
    ...w,
    label: t(w.label),
    desc: t(w.desc)
  }))
}

/** Normalize persisted list — drop unknown ids, keep order. */
export function normalizeHomeWidgets(list) {
  const allowed = new Set(OPTIONAL_HOME_WIDGETS.map(w => w.id))
  const seen = new Set()
  const out = []
  for (const id of list || []) {
    if (!allowed.has(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function homeWidgetsOf(S) {
  if (!S || S.homeWidgets == null) return [...DEFAULT_HOME_WIDGETS]
  return normalizeHomeWidgets(S.homeWidgets)
}
