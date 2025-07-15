import React from 'react'
import { BrowserRouter as Router } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import AppRouter from './router/AppRouter'
import { NotificationProvider } from './contexts/NotificationContext'

const App: React.FC = () => {
  return (
    <Router>
      <NotificationProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </NotificationProvider>
    </Router>
  )
}

export default App
