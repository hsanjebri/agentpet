import './assets/main.css'

import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// eslint-disable-next-line react-refresh/only-export-components -- entry file, never hot-swapped
const Gallery = lazy(() => import('./Gallery'))
// eslint-disable-next-line react-refresh/only-export-components -- entry file, never hot-swapped
const Showcase = lazy(() => import('./Showcase'))
const devPage = import.meta.env.DEV ? location.hash : ''

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {devPage.startsWith('#gallery') || devPage.startsWith('#showcase') ? (
      <Suspense>{devPage.startsWith('#gallery') ? <Gallery /> : <Showcase />}</Suspense>
    ) : (
      <App />
    )}
  </StrictMode>
)
