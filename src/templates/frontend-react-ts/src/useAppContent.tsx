import type { AppContent, MessageKey } from './appContent.types'

const messages: Record<MessageKey, string> = {
  'nav.label': 'Project resources',
  'nav.docs': 'Docs',
  'home.title': 'Build from a solid foundation.',
  'home.subtitle':
    'Your Brixa project is ready. Open the starter, make it yours, and build your first feature.',
  'home.start': 'Start developing',
  'launchpad.title': 'Development quickstart',
  'launchpad.stack': 'Base stack',
  'launchpad.entry': 'Starter view',
  'launchpad.next': 'Production build',
  'launchpad.build': 'Bundle your project for deployment.',
  'footer.tagline': 'Scaffolded with Brixa.',
  'theme.label': 'Appearance',
  'theme.system': 'System',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
}

export function useAppContent(): AppContent {
  return {
    LanguageSelector: () => null,
    t: (key) => messages[key],
    EditInstruction: () => (
      <>
        Edit <code>src/App.tsx</code> and save to test <code>HMR</code>.
      </>
    ),
  }
}
