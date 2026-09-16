import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { temaBaslat, yaziBoyutuBaslat } from './shared/gorunum'
import './index.css'

// React render'ından ÖNCE — yanlış tema/yazı boyutunun bir anlığına
// gözükmesini (flash of unstyled/wrong theme) önlemek için.
temaBaslat()
yaziBoyutuBaslat()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
