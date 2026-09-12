import { useEffect, useState } from 'react'
import { t } from '../lib/i18n.js'
import { MOBILE } from '../lib/mobile.js'
import { useUI } from '../store/useUI.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

const DISMISS_KEY = 'opengym_install_dismissed'

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function InstallHowTo({ close }) {
  const ios = isIos()
  return (
    <>
      <h3>{t('Install Open Gym')}</h3>
      <div className="muted small" style={{ marginBottom: 16, lineHeight: 1.45 }}>
        {ios
          ? t('Add it to your Home Screen for a full-screen app experience. Works offline for your logged workouts.')
          : t('Install this site as an app for quick access and a full-screen workout UI.')}
      </div>
      {ios ? (
        <ol className="steps-list" style={{ listStyle: 'decimal', paddingLeft: 20, marginBottom: 16 }}>
          <li>{t('Tap the Share button in Safari')}</li>
          <li>{t('Scroll and tap “Add to Home Screen”')}</li>
          <li>{t('Confirm “Add” — Open Gym appears like an app')}</li>
        </ol>
      ) : (
        <ol className="steps-list" style={{ listStyle: 'decimal', paddingLeft: 20, marginBottom: 16 }}>
          <li>{t('Open the browser menu (⋮ or ⋯)')}</li>
          <li>{t('Tap “Install app” or “Add to Home screen”')}</li>
          <li>{t('Confirm — Open Gym opens full screen next time')}</li>
        </ol>
      )}
      <Button variant="primary" onClick={close}>{t('Got it')}</Button>
    </>
  )
}

export function openInstallSheet() {
  useUI.getState().openSheet(close => <InstallHowTo close={close} />)
}

/** Settings row + optional home banner for installing the PWA. */
export function InstallSettingsRow() {
  if (MOBILE || isStandalone()) {
    return (
      <div className="lrow">
        <span className="lrow-i" style={{ background: 'var(--acc-soft)', color: 'var(--acc)' }}><Icon name="checkCircle" /></span>
        <span className="lrow-m">
          <span className="lrow-t">{t('Installed on this device')}</span>
          <span className="lrow-s">{t('Open Gym is running as an app')}</span>
        </span>
      </div>
    )
  }
  return (
    <button className="lrow tap" onClick={openInstallSheet} style={{ width: '100%', textAlign: 'left' }}>
      <span className="lrow-i" style={{ background: 'var(--acc-soft)', color: 'var(--acc)' }}><Icon name="rocket" /></span>
      <span className="lrow-m">
        <span className="lrow-t">{t('Install as app')}</span>
        <span className="lrow-s">{isIos()
          ? t('Safari → Share → Add to Home Screen')
          : t('Add Open Gym to your home screen')}</span>
      </span>
      <Icon name="chevronRight" className="lrow-c" />
    </button>
  )
}

export function InstallBanner() {
  const [deferred, setDeferred] = useState(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (MOBILE || isStandalone()) return
    if (localStorage.getItem(DISMISS_KEY)) return

    const onBip = e => {
      e.preventDefault()
      setDeferred(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', onBip)

    // iOS never fires beforeinstallprompt — still offer a soft tip.
    if (isIos()) setShow(true)

    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [])

  if (!show || MOBILE || isStandalone()) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setShow(false)
  }

  const install = async () => {
    if (deferred) {
      deferred.prompt()
      try { await deferred.userChoice } catch { /* dismissed */ }
      setDeferred(null)
      dismiss()
      return
    }
    openInstallSheet()
  }

  return (
    <div className="install-banner">
      <div className="install-banner-body">
        <div className="t-cap" style={{ color: 'var(--acc)', marginBottom: 4 }}>{t('Home screen')}</div>
        <div className="t-head">{t('Install Open Gym')}</div>
        <div className="small muted" style={{ marginTop: 4 }}>
          {isIos()
            ? t('Add to Home Screen for one-tap workouts.')
            : t('Install for a full-screen training app.')}
        </div>
      </div>
      <div className="install-banner-actions">
        <Button size="sm" variant="primary" onClick={install}>{t('Install')}</Button>
        <Button size="sm" variant="ghost" onClick={dismiss}>{t('Not now')}</Button>
      </div>
    </div>
  )
}
