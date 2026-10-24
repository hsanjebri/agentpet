import './assets/main.css'

import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// eslint-disable-next-line react-refresh/only-export-components -- entry file, never hot-swapped
const Gallery = lazy(() => import('./Gallery'))
const showGallery = import.meta.env.DEV && location.hash.startsWith('#gallery')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {showGallery ? (
      <Suspense>
        <Gallery />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>
)
