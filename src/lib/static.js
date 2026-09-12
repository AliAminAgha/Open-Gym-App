// Static web / PWA deploy (VITE_STATIC=1) — no Node backend.
// Passkeys and cloud sync need the self-hosted API; this mode keeps everything on-device.
export const STATIC = import.meta.env.VITE_STATIC === '1'
