export function useAppContent() {
  return {
    LanguageSelector: () => null,
    t: (key, params) => {
      switch (key) {
        case 'home.title':
          return 'Get started'
        case 'home.counter':
          return `Count is ${params?.val ?? 0}`
        case 'docs.title':
          return 'Documentation'
        case 'docs.subtitle':
          return 'Your questions, answered'
        case 'docs.exploreVite':
          return 'Explore Vite'
        case 'docs.learnMore':
          return 'Learn more'
        case 'social.title':
          return 'Connect with us'
        case 'social.subtitle':
          return 'Join the Vite community'
        default:
          return key
      }
    },
    EditInstruction: () => (
      <>
        Edit <code>src/App.jsx</code> and save to test <code>HMR</code>
      </>
    ),
  }
}
