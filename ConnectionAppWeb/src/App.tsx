import { BrowserRouter, Route, Routes } from 'react-router'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'
import ChatAppPage from './pages/ChatAppPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import GroupInvitePage from './pages/GroupInvitePage'
import ManualUnlockPage from './pages/ManualUnlockPage'
import { Toaster } from 'sonner'
import { ProtectedRoute, PublicRoute, AdminRoute } from './components/auth-route'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminReportsPage from './pages/admin/AdminReportsPage'
import AdminConversationsPage from './pages/admin/AdminConversationsPage'

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

          {/* admin routes */}
          <Route path='/admin' element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<AdminDashboardPage />} />
            <Route path='users' element={<AdminUsersPage />} />
            <Route path='reports' element={<AdminReportsPage />} />
            <Route path='conversations' element={<AdminConversationsPage />} />
          </Route>

          {/* private routes go here */}
          <Route path='/' element={<ProtectedRoute><ChatAppPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
