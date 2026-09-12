// Personalized training profile (rule-based coach). Independent of the AI Coach namespace.
// Persisted on S.profile via the normal store; null until the user starts setup.

export const GOALS = [
  { id: 'fatloss', label: 'Lose weight / body fat', needsTarget: true },
  { id: 'muscle', label: 'Build muscle / gain weight', needsTarget: true },
  { id: 'recomp', label: 'Build muscle while losing fat', needsTarget: false },
  { id: 'strength', label: 'Get stronger', needsTarget: false },
  { id: 'maintain', label: 'Maintain weight', needsTarget: false },
  { id: 'fitness', label: 'Improve general fitness', needsTarget: false }
]

export const EXPERIENCE = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' }
]

export const ACTIVITY = [
  { id: 'sedentary', label: 'Sedentary', factor: 1.2 },
  { id: 'light', label: 'Lightly active', factor: 1.375 },
  { id: 'moderate', label: 'Moderately active', factor: 1.55 },
  { id: 'very', label: 'Very active', factor: 1.725 }
]

export const STYLES = [
  { id: 'fullbody', label: 'Full Body' },
  { id: 'upperlower', label: 'Upper / Lower' },
  { id: 'ppl', label: 'Push / Pull / Legs' },
  { id: 'custom', label: 'Custom (auto-pick)' }
]

export const SESSION_OPTS = [30, 45, 60, 90]

/** Common equipment chips; empty selection means “use defaults for gym/home”. */
export const EQUIPMENT_CHIPS = [
  'barbell', 'dumbbell', 'cable', 'leverage machine', 'body weight',
  'smith machine', 'kettlebell', 'band', 'ez barbell', 'medicine ball'
]

export function emptyProfile() {
  return {
    completedAt: null,
    age: null,
    sex: null,           // 'male' | 'female'
    heightCm: null,
    experience: null,    // beginner | intermediate | advanced
    goal: null,
    targetW: null,
    daysPerWeek: 3,
    sessionMin: 45,
    preferredDays: [1, 3, 5],
    activity: 'moderate',
    location: 'gym',     // gym | home
    equipment: [],
    style: null,
    favorites: [],
    avoid: [],
    nutrition: { enabled: false, calorieTarget: null, proteinTarget: null, log: [] }
  }
}

export const profileOf = S => S?.profile || null
export const hasProfile = S => !!(S?.profile?.completedAt && S.profile.goal)

export function goalLabel(goal) {
  return (GOALS.find(g => g.id === goal) || {}).label || goal || ''
}

export function experienceLabel(xp) {
  return (EXPERIENCE.find(e => e.id === xp) || {}).label || xp || ''
}

/** Prefer profile target, else legacy S.targetW. */
export function goalWeight(S) {
  if (S?.profile?.targetW != null) return S.profile.targetW
  return S?.targetW ?? null
}

export function currentWeightKg(S) {
  const bw = S?.bodyweight
  if (!bw?.length) return null
  const last = bw[bw.length - 1]
  if (!last) return null
  const w = last.w
  if (S.unit === 'lb') return w * 0.453592
  return w
}

export function heightCmOf(profile) {
  const h = profile?.heightCm
  return h > 0 ? h : null
}
