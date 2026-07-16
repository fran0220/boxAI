import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Home } from '@/pages/Home'
import { Studio } from '@/pages/Studio'
import { Download } from '@/pages/Download'
import { Pricing } from '@/pages/Pricing'
import { Login } from '@/pages/Login'
import { Signup } from '@/pages/Signup'
import { SsoStart } from '@/pages/SsoStart'
import { SsoCallback } from '@/pages/SsoCallback'
import { SsoAuthorize } from '@/pages/SsoAuthorize'
import { Account } from '@/pages/Account'
import { CreateLayout } from '@/pages/create/CreateLayout'
import { Chat } from '@/pages/create/Chat'
import { ImageGen } from '@/pages/create/Image'
import { VideoGen } from '@/pages/create/Video'
import { Assets } from '@/pages/create/Assets'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="studio" element={<Studio />} />
        <Route path="download" element={<Download />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="sso" element={<SsoStart />} />
        <Route path="sso/callback" element={<SsoCallback />} />
        <Route path="sso/authorize" element={<SsoAuthorize />} />
        <Route
          path="account"
          element={
            <ProtectedRoute>
              <Account />
            </ProtectedRoute>
          }
        />
        <Route
          path="create"
          element={
            <ProtectedRoute>
              <CreateLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="chat" replace />} />
          <Route path="chat" element={<Chat />} />
          <Route path="image" element={<ImageGen />} />
          <Route path="video" element={<VideoGen />} />
          <Route path="assets" element={<Assets />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
