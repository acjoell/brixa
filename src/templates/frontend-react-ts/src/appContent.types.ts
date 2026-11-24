import type { ReactNode } from 'react'

export type MessageKey =
  | 'nav.label'
  | 'nav.docs'
  | 'home.title'
  | 'home.subtitle'
  | 'home.start'
  | 'launchpad.title'
  | 'launchpad.stack'
  | 'launchpad.entry'
  | 'launchpad.next'
  | 'launchpad.build'
  | 'footer.tagline'
  | 'theme.label'
  | 'theme.system'
  | 'theme.light'
  | 'theme.dark'

export interface AppContent {
  LanguageSelector: () => ReactNode
  t: (key: MessageKey) => string
  EditInstruction: () => ReactNode
}
