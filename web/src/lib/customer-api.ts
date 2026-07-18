/**
 * Customer-center API client for the apex React shell.
 * Thin wrappers over existing Go JSON endpoints (same contract as Vue frontend/src/api/*).
 */

import { apiDelete, apiGet, apiPost, apiPut, withQuery, type AuthResponse } from './api'
import { setSession } from './session'

// —— Shared shapes ——

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface ApiKeyGroup {
  id: number
  name: string
  platform?: string
  rate_multiplier?: number
  subscription_type?: string
}

export interface ApiKey {
  id: number
  user_id: number
  key: string
  name: string
  group_id: number | null
  status: 'active' | 'inactive' | 'quota_exhausted' | 'expired'
  ip_whitelist: string[]
  ip_blacklist: string[]
  last_used_at: string | null
  last_used_ip?: string | null
  quota: number
  quota_used: number
  expires_at: string | null
  created_at: string
  updated_at?: string
  current_concurrency?: number
  group?: ApiKeyGroup
  rate_limit_5h?: number
  rate_limit_1d?: number
  rate_limit_7d?: number
  usage_5h?: number
  usage_1d?: number
  usage_7d?: number
  reset_5h_at?: string | null
  reset_1d_at?: string | null
  reset_7d_at?: string | null
}

export type AuthProvider = 'email' | 'linuxdo' | 'oidc' | 'wechat' | 'github' | 'google' | 'dingtalk'

export interface NotifyEmailEntry {
  email: string
  disabled: boolean
  verified: boolean
}

export interface UserAuthBindingStatus {
  bound?: boolean
  bound_count?: number
  provider?: AuthProvider | string
  label?: string | null
  provider_label?: string | null
  display_name?: string | null
  can_bind?: boolean
  can_unbind?: boolean
  note?: string | null
}

export interface UserProfile {
  id: number
  username: string
  email: string
  role: string
  balance: number
  frozen_balance?: number
  concurrency: number
  status: string
  totp_enabled?: boolean
  created_at?: string
  avatar_url?: string | null
  email_bound?: boolean
  linuxdo_bound?: boolean
  oidc_bound?: boolean
  wechat_bound?: boolean
  auth_bindings?: Partial<Record<AuthProvider, boolean | UserAuthBindingStatus>>
  identity_bindings?: Partial<Record<AuthProvider, boolean | UserAuthBindingStatus>>
  balance_notify_enabled?: boolean
  balance_notify_threshold?: number | null
  balance_notify_extra_emails?: NotifyEmailEntry[]
}

export interface UserDashboardStats {
  total_api_keys: number
  active_api_keys: number
  total_requests: number
  total_tokens: number
  total_cost: number
  total_actual_cost: number
  today_requests: number
  today_tokens: number
  today_cost: number
  today_actual_cost?: number
}

export interface UsageLog {
  id: number
  model?: string
  request_id?: string
  total_tokens?: number
  input_tokens?: number
  output_tokens?: number
  total_cost?: number
  actual_cost?: number
  created_at?: string
  api_key_id?: number
  api_key_name?: string
  api_key?: { id?: number; name?: string; key?: string }
  group?: { id?: number; name?: string }
  status?: string
  stream?: boolean
  duration_ms?: number | null
  request_type?: string | number
  billing_type?: number
  billing_mode?: string | null
  user_agent?: string | null
  ip_address?: string | null
  image_count?: number
}

export interface UsageTrendPoint {
  date: string
  requests?: number
  tokens?: number
  total_tokens?: number
  cost?: number
  actual_cost?: number
  [key: string]: unknown
}

export interface UsageModelStat {
  model: string
  requests?: number
  tokens?: number
  total_tokens?: number
  cost?: number
  actual_cost?: number
  [key: string]: unknown
}

export interface UserErrorRequest {
  id: number
  created_at: string
  model: string
  inbound_endpoint?: string
  status_code: number
  category: string
  platform?: string
  message: string
  key_name?: string
  key_deleted?: boolean
  client_ip?: string
  group_name?: string
}

