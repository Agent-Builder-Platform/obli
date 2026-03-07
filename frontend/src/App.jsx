import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'

import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import DashboardPage from './pages/DashboardPage'
import ManageAgentsPage from './pages/ManageAgentsPage'
import CreateAgentPage from './pages/CreateAgentPage'
import ChatPage from './pages/ChatPage'
import SystemPromptsPage from './pages/SystemPromptsPage'

function PrivateRoute({ session, children }) {
  if (!session) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ session, children }) {
  if (session) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Loading state
  if (session === undefined) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <span className="loading loading-spinner loading-md text-base-content opacity-30" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route
          path="/login"
          element={
            <PublicRoute session={session}>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute session={session}>
              <SignupPage />
            </PublicRoute>
          }
        />

        {/* Private */}
        <Route
          path="/"
          element={
            <PrivateRoute session={session}>
              <DashboardPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/agents"
          element={
            <PrivateRoute session={session}>
              <ManageAgentsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/agents/new"
          element={
            <PrivateRoute session={session}>
              <CreateAgentPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/agents/:agentId/chat"
          element={
            <PrivateRoute session={session}>
              <ChatPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/prompts"
          element={
            <PrivateRoute session={session}>
              <SystemPromptsPage />
            </PrivateRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}