import React from 'react'
import ReactDOM from 'react-dom/client'
import PortalApp from './PortalApp'
import { temaBaslat, yaziBoyutuBaslat } from '../shared/gorunum'
import '../index.css'

temaBaslat()
yaziBoyutuBaslat()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PortalApp />
  </React.StrictMode>
)
