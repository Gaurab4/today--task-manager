export type Theme = 'light' | 'dark'

const KEY = 'zen-theme'

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light'
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* ignore */
  }
}

export function readThemeFromDom(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}
