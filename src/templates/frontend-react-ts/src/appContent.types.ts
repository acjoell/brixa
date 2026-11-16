import type { ReactNode } from 'react'

export type MessageKey =
  | 'home.title'
  | 'home.edit'
  | 'home.counter'
  | 'docs.title'
  | 'docs.subtitle'
  | 'docs.exploreVite'
  | 'docs.learnMore'
  | 'social.title'
  | 'social.subtitle'

export interface AppContent {
  LanguageSelector: () => ReactNode
  t: (key: MessageKey, params?: { val?: number }) => string
  EditInstruction: () => ReactNode
}
