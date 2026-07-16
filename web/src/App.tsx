import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Spinner } from '@/components/ui/Spinner'
import { Home } from '@/pages/Home'
import { Studio } from '@/pages/Studio'
import { Pricing } from '@/pages/Pricing'
import { Account } from '@/pages/Account'
import { NotFound } from '@/pages/NotFound'
import { AuthRedirect } from '@/pages/auth/AuthRedirect'
import { SsoStart } from '@/pages/SsoStart'
import { SsoCallback } from '@/pages/SsoCallback'
import { SsoAuthorize } from '@/pages/SsoAuthorize'

const CreateLayout = lazy(() =>
  import('@/pages/create/CreateLayout').then((m) => ({ default: m.CreateLayout })),
)
const ImageGen = lazy(() => import('@/pages/create/Image').then((m) => ({ default: m.ImageGen })))
const VideoGen = lazy(() => import('@/pages/create/Video').then((m) => ({ default: m.VideoGen })))
const Assets = lazy(() => import('@/pages/create/Assets').then((m) => ({ default: m.Assets })))

function CreateFallback() {
  return (
    <div className="flex min-h-[50vh] flex-1 items-center justify-center">
      <Spinner />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="studio" element={<Studio />} />
        {/* Legacy URLs: Desktop + Download merged into /studio */}
        <Route path="desktop" element={<Navigate to="/studio" replace />} />
        <Route path="download" element={<Navigate to="/studio" replace />} />
        <Route path="pricing" element={<Pricing />} />
        {/* No credential forms here — console (Vue) is the identity host */}
        <Route path="login" element={<AuthRedirect mode="login" />} />
        <Route path="signup" element={<AuthRedirect mode="register" />} />
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
        {/* Creator: same site chrome as home; internal panels for image/video/assets */}
        <Route
          path="create"
          element={
            <ProtectedRoute>
              <Suspense fallback={<CreateFallback />}>
                <CreateLayout />
              </Suspense>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="image" replace />} />
          <Route path="image" element={<ImageGen />} />
          <Route path="video" element={<VideoGen />} />
          <Route path="assets" element={<Assets />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
