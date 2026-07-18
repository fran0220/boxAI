import { Navigate, useLocation, useParams } from 'react-router-dom'
import { WORKSPACE_PATHS } from '@/lib/workspace-navigation'

export const LEGACY_ROUTE_MAP = [
  { from: '/account', to: WORKSPACE_PATHS.home },
  { from: '/account/keys', to: WORKSPACE_PATHS.developerKeys },
  { from: '/account/usage', to: WORKSPACE_PATHS.developerUsage },
  { from: '/account/profile', to: WORKSPACE_PATHS.settingsProfile },
  { from: '/account/security', to: WORKSPACE_PATHS.settingsSecurity },
  { from: '/account/subscription', to: WORKSPACE_PATHS.billingSubscription },
  { from: '/account/orders', to: WORKSPACE_PATHS.billingOrders },
  { from: '/account/redeem', to: WORKSPACE_PATHS.billingRedeem },
  { from: '/account/affiliate', to: WORKSPACE_PATHS.billingAffiliate },
  { from: '/account/channels', to: WORKSPACE_PATHS.developerModels },
  { from: '/account/monitor', to: WORKSPACE_PATHS.developerMonitor },
  { from: '/account/batch-image', to: WORKSPACE_PATHS.createBatch },
  { from: '/account/announcements', to: WORKSPACE_PATHS.settingsAnnouncements },
  { from: '/create', to: WORKSPACE_PATHS.createImage },
  { from: '/create/image', to: WORKSPACE_PATHS.createImage },
  { from: '/create/video', to: WORKSPACE_PATHS.createVideo },
  { from: '/create/assets', to: WORKSPACE_PATHS.createAssets },
] as const

export function appendLocationParts(target: string, search: string, hash: string): string {
  return `${target}${search || ''}${hash || ''}`
}

export function LegacyRouteRedirect({ target }: { target: string }) {
  const { search, hash } = useLocation()
  return <Navigate to={appendLocationParts(target, search, hash)} replace />
}

export function LegacyCustomPageRedirect() {
  const { slug = '' } = useParams<{ slug: string }>()
  const { search, hash } = useLocation()
  const target = `${WORKSPACE_PATHS.customPage}/${encodeURIComponent(slug)}`
  return <Navigate to={appendLocationParts(target, search, hash)} replace />
}
