import Icon from '../Icon.jsx'

/** Large tappable choice cards for onboarding. */
export default function ChoiceCards({ options, value, onChange, grid = false }) {
  return (
    <div className={grid ? 'ob-choice-grid' : 'ob-choices'}>
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          className={'ob-choice' + (value === o.id ? ' on' : '')}
          onClick={() => onChange(o.id)}
        >
          {o.icon && (
            <span className="ob-choice-icon" aria-hidden>
              {typeof o.icon === 'string' ? <Icon name={o.icon} /> : o.icon}
            </span>
          )}
          <span className="ob-choice-body">
            <div className="ob-choice-title">{o.label}</div>
            {o.sub && <div className="ob-choice-sub">{o.sub}</div>}
          </span>
        </button>
      ))}
    </div>
  )
}