export interface UserErrorRequestDetail extends UserErrorRequest {
  error_body?: string
  upstream_status_code?: number
}

export interface PlatformQuotaItem {
  platform?: string
  name?: string
  limit?: number
  used?: number
  remaining?: number
  [key: string]: unknown
}

export interface UserSubscription {
  id: number
  group_id: number
  status: string
  starts_at: string
  expires_at: string | null
  daily_usage_usd: number
  weekly_usage_usd: number
  monthly_usage_usd: number
  group?: ApiKeyGroup
}

export interface SubscriptionSummary {
  active_count?: number
  total_count?: number
  [key: string]: unknown
}

export interface RedeemHistoryItem {
  id: number
  code: string
  type: string
  value: number
  status: string
  used_at: string
  notes?: string
  group?: { id: number; name: string }
}

export interface AffiliateInvitee {
  user_id?: number
  id?: number
  email?: string
  username?: string
  created_at?: string
  total_rebate?: number
  total_spend?: number
  spend?: number
  commission?: number
}

export interface AffiliateDetail {
  user_id: number
  aff_code: string
  aff_count: number
  aff_quota: number
  aff_frozen_quota: number
  aff_history_quota: number
  effective_rebate_rate_percent: number
  invitees?: AffiliateInvitee[]
}

export interface PaymentOrder {
  id: number
  amount: number
  pay_amount: number
  payment_type: string
  out_trade_no: string
  status: string
  order_type: string
  created_at: string
  expires_at: string
  plan_id?: number
  refund_amount?: number
  resume_token?: string
}

export interface SubscriptionPlan {
  id: number
  group_id: number
  group_name?: string
  name: string
  description: string
  price: number
  original_price?: number
  validity_days: number
  validity_unit?: string
  features: string[]
  for_sale: boolean
}

export interface CheckoutInfo {
  methods: Record<string, {
    display_name?: string
    daily_limit: number
    daily_used: number
    daily_remaining: number
    single_min: number
    single_max: number
    fee_rate: number
    available: boolean
  }>
  global_min: number
  global_max: number
  plans: SubscriptionPlan[]
  balance_disabled: boolean
  balance_recharge_multiplier: number
  subscription_usd_to_cny_rate: number
  recharge_fee_rate: number
  help_text: string
  help_image_url: string
  stripe_publishable_key: string
}

export interface CreateOrderResult {
  order_id: number
  amount: number
  pay_url?: string
  qr_code?: string
  client_secret?: string
  intent_id?: string
  pay_amount: number
  fee_rate: number
  expires_at: string
  out_trade_no?: string
  resume_token?: string
  result_type?: string
  oauth?: { authorize_url?: string }
}

export interface PublicOrderResult {
  out_trade_no: string
  status: string
  paid: boolean
  created_at: string
  expires_at: string
}

export interface TotpStatus {
  enabled: boolean
  available?: boolean
  feature_enabled?: boolean
}

// —— Keys ——

export async function listKeys(page = 1, pageSize = 20, filters?: {
  search?: string
  status?: string
  group_id?: number | string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}): Promise<Paginated<ApiKey>> {
  return apiGet(withQuery('/api/v1/keys', { page, page_size: pageSize, ...filters }))
}

export async function getKey(id: number): Promise<ApiKey> {
  return apiGet(`/api/v1/keys/${id}`)
}

export async function createKey(payload: {
  name: string
  group_id?: number | null
  custom_key?: string
  ip_whitelist?: string[]
  ip_blacklist?: string[]
  quota?: number
  expires_in_days?: number
  rate_limit_5h?: number
  rate_limit_1d?: number
  rate_limit_7d?: number
}): Promise<ApiKey> {
  return apiPost('/api/v1/keys', payload)
}

export async function updateKey(id: number, updates: {
  name?: string
  group_id?: number | null
  status?: 'active' | 'inactive'
  ip_whitelist?: string[]
  ip_blacklist?: string[]
  quota?: number
  expires_at?: string | null
  reset_quota?: boolean
  rate_limit_5h?: number
  rate_limit_1d?: number
  rate_limit_7d?: number
  reset_rate_limit_usage?: boolean
}): Promise<ApiKey> {
  return apiPut(`/api/v1/keys/${id}`, updates)
}

