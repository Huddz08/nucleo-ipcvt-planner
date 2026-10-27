import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import './refinements.css'
import './workspace.css'
import './tablet-layout.css'
import './stacked-layout.css'
import './fitted-layout.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
