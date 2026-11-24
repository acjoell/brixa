import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// @@INSERT:imports@@
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App
      projectName={document.title}
      initialThemePreference={document.documentElement.dataset.themePreference}
    />
  </StrictMode>,
)
