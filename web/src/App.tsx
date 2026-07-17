import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Spinner } from '@/components/ui/Spinner'
import { Home } from '@/pages/Home'
import { Studio } from '@/pages/Studio'
import { Pricing } from '@/pages/Pricing'
import { Status } from '@/pages/Status'
import { NotFound } from '@/pages/NotFound'
import { SsoStart } from '@/pages/SsoStart'
import { SsoCallback } from '@/pages/SsoCallback'
import { SsoAuthorize } from '@/pages/SsoAuthorize'
import { AccountLayout } from '@/pages/account/AccountLayout'
import { AccountOverview } from '@/pages/account/Overview'
import { AccountKeys } from '@/pages/account/Keys'
import { AccountUsage } from '@/pages/account/Usage'
import { AccountProfile } from '@/pages/account/Profile'
import { AccountSecurity } from '@/pages/account/Security'
import { AccountSubscription } from '@/pages/account/Subscription'
import { AccountOrders } from '@/pages/account/Orders'
import { AccountRedeem } from '@/pages/account/Redeem'
import { AccountAffiliate } from '@/pages/account/Affiliate'
import { AccountChannels } from '@/pages/account/Channels'
import { AccountMonitor } from '@/pages/account/Monitor'
import { AccountBatchImage } from '@/pages/account/BatchImage'
import { AccountAnnouncements } from '@/pages/account/Announcements'
import { AccountCustomPage } from '@/pages/account/CustomPage'
import { Login } from '@/pages/auth/Login'
import { Signup } from '@/pages/auth/Signup'
import { ForgotPassword } from '@/pages/auth/ForgotPassword'
import { ResetPassword } from '@/pages/auth/ResetPassword'
import { Checkout } from '@/pages/Checkout'
import { PaymentResult } from '@/pages/PaymentResult'
import { DesktopAuth } from '@/pages/DesktopAuth'

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

function AccountFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
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
        <Route path="desktop" element={<Navigate to="/studio" replace />} />
        <Route path="download" element={<Navigate to="/studio" replace />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="status" element={<Status />} />

        {/* Customer auth on apex (console remains admin + SSO rollback bridge). */}
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />

        {/* Legacy Web SSO pages — kept until Phase 10 delete */}
        <Route path="sso" element={<SsoStart />} />
        <Route path="sso/callback" element={<SsoCallback />} />
        <Route path="sso/authorize" element={<SsoAuthorize />} />

        <Route path="checkout" element={<Checkout />} />
        <Route path="payment/result" element={<PaymentResult />} />
        <Route path="desktop-auth" element={<DesktopAuth />} />

        <Route
          path="account"
          element={
            <ProtectedRoute>
              <Suspense fallback={<AccountFallback />}>
                <AccountLayout />
              </Suspense>
            </ProtectedRoute>
          }
        >
          <Route index element={<AccountOverview />} />
          <Route path="keys" element={<AccountKeys />} />
          <Route path="usage" element={<AccountUsage />} />
          <Route path="profile" element={<AccountProfile />} />
          <Route path="security" element={<AccountSecurity />} />
          <Route path="subscription" element={<AccountSubscription />} />
          <Route path="orders" element={<AccountOrders />} />
          <Route path="redeem" element={<AccountRedeem />} />
          <Route path="affiliate" element={<AccountAffiliate />} />
          <Route path="channels" element={<AccountChannels />} />
          <Route path="monitor" element={<AccountMonitor />} />
          <Route path="batch-image" element={<AccountBatchImage />} />
          <Route path="announcements" element={<AccountAnnouncements />} />
          <Route path="pages/:slug" element={<AccountCustomPage />} />
        </Route>

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
