import './assets/main.css'

import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// eslint-disable-next-line react-refresh/only-export-components -- entry file, never hot-swapped
const Gallery = lazy(() => import('./Gallery'))
// eslint-disable-next-line react-refresh/only-export-components -- entry file, never hot-swapped
const Showcase = lazy(() => import('./Showcase'))
// eslint-disable-next-line react-refresh/only-export-components -- entry file, never hot-swapped
const Welcome = lazy(() => import('./Welcome'))
// eslint-disable-next-line react-refresh/only-export-components -- entry file, never hot-swapped
const Connect = lazy(() => import('./Connect'))
// eslint-disable-next-line react-refresh/only-export-components -- entry file, never hot-swapped
const Profile = lazy(() => import('./Profile'))
// eslint-disable-next-line react-refresh/only-export-components -- entry file, never hot-swapped
const Phone = lazy(() => import('./Phone'))
const devPage = import.meta.env.DEV ? location.hash : ''

function page(): React.JSX.Element {
  if (location.hash === '#welcome') return <Welcome />
  if (location.hash === '#connect') return <Connect />
  if (location.hash === '#profile') return <Profile />
  if (location.hash === '#phone') return <Phone />
  if (devPage.startsWith('#gallery')) return <Gallery />
  if (devPage.startsWith('#showcase')) return <Showcase />
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense>{page()}</Suspense>
  </StrictMode>
)