export async function deleteKey(id: number): Promise<{ message: string }> {
  return apiDelete(`/api/v1/keys/${id}`)
}

export async function listAvailableGroups(): Promise<ApiKeyGroup[]> {
  return apiGet('/api/v1/groups/available')
}

// —— Profile / security ——

export async function getProfile(): Promise<UserProfile> {
  return apiGet('/api/v1/user/profile')
}

export async function updateProfile(profile: {
  username?: string
  avatar_url?: string | null
  balance_notify_enabled?: boolean
  balance_notify_threshold?: number | null
  balance_notify_extra_emails?: NotifyEmailEntry[]
}): Promise<UserProfile> {
  return apiPut('/api/v1/user', profile)
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<{ message: string }> {
  return apiPut('/api/v1/user/password', { old_password: oldPassword, new_password: newPassword })
}

export async function sendNotifyEmailCode(email: string): Promise<void> {
  await apiPost('/api/v1/user/notify-email/send-code', { email })
}

export async function verifyNotifyEmail(email: string, code: string): Promise<void> {
  await apiPost('/api/v1/user/notify-email/verify', { email, code })
}

export async function removeNotifyEmail(email: string): Promise<void> {
  await apiDelete('/api/v1/user/notify-email', { email })
}

export async function toggleNotifyEmail(email: string, disabled: boolean): Promise<UserProfile> {
  return apiPut('/api/v1/user/notify-email/toggle', { email, disabled })
}

export async function sendEmailBindingCode(email: string): Promise<void> {
  await apiPost('/api/v1/user/account-bindings/email/send-code', { email })
}

export async function bindEmailIdentity(payload: {
  email: string
  verify_code: string
  password: string
}): Promise<UserProfile> {
  return apiPost('/api/v1/user/account-bindings/email', payload)
}

export type BindableOAuthProvider = Exclude<AuthProvider, 'email'>

export async function unbindAuthIdentity(provider: BindableOAuthProvider): Promise<UserProfile> {
  return apiDelete(`/api/v1/user/account-bindings/${provider}`)
}

/** Start OAuth bind flow (full navigation). Uses session cookie path. */
export function buildOAuthBindingStartURL(
  provider: BindableOAuthProvider,
  redirectTo = '/app/settings/profile',
): string {
  const base = '/api/v1'
  const params = new URLSearchParams({
    redirect: redirectTo,
    intent: 'bind_current_user',
  })
  if (provider === 'wechat') {
    const mode =
      typeof navigator !== 'undefined' && /MicroMessenger/i.test(navigator.userAgent) ? 'mp' : 'open'
    params.set('mode', mode)
  }
  return `${base}/auth/oauth/${provider}/bind/start?${params.toString()}`
}

/** Start OAuth login (full navigation). Same-origin apex → edge allowlisted `/auth/oauth/*`. */
export function buildOAuthLoginStartURL(
  provider: BindableOAuthProvider,
  redirectTo = '/app',
): string {
  const base = '/api/v1'
  const params = new URLSearchParams({
    redirect: redirectTo,
  })
  if (provider === 'wechat') {
    const mode =
      typeof navigator !== 'undefined' && /MicroMessenger/i.test(navigator.userAgent) ? 'mp' : 'open'
    params.set('mode', mode)
  }
  return `${base}/auth/oauth/${provider}/start?${params.toString()}`
}

export type OAuthLoginFlags = {
  linuxdo: boolean
  dingtalk: boolean
  wechat: boolean
  oidc: boolean
  oidcName: string
  github: boolean
  google: boolean
}

/**
 * OAuth provider callback host must match the host that runs OAuth start
 * (state cookies are host-bound). Absolute redirect_uri pointing at another host
 * (e.g. console while on apex) will fail invalid_state — hide those providers.
 *
 * Empty / missing / relative redirect_url → compatible (legacy / not published).
 */
export function oauthRedirectCompatibleWithHost(
  redirectUrl: string | null | undefined,
  currentHost: string,
): boolean {
  const raw = (redirectUrl ?? '').trim()
  if (!raw) return true
  if (raw.startsWith('/')) return true
  try {
    const host = new URL(raw).hostname.toLowerCase()
    const cur = currentHost.toLowerCase().replace(/:\d+$/, '')
    if (host === cur) return true
    // www alias pair
    if (host === `www.${cur}` || cur === `www.${host}`) return true
    return false
  } catch {
    return false
  }
}

function currentBrowserHost(): string {
  if (typeof window === 'undefined' || !window.location?.hostname) return ''
  return window.location.hostname
}

/** Product multi-host apex: hide email-OAuth until callback host is known + matching. */
export function isProductApexHost(host: string): boolean {
  const h = host.toLowerCase()
  return h === 'you-box.com' || h === 'www.you-box.com'
}

/**
 * Whether an email-OAuth provider may be offered on this page host.
 * Missing/empty public redirect_url → fail closed on product apex; elsewhere allow.
 * Absolute redirect must match current host (state cookies are host-bound).
 */
export function emailOAuthEnabledForHost(redirectUrl: unknown, host: string): boolean {
  if (typeof redirectUrl !== 'string' || !redirectUrl.trim()) {
    // Missing, null, or empty (e.g. Profile asString default): fail closed on apex only.
    return !isProductApexHost(host)
  }
  return oauthRedirectCompatibleWithHost(redirectUrl, host)
}

export function parseOAuthLoginFlags(
  raw: Record<string, unknown> | null | undefined,
  options?: { host?: string },
): OAuthLoginFlags {
  const asBool = (v: unknown) => v === true
  const asString = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v : fallback)
  const open = raw?.wechat_oauth_open_enabled
  const mp = raw?.wechat_oauth_mp_enabled
  const wechatLegacy = asBool(raw?.wechat_oauth_enabled)
  const wechat = wechatLegacy || open === true || mp === true
  const host = (options?.host ?? currentBrowserHost()).trim()

  // Email-OAuth providers store absolute backend callback URLs. Hide when the
  // configured callback host cannot receive cookies from this page's start host.
  // On multi-host product apex, fail closed if public redirect_url is not yet
  // published (older backend) so customers never hit invalid_state.
  let google = asBool(raw?.google_oauth_enabled)
  let github = asBool(raw?.github_oauth_enabled)
  if (host) {
    if (google) {
      google = emailOAuthEnabledForHost(raw?.google_oauth_redirect_url, host)
    }
    if (github) {
      github = emailOAuthEnabledForHost(raw?.github_oauth_redirect_url, host)
    }
  }

  return {
    linuxdo: asBool(raw?.linuxdo_oauth_enabled),
    dingtalk: asBool(raw?.dingtalk_oauth_enabled),
    wechat,
    oidc: asBool(raw?.oidc_oauth_enabled),
    oidcName: asString(raw?.oidc_oauth_provider_name, 'OIDC'),
    github,
    google,
  }
}

