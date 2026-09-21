import React from 'react'
import ReactDOM from 'react-dom/client'
import UretimApp from './UretimApp'
import { temaBaslat, yaziBoyutuBaslat } from '../shared/gorunum'
import '../index.css'

temaBaslat()
yaziBoyutuBaslat()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <UretimApp />
  </React.StrictMode>
)
