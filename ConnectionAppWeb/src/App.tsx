import { BrowserRouter, Route, Routes } from 'react-router'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'
import ChatAppPage from './pages/ChatAppPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import GroupInvitePage from './pages/GroupInvitePage'
import ManualUnlockPage from './pages/ManualUnlockPage'
import { Toaster } from 'sonner'
import { ProtectedRoute, PublicRoute } from './components/auth-route'

function App() {

  return (
    <>
      <Toaster richColors />
      <BrowserRouter>
        <Routes>
          {/* public routes go here */}
          <Route path='/signin' element={<PublicRoute><SignInPage /></PublicRoute>} />
          <Route path='/signup' element={<PublicRoute><SignUpPage /></PublicRoute>} />
          <Route path='/forgot-password' element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
          <Route path='/unlock-account' element={<PublicRoute><ManualUnlockPage /></PublicRoute>} />
          <Route path='/groups/join/:inviteToken' element={<GroupInvitePage />} />

          {/* private routes go here */}
          <Route path='/' element={<ProtectedRoute><ChatAppPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