export function anyOAuthLoginEnabled(flags: OAuthLoginFlags): boolean {
  return flags.linuxdo || flags.dingtalk || flags.wechat || flags.oidc || flags.github || flags.google
}

export async function getMyPlatformQuotas(): Promise<{ items?: PlatformQuotaItem[]; [key: string]: unknown }> {
  return apiGet('/api/v1/user/platform-quotas')
}

export async function getTotpStatus(): Promise<TotpStatus> {
  return apiGet('/api/v1/user/totp/status')
}

export async function revokeAllSessions(): Promise<{ message: string }> {
  return apiPost('/api/v1/auth/revoke-all-sessions', {})
}

// —— Usage ——

export async function getUsageDashboardStats(): Promise<UserDashboardStats> {
  return apiGet('/api/v1/usage/dashboard/stats')
}

export async function listUsage(
  page = 1,
  pageSize = 20,
  filters?: {
    api_key_id?: number
    start_date?: string
    end_date?: string
    model?: string
    group_id?: number
    request_type?: string | number
    stream?: boolean
    billing_type?: number | null
    billing_mode?: string | null
    sort_by?: string
    sort_order?: 'asc' | 'desc'
  },
): Promise<Paginated<UsageLog>> {
  return apiGet(withQuery('/api/v1/usage', { page, page_size: pageSize, ...filters }))
}

