package service

// BOXAI: Official Vietnamese notification email templates (Vietnam market).
// Merged into notificationEmailOfficialTemplates via init.

func init() {
	for event, tmpl := range notificationEmailOfficialTemplatesVI {
		if notificationEmailOfficialTemplates[event] == nil {
			notificationEmailOfficialTemplates[event] = map[string]notificationEmailOfficialTemplate{}
		}
		notificationEmailOfficialTemplates[event][notificationEmailLocaleVietnamese] = tmpl
	}
}

var notificationEmailOfficialTemplatesVI = map[string]notificationEmailOfficialTemplate{
	NotificationEmailEventAuthVerifyCode: {
		Subject: "[{{site_name}}] Mã xác minh email",
		HTML: notificationEmailCard("#4f46e5", "Mã xác minh email", `
<p>Xin chào {{recipient_name}},</p>
<p>Mã xác minh của bạn là:</p>
<p style="font-size: 32px; font-weight: 700; letter-spacing: 8px; text-align: center;">{{verification_code}}</p>
<p>Mã sẽ hết hạn sau <strong>{{expires_in_minutes}}</strong> phút.</p>
<p>Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.</p>`),
	},
	NotificationEmailEventAuthPasswordReset: {
		Subject: "[{{site_name}}] Yêu cầu đặt lại mật khẩu",
		HTML: notificationEmailCard("#7c3aed", "Đặt lại mật khẩu", `
<p>Xin chào {{recipient_name}},</p>
<p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu. Nhấn nút bên dưới để tạo mật khẩu mới.</p>
<p><a class="button" href="{{reset_url}}">Đặt lại mật khẩu</a></p>
<p>Liên kết hết hạn sau <strong>{{expires_in_minutes}}</strong> phút.</p>
<p class="muted">Nếu nút không hoạt động, hãy sao chép liên kết vào trình duyệt:<br>{{reset_url}}</p>
<p>Nếu bạn không yêu cầu, có thể bỏ qua email này.</p>`),
	},
	NotificationEmailEventNotificationEmailVerifyCode: {
		Subject: "[{{site_name}}] Mã xác minh email thông báo",
		HTML: notificationEmailCard("#0ea5e9", "Xác minh email thông báo", `
<p>Xin chào {{recipient_name}},</p>
<p>Bạn đang thêm địa chỉ này làm email nhận thông báo bổ sung.</p>
<p>Mã xác minh của bạn là:</p>
<p style="font-size: 32px; font-weight: 700; letter-spacing: 8px; text-align: center;">{{verification_code}}</p>
<p>Mã sẽ hết hạn sau <strong>{{expires_in_minutes}}</strong> phút.</p>
<p>Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.</p>`),
	},
	NotificationEmailEventSubscriptionPurchaseSuccess: {
		Subject: "[{{site_name}}] Mua gói đăng ký thành công",
		HTML: notificationEmailCard("#2563eb", "Gói đã kích hoạt", `
<p>Xin chào {{recipient_name}},</p>
<p>Gói <strong>{{subscription_group}}</strong> của bạn đã được kích hoạt trong <strong>{{subscription_days}}</strong> ngày.</p>
<p>Hết hạn: <strong>{{expiry_time}}</strong></p>
<p>Mã đơn: {{order_id}}</p>`),
	},
	NotificationEmailEventSubscriptionExpiryReminder: {
		Subject: "[{{site_name}}] Gói sẽ hết hạn sau {{days_remaining}} ngày",
		HTML: notificationEmailCard("#f97316", "Nhắc hết hạn gói", `
<p>Xin chào {{recipient_name}},</p>
<p>Gói <strong>{{subscription_group}}</strong> sẽ hết hạn sau <strong>{{days_remaining}}</strong> ngày.</p>
<p>Thời điểm hết hạn: <strong>{{expiry_time}}</strong></p>
<p class="muted"><a href="{{unsubscribe_url}}">Hủy nhận nhắc hết hạn gói (tuỳ chọn)</a></p>`),
	},
	NotificationEmailEventBalanceLow: {
		Subject: "[{{site_name}}] Cảnh báo số dư thấp",
		HTML: notificationEmailCard("#d97706", "Cảnh báo số dư thấp", `
<p>Xin chào {{recipient_name}},</p>
<p>Số dư hiện tại là <strong>${{current_balance}}</strong>, đã dưới ngưỡng cảnh báo <strong>${{threshold}}</strong>.</p>
<p>Hãy nạp tiền kịp thời để tránh gián đoạn dịch vụ.</p>
<p><a class="button" href="{{recharge_url}}">Nạp tiền ngay</a></p>
<p class="muted"><a href="{{unsubscribe_url}}">Hủy nhận cảnh báo số dư (tuỳ chọn)</a></p>`),
	},
	NotificationEmailEventBalanceRechargeSuccess: {
		Subject: "[{{site_name}}] Nạp số dư thành công",
		HTML: notificationEmailCard("#16a34a", "Nạp tiền thành công", `
<p>Xin chào {{recipient_name}},</p>
<p>Bạn đã nạp <strong>${{recharge_amount}}</strong> thành công.</p>
<p>Số dư hiện tại: <strong>${{current_balance}}</strong></p>
<p>Mã đơn: {{order_id}}</p>`),
	},
	NotificationEmailEventAccountQuotaAlert: {
		Subject: "[{{site_name}}] Cảnh báo hạn mức tài khoản - {{account_name}}",
		HTML: notificationEmailCard("#dc2626", "Cảnh báo hạn mức tài khoản", `
<p>Tài khoản upstream <strong>{{account_name}}</strong> đã vượt ngưỡng cảnh báo hạn mức.</p>
<table style="width:100%;border-collapse:collapse;">
  <tr><td>ID tài khoản</td><td>{{account_id}}</td></tr>
  <tr><td>Nền tảng</td><td>{{platform}}</td></tr>
  <tr><td>Chiều hạn mức</td><td>{{quota_dimension}}</td></tr>
  <tr><td>Đã dùng / Giới hạn</td><td>{{quota_used}} / {{quota_limit}}</td></tr>
  <tr><td>Còn lại</td><td>{{quota_remaining}}</td></tr>
  <tr><td>Ngưỡng</td><td>{{quota_threshold}}</td></tr>
</table>`),
	},
	NotificationEmailEventContentModerationViolation: {
		Subject: "[{{site_name}}] Thông báo kiểm soát rủi ro",
		HTML: notificationEmailCard("#ef4444", "Thông báo kiểm soát rủi ro", `
<p>Xin chào {{recipient_name}},</p>
<p>Yêu cầu API của bạn đã kích hoạt chính sách kiểm duyệt/kiểm soát rủi ro.</p>
<table style="width:100%;border-collapse:collapse;">
  <tr><td>Thời điểm</td><td>{{triggered_at}}</td></tr>
  <tr><td>Nhóm</td><td>{{group_name}}</td></tr>
  <tr><td>Danh mục / Điểm</td><td>{{moderation_category}} / {{moderation_score}}</td></tr>
  <tr><td>Số lần vi phạm</td><td>{{violation_count}} / {{ban_threshold}}</td></tr>
</table>
<p>Vui lòng rà soát nội dung yêu cầu để tránh gián đoạn dịch vụ.</p>`),
	},
	NotificationEmailEventContentModerationDisabled: {
		Subject: "[{{site_name}}] Tài khoản bị vô hiệu do kiểm soát rủi ro",
		HTML: notificationEmailCard("#b91c1c", "Tài khoản bị vô hiệu", `
<p>Xin chào {{recipient_name}},</p>
<p>Tài khoản của bạn đã nhiều lần kích hoạt quy tắc kiểm duyệt/kiểm soát rủi ro và đã bị vô hiệu tự động.</p>
<table style="width:100%;border-collapse:collapse;">
  <tr><td>Thời điểm vô hiệu</td><td>{{triggered_at}}</td></tr>
  <tr><td>Nhóm</td><td>{{group_name}}</td></tr>
  <tr><td>Danh mục / Điểm</td><td>{{moderation_category}} / {{moderation_score}}</td></tr>
  <tr><td>Số lần vi phạm</td><td>{{violation_count}} / {{ban_threshold}}</td></tr>
</table>
<p>Liên hệ quản trị viên nếu cần khiếu nại hoặc khôi phục truy cập.</p>`),
	},
	NotificationEmailEventCyberPolicyNotice: {
		Subject: "[{{site_name}}] Thông báo chính sách an ninh mạng",
		HTML: notificationEmailCard("#ef4444", "Chính sách an ninh mạng", `
<p>Xin chào {{recipient_name}},</p>
<p>Yêu cầu của bạn đã bị chặn bởi chính sách an ninh mạng của nhà cung cấp upstream.</p>
<table style="width:100%;border-collapse:collapse;">
  <tr><td>Thời điểm</td><td>{{triggered_at}}</td></tr>
  <tr><td>Mô hình</td><td>{{model}}</td></tr>
  <tr><td>Nhóm</td><td>{{group_name}}</td></tr>
  <tr><td>Thông báo upstream</td><td>{{upstream_message}}</td></tr>
</table>
<p>Nếu bạn cho rằng đây là nhầm lẫn, hãy diễn đạt lại yêu cầu hoặc xin quyền truy cập an ninh được ủy quyền.</p>`),
	},
	NotificationEmailEventOpsAlert: {
		Subject: "[Cảnh báo vận hành][{{severity}}] {{rule_name}}",
		HTML: notificationEmailCard("#ea580c", "Cảnh báo vận hành", `
<p><strong>Quy tắc</strong>: {{rule_name}}</p>
<p><strong>Mức độ</strong>: {{severity}}</p>
<p><strong>Trạng thái</strong>: {{alert_status}}</p>
<p><strong>Chỉ số</strong>: {{metric_type}} {{operator}} {{metric_value}} (ngưỡng {{threshold_value}})</p>
<p><strong>Thời điểm</strong>: {{triggered_at}}</p>
<p><strong>Mô tả</strong>: {{alert_description}}</p>`),
	},
	NotificationEmailEventOpsScheduledReport: {
		Subject: "[{{site_name}}] {{report_name}}",
		HTML: notificationEmailCard("#1d4ed8", "{{report_name}}", `
<p>Kỳ báo cáo: {{report_start_time}} → {{report_end_time}}</p>
<p>Loại: {{report_type}}</p>
{{report_html}}
<p class="muted"><a href="{{unsubscribe_url}}">Hủy đăng ký báo cáo này</a></p>`),
	},
}
