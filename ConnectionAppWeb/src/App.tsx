import { BrowserRouter, Route, Routes } from 'react-router'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'
import ChatAppPage from './pages/ChatAppPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import GroupInvitePage from './pages/GroupInvitePage'
import { Toaster } from 'sonner'
function App() {

  return (
    <>
      <Toaster richColors />
      <BrowserRouter>
        <Routes>
          {/* public routes go here */}
          <Route path='/signin' element={<SignInPage />} />
          <Route path='/signup' element={<SignUpPage />} />
          <Route path='/forgot-password' element={<ForgotPasswordPage />} />
          <Route path='/groups/join/:inviteToken' element={<GroupInvitePage />} />

          {/* private routes go here */}
          <Route path='/' element={<ChatAppPage />} />
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