export async function getUsageById(id: number): Promise<UsageLog> {
  return apiGet(`/api/v1/usage/${id}`)
}

export async function getUsageDashboardTrend(params?: {
  start_date?: string
  end_date?: string
  granularity?: 'day' | 'hour'
  api_key_id?: number
  model?: string
  group_id?: number
  timezone?: string
}): Promise<{ trend: UsageTrendPoint[]; start_date: string; end_date: string; granularity: string }> {
  return apiGet(withQuery('/api/v1/usage/dashboard/trend', params as Record<string, string | number | boolean | undefined | null>))
}

export async function getUsageDashboardModels(params?: {
  start_date?: string
  end_date?: string
  api_key_id?: number
  model?: string
  group_id?: number
  timezone?: string
}): Promise<{ models: UsageModelStat[]; start_date: string; end_date: string }> {
  return apiGet(withQuery('/api/v1/usage/dashboard/models', params as Record<string, string | number | boolean | undefined | null>))
}

export async function getUsageDashboardSnapshotV2(params?: {
  start_date?: string
  end_date?: string
  granularity?: 'day' | 'hour'
  include_trend?: boolean
  include_model_stats?: boolean
  include_group_stats?: boolean
  api_key_id?: number
  timezone?: string
}): Promise<{
  generated_at: string
  start_date: string
  end_date: string
  granularity: string
  trend?: UsageTrendPoint[]
  models?: UsageModelStat[]
  groups?: Array<{ group_id?: number; group_name?: string; requests?: number; actual_cost?: number; [key: string]: unknown }>
}> {
  return apiGet(withQuery('/api/v1/usage/dashboard/snapshot-v2', params as Record<string, string | number | boolean | undefined | null>))
}

export async function getApiKeyDailyUsage(
  apiKeyId: number,
  days = 30,
): Promise<{
  items: Array<{
    date: string
    requests: number
    total_tokens: number
    cost: number
    actual_cost: number
  }>
  days: number
  start_date: string
  end_date: string
}> {
  return apiGet(withQuery(`/api/v1/user/api-keys/${apiKeyId}/usage/daily`, { days }))
}

export async function listMyErrorRequests(params?: {
  page?: number
  page_size?: number
  start_date?: string
  end_date?: string
  model?: string
  status_code?: number
  category?: string
  api_key_id?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  timezone?: string
}): Promise<Paginated<UserErrorRequest>> {
  return apiGet(withQuery('/api/v1/usage/errors', params as Record<string, string | number | boolean | undefined | null>))
}

export async function getMyErrorDetail(id: number): Promise<UserErrorRequestDetail> {
  return apiGet(`/api/v1/usage/errors/${id}`)
}

// —— Subscriptions ——

export async function getMySubscriptions(): Promise<UserSubscription[]> {
  return apiGet('/api/v1/subscriptions')
}

export async function getActiveSubscriptions(): Promise<UserSubscription[]> {
  return apiGet('/api/v1/subscriptions/active')
}

export async function getSubscriptionSummary(): Promise<SubscriptionSummary> {
  return apiGet('/api/v1/subscriptions/summary')
}

// —— Redeem ——

export async function redeemCode(code: string): Promise<{
  message: string
  type: string
  value: number
  new_balance?: number
  new_concurrency?: number
}> {
  return apiPost('/api/v1/redeem', { code })
}

export async function getRedeemHistory(): Promise<RedeemHistoryItem[]> {
  return apiGet('/api/v1/redeem/history')
}

// —— Affiliate ——

export async function getAffiliate(): Promise<AffiliateDetail> {
  return apiGet('/api/v1/user/aff')
}

export async function transferAffiliateQuota(): Promise<{ transferred_quota: number; balance: number }> {
  return apiPost('/api/v1/user/aff/transfer', {})
}

// —— Payment ——

