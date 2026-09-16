import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { streakWeeks } from '../lib/history.js'
import { t } from '../lib/i18n.js'
import { homeWidgetsSheet } from '../sheets.jsx'
import { homeWidgetsOf } from '../lib/home-widgets.js'
import Icon from '../components/Icon.jsx'
import { InstallBanner } from '../components/InstallApp.jsx'
import {
  HomeWeekWidget,
  HomeTodayWidget,
  HomeNutritionWidget,
  renderOptionalWidget
} from '../components/home/HomeWidgets.jsx'

export default function Home() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const streak = streakWeeks(S)
  const extras = homeWidgetsOf(S)

  return (
    <div className="narrow home-dash">
      <header className="home-top">
        <span className="brand">openGym</span>
        <div className="home-top-actions">
          {streak > 0 && (
            <span className="status-pill">
              <Icon name="bolt" />{streak}
            </span>
          )}
          <button className="iconbtn" onClick={homeWidgetsSheet} aria-label={t('Home widgets')}>
            <Icon name="plus" />
          </button>
          <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}>
            <Icon name="gear" />
          </button>
        </div>
      </header>

      <InstallBanner />

      <div className="hw-stack">
        <HomeWeekWidget />
        <HomeTodayWidget />
        <HomeNutritionWidget />
        {extras.map(id => renderOptionalWidget(id))}
      </div>

      <button type="button" className="hw-add" onClick={homeWidgetsSheet}>
        <Icon name="plus" />
        {t('Add widget')}
      </button>
    </div>
  )
}
