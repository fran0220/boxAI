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
  quota: number
  quota_used: number
  expires_at: string | null
  created_at: string
  group?: ApiKeyGroup
  rate_limit_5h?: number
  rate_limit_1d?: number
  rate_limit_7d?: number
  usage_5h?: number
  usage_1d?: number
  usage_7d?: number
}

export interface UserProfile {
  id: number
  username: string
  email: string
  role: string
  balance: number
  concurrency: number
  status: string
  totp_enabled?: boolean
  created_at?: string
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
  total_tokens?: number
  total_cost?: number
  actual_cost?: number
  created_at?: string
  api_key_name?: string
  status?: string
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

export interface AffiliateDetail {
  user_id: number
  aff_code: string
  aff_count: number
  aff_quota: number
  aff_frozen_quota: number
  aff_history_quota: number
  effective_rebate_rate_percent: number
  invitees?: Array<{ id?: number; email?: string; created_at?: string }>
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
}): Promise<Paginated<ApiKey>> {
  return apiGet(withQuery('/api/v1/keys', { page, page_size: pageSize, ...filters }))
}

export async function createKey(payload: {
  name: string
  group_id?: number | null
  custom_key?: string
  quota?: number
  expires_in_days?: number
}): Promise<ApiKey> {
  return apiPost('/api/v1/keys', payload)
}

export async function updateKey(id: number, updates: {
  name?: string
  group_id?: number | null
  status?: 'active' | 'inactive'
  quota?: number
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

export async function updateProfile(profile: { username?: string }): Promise<UserProfile> {
  return apiPut('/api/v1/user', profile)
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<{ message: string }> {
  return apiPut('/api/v1/user/password', { old_password: oldPassword, new_password: newPassword })
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

export async function listUsage(page = 1, pageSize = 20): Promise<Paginated<UsageLog>> {
  return apiGet(withQuery('/api/v1/usage', { page, page_size: pageSize }))
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

export async function verifyOrder(outTradeNo: string): Promise<PaymentOrder> {
  return apiPost('/api/v1/payment/orders/verify', { out_trade_no: outTradeNo })
}

export async function resolveOrderPublic(resumeToken: string): Promise<PublicOrderResult> {
  return apiPost('/api/v1/payment/public/orders/resolve', { resume_token: resumeToken })
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

export interface AvailableChannel {
  id?: number
  name?: string
  platform?: string
  models?: string[]
  group_name?: string
  [key: string]: unknown
}

export async function listAvailableChannels(): Promise<AvailableChannel[]> {
  return apiGet('/api/v1/channels/available')
}

export interface UserMonitorView {
  id: number
  name: string
  provider?: string
  group_name?: string
  primary_model?: string
  primary_status?: string
  primary_latency_ms?: number | null
  availability_7d?: number
}

export async function listChannelMonitors(): Promise<{ items: UserMonitorView[] }> {
  return apiGet('/api/v1/channel-monitors')
}

export interface UserAnnouncement {
  id: number
  title: string
  content: string
  read_at?: string
  created_at?: string
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