export async function getCheckoutInfo(): Promise<CheckoutInfo> {
  return apiGet('/api/v1/payment/checkout-info')
}

export async function createOrder(data: {
  amount: number
  payment_type: string
  order_type: string
  plan_id?: number
  return_url?: string
  is_mobile?: boolean
}): Promise<CreateOrderResult> {
  return apiPost('/api/v1/payment/orders', data)
}

export async function getMyOrders(page = 1, pageSize = 20, status?: string): Promise<Paginated<PaymentOrder>> {
  return apiGet(withQuery('/api/v1/payment/orders/my', { page, page_size: pageSize, status }))
}

export async function cancelOrder(id: number): Promise<unknown> {
  return apiPost(`/api/v1/payment/orders/${id}/cancel`, {})
}

export async function getOrder(id: number): Promise<PaymentOrder> {
  return apiGet(`/api/v1/payment/orders/${id}`)
}

export async function requestRefund(id: number, reason: string): Promise<unknown> {
  return apiPost(`/api/v1/payment/orders/${id}/refund-request`, { reason })
}

export async function getRefundEligibleProviders(): Promise<{ provider_instance_ids: string[] }> {
  return apiGet('/api/v1/payment/orders/refund-eligible-providers')
}

export async function verifyOrder(outTradeNo: string): Promise<PaymentOrder> {
  return apiPost('/api/v1/payment/orders/verify', { out_trade_no: outTradeNo })
}

export async function resolveOrderPublic(resumeToken: string): Promise<PublicOrderResult> {
  return apiPost('/api/v1/payment/public/orders/resolve', { resume_token: resumeToken })
}

// —— Batch image (gateway API key auth) ——

export type BatchImageStatus =
  | 'queued'
  | 'running'
  | 'indexing'
  | 'processing_results'
  | 'settling'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'output_deleted'
  | string

export interface BatchImageJob {
  id: string
  object?: string
  task_name: string
  parent_batch_id?: string | null
  status: BatchImageStatus
  model: string
  provider: string
  item_count: number
  success_count: number
  fail_count: number
  estimated_cost: number
  hold_amount: number
  actual_cost: number | null
  created_at: number
  submitted_at: number | null
  settled_at: number | null
  downloaded_at?: number | null
  output_deleted_at?: number | null
}

export interface BatchImageItem {
  batch_id?: string
  custom_id: string
  status: string
  prompt_preview?: string | null
  mime_type?: string | null
  file_extension?: string | null
  image_count: number
  error?: { code: string; message: string; source?: string } | null
  /** Optional preview fields — only present when gateway returns them. */
  image_url?: string | null
  thumbnail_url?: string | null
  image_urls?: string[] | null
}

export interface BatchImageModel {
  id: string
  object?: string
  provider: string
  /** Present only if API returns real unit pricing; never invent client-side. */
  unit_price?: number
  price?: number
}

