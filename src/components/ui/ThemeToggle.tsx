import { useTheme } from '@/state/theme'
import { Icon } from './Icon'
import { cx } from './primitives'

interface ThemeToggleProps {
  variant?: 'icon' | 'segmented' | 'pill'
  className?: string
}

export function ThemeToggle({ variant = 'icon', className }: ThemeToggleProps) {
  const { theme, toggleTheme, setTheme } = useTheme()
  const isDark = theme === 'dark'

  if (variant === 'segmented') {
    return (
      <div
        className={cx(
          'inline-flex items-center gap-1 rounded-lg border border-line/70 bg-sunken/60 p-1 text-body-xs',
          className,
        )}
        role="group"
        aria-label="Theme selection"
      >
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={cx(
            'flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-medium transition-all duration-150',
            isDark
              ? 'border-line/60 bg-panel text-ink shadow-xs'
              : 'border-transparent text-ink-faint hover:text-ink hover:bg-raised/50',
          )}
          aria-pressed={isDark}
        >
          <Icon name="moon" size={14} filled={isDark} />
          <span>Dark</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={cx(
            'flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-medium transition-all duration-150',
            !isDark
              ? 'border-line/60 bg-panel text-ink shadow-xs'
              : 'border-transparent text-ink-faint hover:text-ink hover:bg-raised/50',
          )}
          aria-pressed={!isDark}
        >
          <Icon name="sun" size={14} filled={!isDark} />
          <span>Light</span>
        </button>
      </div>
    )
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={cx(
          'flex items-center gap-2 rounded-lg border border-line/70 bg-sunken/60 px-3 py-1.5 text-body-xs font-medium text-ink transition-all hover:border-line hover:bg-raised/70',
          className,
        )}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <Icon name={isDark ? 'sun' : 'moon'} size={15} className="text-amber" />
        <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
      </button>
    )
  }

  // Icon button (default)
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cx(
        'flex h-9.5 w-9.5 items-center justify-center rounded-lg border border-line/70 bg-sunken/60 text-ink-dim transition-all duration-150 hover:border-line hover:bg-raised/70 hover:text-ink active:scale-95',
        className,
      )}
    >
      <Icon
        name={isDark ? 'sun' : 'moon'}
        size={18}
        className={isDark ? 'text-amber' : 'text-primary'}
      />
    </button>
  )
}
