// Local partner cache + link encoding (Phase 1 manual share).
import { buildPartnerSummary, parsePartnerSummary, partnerSummaryId } from './partner-summary.js'

const KEY = 'gym_partner_v1'

export function loadPartnerCache() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) { /* ignore */ }
  return null
}

export function savePartnerCache(data) {
  if (data) localStorage.setItem(KEY, JSON.stringify(data))
  else localStorage.removeItem(KEY)
}

export function partnerFromSummary(summary) {
  const ts = Date.parse(summary.exported) || Date.now()
  return {
    id: partnerSummaryId(summary),
    name: summary.name || '',
    linkedAt: Date.now(),
    summary,
    summaryTs: ts
  }
}

export function importPartnerSummary(summary) {
  const parsed = parsePartnerSummary(summary)
  const partner = partnerFromSummary(parsed)
  savePartnerCache(partner)
  return partner
}

const b64uEncode = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const b64uDecode = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))

/** Encode summary as a shareable deeplink fragment query value. */
export function encodePartnerLink(summary) {
  return b64uEncode(JSON.stringify(summary))
}

export function decodePartnerLink(encoded) {
  if (!encoded) throw new Error('empty')
  return parsePartnerSummary(b64uDecode(encoded))
}

export function partnerShareUrl(summary) {
  const d = encodePartnerLink(summary)
  const base = window.location.origin + window.location.pathname
  return base + '#/partner?d=' + encodeURIComponent(d)
}

export function buildMySummary(S, name) {
  return buildPartnerSummary(S, name)
}

/** Seed a demo partner when the cache is empty (demo build / design preview). */
export async function seedDemoPartnerIfEmpty(setPartner) {
  const existing = loadPartnerCache()
  if (existing && existing.name !== 'Sam' && existing.summary?.accent) return existing
  const { buildDemoPartnerSummary } = await import('./demoSeed.js')
  const partner = partnerFromSummary(buildDemoPartnerSummary())
  savePartnerCache(partner)
  if (setPartner) setPartner(partner)
  return partner
}