function gatewayOrigin(): string {
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

function buildGatewayUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${gatewayOrigin()}${suffix}`
}

async function parseBatchError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as { error?: { message?: string; code?: string }; message?: string }
    const message = body?.error?.message || body?.message || response.statusText
    return new Error(message)
  } catch {
    return new Error(response.statusText || `HTTP ${response.status}`)
  }
}

async function batchFetch<T>(apiKey: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildGatewayUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init?.headers || {}),
    },
  })
  if (!response.ok) throw await parseBatchError(response)
  if (response.status === 204) return undefined as T
  const ct = response.headers.get('content-type') || ''
  if (ct.includes('application/json')) return response.json() as Promise<T>
  return undefined as T
}

export async function listBatchImageJobs(
  apiKey: string,
  options: { limit?: number; cursor?: string; status?: string; taskName?: string } = {},
): Promise<{ object?: string; data: BatchImageJob[]; has_more: boolean }> {
  const params = new URLSearchParams()
  params.set('limit', String(options.limit || 20))
  if (options.cursor) params.set('cursor', options.cursor)
  if (options.status) params.set('status', options.status)
  if (options.taskName) params.set('task_name', options.taskName)
  return batchFetch(apiKey, `/v1/images/batches?${params}`)
}

export async function getBatchImageJob(apiKey: string, batchId: string): Promise<BatchImageJob> {
  return batchFetch(apiKey, `/v1/images/batches/${encodeURIComponent(batchId)}`)
}

export async function listBatchImageModels(apiKey: string): Promise<{ data: BatchImageModel[] }> {
  return batchFetch(apiKey, '/v1/images/batches/models')
}

export async function listBatchImageItems(
  apiKey: string,
  batchId: string,
  status = '',
): Promise<{ data: BatchImageItem[]; has_more: boolean }> {
  const q = status ? `?status=${encodeURIComponent(status)}` : ''
  return batchFetch(apiKey, `/v1/images/batches/${encodeURIComponent(batchId)}/items${q}`)
}

export async function cancelBatchImageJob(apiKey: string, batchId: string): Promise<BatchImageJob> {
  return batchFetch(apiKey, `/v1/images/batches/${encodeURIComponent(batchId)}/cancel`, { method: 'POST' })
}

export async function deleteBatchImageJobRecord(apiKey: string, batchId: string): Promise<void> {
  await batchFetch(apiKey, `/v1/images/batches/${encodeURIComponent(batchId)}`, { method: 'DELETE' })
}

export async function downloadBatchImageZip(apiKey: string, batchId: string): Promise<Blob> {
  const response = await fetch(buildGatewayUrl(`/v1/images/batches/${encodeURIComponent(batchId)}/download`), {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!response.ok) throw await parseBatchError(response)
  return response.blob()
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function submitBatchImageJob(
  apiKey: string,
  payload: {
    model: string
    task_name?: string
    provider?: string
    image_size?: string
    aspect_ratio?: string
    items: Array<{ custom_id: string; prompt: string; output_count?: number }>
  },
  idempotencyKey: string,
): Promise<BatchImageJob> {
  return batchFetch(apiKey, '/v1/images/batches', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  })
}

// —— Auth (apex credential forms) ——

export async function loginWithPassword(email: string, password: string, turnstileToken?: string): Promise<AuthResponse> {
  const data = await apiPost<AuthResponse>('/api/v1/auth/login', {
    email,
    password,
    turnstile_token: turnstileToken,
  })
  if (!data.requires_2fa && data.access_token) {
    setSession(data)
  }
  return data
}

export async function loginWith2FA(tempToken: string, totpCode: string): Promise<AuthResponse> {
  const data = await apiPost<AuthResponse>('/api/v1/auth/login/2fa', {
    temp_token: tempToken,
    totp_code: totpCode,
  })
  if (data.access_token) setSession(data)
  return data
}

export async function prepareRegistration(payload: {
  email: string
  password: string
  turnstile_token?: string
  promo_code?: string
  invitation_code?: string
  aff_code?: string
}): Promise<{ transaction_id: string; email: string; countdown: number }> {
  return apiPost('/api/v1/auth/registration/prepare', payload)
}

export async function completeRegistration(transactionId: string, verifyCode: string): Promise<AuthResponse> {
  const data = await apiPost<AuthResponse>('/api/v1/auth/registration/complete', {
    transaction_id: transactionId,
    verify_code: verifyCode,
  })
  if (data.access_token) setSession(data)
  return data
}

export async function forgotPassword(email: string, turnstileToken?: string): Promise<{ message: string }> {
  return apiPost('/api/v1/auth/forgot-password', { email, turnstile_token: turnstileToken })
}

export async function resetPassword(payload: {
  email: string
  token: string
  new_password: string
}): Promise<{ message: string }> {
  return apiPost('/api/v1/auth/reset-password', payload)
}

export async function getPublicSettings(): Promise<Record<string, unknown>> {
  return apiGet('/api/v1/settings/public')
}

export async function authorizeDesktopLogin(params: {
  code_challenge: string
  redirect_uri: string
  state?: string
}): Promise<{ code: string; expires_in?: number }> {
  return apiPost('/api/v1/auth/boxai/desktop/authorize', {
    code_challenge: params.code_challenge,
    redirect_uri: params.redirect_uri,
    state: params.state,
  })
}

// —— Channels / monitor / announcements / TOTP ——

export interface UserSupportedModelPricing {
  billing_mode?: string
  input_price?: number | null
  output_price?: number | null
  cache_write_price?: number | null
  cache_read_price?: number | null
  image_output_price?: number | null
  per_request_price?: number | null
  intervals?: Array<{
    min_tokens?: number
    max_tokens?: number | null
    input_price?: number | null
    output_price?: number | null
  }>
}

export interface UserSupportedModel {
  name: string
  platform?: string
  pricing?: UserSupportedModelPricing | null
}

export interface UserChannelPlatformSection {
  platform?: string
  groups?: Array<{
    id?: number
    name?: string
    platform?: string
    subscription_type?: string
    rate_multiplier?: number
    is_exclusive?: boolean
  }>
  supported_models?: UserSupportedModel[]
}

/** Nested shape from `/channels/available` (Vue parity). Flat legacy fields kept optional. */
export interface AvailableChannel {
  id?: number
  name?: string
  description?: string
  platform?: string
  models?: string[]
  group_name?: string
  platforms?: UserChannelPlatformSection[]
  [key: string]: unknown
}

export async function listAvailableChannels(): Promise<AvailableChannel[]> {
  return apiGet('/api/v1/channels/available')
}

export interface MonitorTimelinePoint {
  status?: string
  latency_ms?: number | null
  ping_latency_ms?: number | null
  checked_at?: string
}

export interface UserMonitorView {
  id: number
  name: string
  provider?: string
  group_name?: string
  primary_model?: string
  primary_status?: string
  primary_latency_ms?: number | null
  primary_ping_latency_ms?: number | null
  availability_7d?: number
  extra_models?: Array<{
    model?: string
    status?: string
    latency_ms?: number | null
  }>
  timeline?: MonitorTimelinePoint[]
}

export async function listChannelMonitors(): Promise<{ items: UserMonitorView[] }> {
  return apiGet('/api/v1/channel-monitors')
}

export async function getChannelMonitorStatus(id: number): Promise<{
  id: number
  name: string
  provider?: string
  group_name?: string
  models?: Array<{
    model?: string
    latest_status?: string
    latest_latency_ms?: number | null
    availability_7d?: number
    availability_15d?: number
    availability_30d?: number
    avg_latency_7d_ms?: number | null
  }>
}> {
  return apiGet(`/api/v1/channel-monitors/${id}/status`)
}

export interface UserAnnouncement {
  id: number
  title: string
  content: string
  /** silent | popup — presentation mode, not a content category */
  notify_mode?: string
  /** Optional category when backend provides one (not currently required). */
  type?: string
  category?: string
  tag?: string
  read_at?: string | null
  created_at?: string
  starts_at?: string
  ends_at?: string
  updated_at?: string
}

export async function listAnnouncements(unreadOnly = false): Promise<UserAnnouncement[]> {
  return apiGet(withQuery('/api/v1/announcements', unreadOnly ? { unread_only: 1 } : undefined))
}

export async function markAnnouncementRead(id: number): Promise<{ message: string }> {
  return apiPost(`/api/v1/announcements/${id}/read`, {})
}

export async function totpVerificationMethod(): Promise<{ method: string }> {
  return apiGet('/api/v1/user/totp/verification-method')
}

export async function totpSendCode(): Promise<{ success: boolean }> {
  return apiPost('/api/v1/user/totp/send-code', {})
}

export async function totpSetup(payload: { email_code?: string; password?: string }): Promise<{
  secret: string
  qr_code_url: string
  setup_token: string
  countdown: number
}> {
  return apiPost('/api/v1/user/totp/setup', payload)
}

export async function totpEnable(payload: { totp_code: string; setup_token: string }): Promise<{ success: boolean }> {
  return apiPost('/api/v1/user/totp/enable', payload)
}

export async function totpDisable(payload: { email_code?: string; password?: string }): Promise<{ success: boolean }> {
  return apiPost('/api/v1/user/totp/disable', payload)
}
