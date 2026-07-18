import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthLayout, PublicLayout } from '@/components/Layout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Spinner } from '@/components/ui/Spinner'
import {
  LEGACY_ROUTE_MAP,
  LegacyCustomPageRedirect,
  LegacyRouteRedirect,
} from '@/components/LegacyRouteRedirect'
import { WorkspaceProvider } from '@/components/workspace/WorkspaceContext'
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout'
import { NotFound } from '@/pages/NotFound'

const Home = lazy(() => import('@/pages/Home').then((m) => ({ default: m.Home })))
const Studio = lazy(() => import('@/pages/Studio').then((m) => ({ default: m.Studio })))
const Pricing = lazy(() => import('@/pages/Pricing').then((m) => ({ default: m.Pricing })))
const Status = lazy(() => import('@/pages/Status').then((m) => ({ default: m.Status })))
const Checkout = lazy(() => import('@/pages/Checkout').then((m) => ({ default: m.Checkout })))
const PaymentResult = lazy(() =>
  import('@/pages/PaymentResult').then((m) => ({ default: m.PaymentResult })),
)
const DesktopAuth = lazy(() =>
  import('@/pages/DesktopAuth').then((m) => ({ default: m.DesktopAuth })),
)

const AccountOverview = lazy(() =>
  import('@/pages/account/Overview').then((m) => ({ default: m.AccountOverview })),
)
const AccountKeys = lazy(() =>
  import('@/pages/account/Keys').then((m) => ({ default: m.AccountKeys })),
)
const AccountUsage = lazy(() =>
  import('@/pages/account/Usage').then((m) => ({ default: m.AccountUsage })),
)
const AccountProfile = lazy(() =>
  import('@/pages/account/Profile').then((m) => ({ default: m.AccountProfile })),
)
const AccountSecurity = lazy(() =>
  import('@/pages/account/Security').then((m) => ({ default: m.AccountSecurity })),
)
const AccountSubscription = lazy(() =>
  import('@/pages/account/Subscription').then((m) => ({ default: m.AccountSubscription })),
)
const AccountOrders = lazy(() =>
  import('@/pages/account/Orders').then((m) => ({ default: m.AccountOrders })),
)
const AccountRedeem = lazy(() =>
  import('@/pages/account/Redeem').then((m) => ({ default: m.AccountRedeem })),
)
const AccountAffiliate = lazy(() =>
  import('@/pages/account/Affiliate').then((m) => ({ default: m.AccountAffiliate })),
)
const AccountChannels = lazy(() =>
  import('@/pages/account/Channels').then((m) => ({ default: m.AccountChannels })),
)
const AccountMonitor = lazy(() =>
  import('@/pages/account/Monitor').then((m) => ({ default: m.AccountMonitor })),
)
const AccountBatchImage = lazy(() =>
  import('@/pages/account/BatchImage').then((m) => ({ default: m.AccountBatchImage })),
)
const AccountAnnouncements = lazy(() =>
  import('@/pages/account/Announcements').then((m) => ({ default: m.AccountAnnouncements })),
)
const AccountCustomPage = lazy(() =>
  import('@/pages/account/CustomPage').then((m) => ({ default: m.AccountCustomPage })),
)

const Login = lazy(() => import('@/pages/auth/Login').then((m) => ({ default: m.Login })))
const Signup = lazy(() => import('@/pages/auth/Signup').then((m) => ({ default: m.Signup })))
const ForgotPassword = lazy(() =>
  import('@/pages/auth/ForgotPassword').then((m) => ({ default: m.ForgotPassword })),
)
const ResetPassword = lazy(() =>
  import('@/pages/auth/ResetPassword').then((m) => ({ default: m.ResetPassword })),
)
const OAuthCallback = lazy(() =>
  import('@/pages/auth/OAuthCallback').then((m) => ({ default: m.OAuthCallback })),
)
const AgentWorkspace = lazy(() =>
  import('@/pages/app/Agent').then((m) => ({ default: m.AgentWorkspace })),
)

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
    <Suspense fallback={<CreateFallback />}>
      <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="studio" element={<Studio />} />
        <Route path="desktop" element={<Navigate to="/studio" replace />} />
        <Route path="download" element={<Navigate to="/studio" replace />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="status" element={<Status />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="payment/result" element={<PaymentResult />} />
        <Route path="desktop-auth" element={<DesktopAuth />} />
      </Route>

      {/* Customer auth on apex; console.you-box.com remains admin-only. */}
      <Route element={<AuthLayout />}>
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="auth/oauth/callback" element={<OAuthCallback />} />
        <Route path="auth/linuxdo/callback" element={<OAuthCallback />} />
        <Route path="auth/wechat/callback" element={<OAuthCallback />} />
        <Route path="auth/oidc/callback" element={<OAuthCallback />} />
        <Route path="auth/dingtalk/callback" element={<OAuthCallback />} />
      </Route>

      <Route path="sso" element={<LegacyRouteRedirect target="/login" />} />
      <Route path="sso/callback" element={<LegacyRouteRedirect target="/login" />} />
      <Route path="sso/authorize" element={<LegacyRouteRedirect target="/login" />} />

      <Route
        path="app"
        element={
          <ProtectedRoute>
            <WorkspaceProvider>
              <WorkspaceLayout />
            </WorkspaceProvider>
          </ProtectedRoute>
        }
      >
        <Route index element={<AccountOverview />} />

        <Route
          path="create"
          element={
            <Suspense fallback={<CreateFallback />}>
              <CreateLayout />
            </Suspense>
          }
        >
          <Route index element={<Navigate to="image" replace />} />
          <Route path="image" element={<ImageGen />} />
          <Route path="video" element={<VideoGen />} />
          <Route path="assets" element={<Assets />} />
          <Route path="batch" element={<AccountBatchImage />} />
        </Route>

        <Route path="agent" element={<AgentWorkspace />} />

        <Route path="developer" element={<Navigate to="keys" replace />} />
        <Route path="developer/keys" element={<AccountKeys />} />
        <Route path="developer/usage" element={<AccountUsage />} />
        <Route path="developer/models" element={<AccountChannels />} />
        <Route path="developer/monitor" element={<AccountMonitor />} />

        <Route path="billing" element={<Navigate to="subscription" replace />} />
        <Route path="billing/subscription" element={<AccountSubscription />} />
        <Route path="billing/orders" element={<AccountOrders />} />
        <Route path="billing/redeem" element={<AccountRedeem />} />
        <Route path="billing/affiliate" element={<AccountAffiliate />} />

        <Route path="settings" element={<Navigate to="profile" replace />} />
        <Route path="settings/profile" element={<AccountProfile />} />
        <Route path="settings/security" element={<AccountSecurity />} />
        <Route path="settings/notifications" element={<AccountProfile notificationsOnly />} />
        <Route path="settings/announcements" element={<AccountAnnouncements />} />
        <Route path="pages/:slug" element={<AccountCustomPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {LEGACY_ROUTE_MAP.map((route) => (
        <Route
          key={route.from}
          path={route.from}
          element={<LegacyRouteRedirect target={route.to} />}
        />
      ))}
      <Route path="account/pages/:slug" element={<LegacyCustomPageRedirect />} />
      {/* Root catch-all: after /app + legacy so it cannot steal workspace routes. */}
      <Route element={<PublicLayout />}>
        <Route path="*" element={<NotFound />} />
      </Route>
      </Routes>
    </Suspense>
  )
}
