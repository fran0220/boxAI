package handler

// BOXAI product feature — unauthenticated public system status for marketing.
//
//	GET /api/v1/public/status?period=7d|15d|30d
//	GET /api/v1/public/status/:id?period=7d|15d|30d
//
// Hard rules:
//   - Never return api_key, encrypted keys, endpoints, headers, or body overrides.
//   - Only enabled + public_visible monitors.
//   - Short Cache-Control + stable ETag (updated_at from max probe time).
//
// Tracked in FORK_DELTA.md.

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/handler/admin"
	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	"github.com/Wei-Shaw/sub2api/internal/service"

	"github.com/gin-gonic/gin"
)

const (
	publicStatusCacheControl   = "public, max-age=45"
	publicStatusDefaultPeriod  = "7d"
	publicStatusBatchIDsMax    = 200
	// Empty fleet uses a fixed timestamp so ETag stays stable.
	publicStatusEmptyUpdatedAt = "1970-01-01T00:00:00Z"
)

// BoxAIPublicStatusHandler serves the marketing status page API (no auth).
type BoxAIPublicStatusHandler struct {
	monitorService *service.ChannelMonitorService
	settingService *service.SettingService
	db             *sql.DB
}

// NewBoxAIPublicStatusHandler constructs the public status handler.
// db may be nil in pure unit tests (public_visible filter then treats all
// enabled monitors as public).
func NewBoxAIPublicStatusHandler(
	monitorService *service.ChannelMonitorService,
	settingService *service.SettingService,
	db *sql.DB,
) *BoxAIPublicStatusHandler {
	return &BoxAIPublicStatusHandler{
		monitorService: monitorService,
		settingService: settingService,
		db:             db,
	}
}

// --- Response DTOs (intentionally minimal — no secrets) ---

type publicStatusResponse struct {
	Period    string              `json:"period"`
	Overall   string              `json:"overall"`
	UpdatedAt string              `json:"updated_at"`
	Items     []publicStatusItem  `json:"items"`
	Groups    []publicStatusGroup `json:"groups,omitempty"`
}

type publicStatusItem struct {
	ID              int64                       `json:"id"`
	Name            string                      `json:"name"`
	Provider        string                      `json:"provider"`
	GroupName       string                      `json:"group_name"`
	PrimaryModel    string                      `json:"primary_model"`
	Status          string                      `json:"status"`
	LatencyMs       *int                        `json:"latency_ms"`
	PingLatencyMs   *int                        `json:"ping_latency_ms"`
	Availability    float64                     `json:"availability"`
	Availability7d  float64                     `json:"availability_7d"`
	Availability15d float64                     `json:"availability_15d,omitempty"`
	Availability30d float64                     `json:"availability_30d,omitempty"`
	ExtraModels     []publicStatusExtraModel    `json:"extra_models"`
	Timeline        []publicStatusTimelinePoint `json:"timeline"`
}

type publicStatusExtraModel struct {
	Model     string `json:"model"`
	Status    string `json:"status"`
	LatencyMs *int   `json:"latency_ms"`
}

type publicStatusTimelinePoint struct {
	Status        string `json:"status"`
	LatencyMs     *int   `json:"latency_ms"`
	PingLatencyMs *int   `json:"ping_latency_ms"`
	CheckedAt     string `json:"checked_at"`
}

type publicStatusGroup struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

type publicStatusDetailResponse struct {
	ID        int64                     `json:"id"`
	Name      string                    `json:"name"`
	Provider  string                    `json:"provider"`
	GroupName string                    `json:"group_name"`
	// Period is echo-only for Get; payload always includes 7d/15d/30d windows.
	Period    string                    `json:"period"`
	UpdatedAt string                    `json:"updated_at"`
	Models    []publicStatusModelDetail `json:"models"`
}

type publicStatusModelDetail struct {
	Model           string  `json:"model"`
	LatestStatus    string  `json:"latest_status"`
	LatestLatencyMs *int    `json:"latest_latency_ms"`
	Availability7d  float64 `json:"availability_7d"`
	Availability15d float64 `json:"availability_15d"`
	Availability30d float64 `json:"availability_30d"`
	AvgLatency7dMs  *int    `json:"avg_latency_7d_ms"`
}

// List GET /api/v1/public/status
func (h *BoxAIPublicStatusHandler) List(c *gin.Context) {
	period, days, err := parsePublicStatusPeriod(c.Query("period"))
	if err != nil {
		response.ErrorFrom(c, infraerrors.BadRequest("INVALID_PERIOD", err.Error()))
		return
	}

	if !h.featureEnabled(c) {
		h.writeCachedJSON(c, publicStatusResponse{
			Period:    period,
			Overall:   "operational",
			UpdatedAt: publicStatusEmptyUpdatedAt,
			Items:     []publicStatusItem{},
		})
		return
	}

	if h.monitorService == nil {
		response.InternalError(c, "monitor service unavailable")
		return
	}

	views, err := h.monitorService.ListUserView(c.Request.Context())
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}

	publicIDs, err := h.listPublicVisibleIDs(c.Request.Context())
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}

	// Filter to public-visible first, then one batch availability query for period.
	filtered := make([]*service.UserMonitorView, 0, len(views))
	for _, v := range views {
		if publicIDs != nil {
			if _, ok := publicIDs[v.ID]; !ok {
				continue
			}
		}
		filtered = append(filtered, v)
	}

	periodAvail := map[int64]float64{}
	if days != 7 && len(filtered) > 0 {
		ids := make([]int64, 0, len(filtered))
		primaryByID := make(map[int64]string, len(filtered))
		for _, v := range filtered {
			ids = append(ids, v.ID)
			primaryByID[v.ID] = v.PrimaryModel
		}
		pctMap, batchErr := h.monitorService.BatchPrimaryAvailabilityPct(
			c.Request.Context(), ids, primaryByID, days,
		)
		if batchErr != nil {
			// Do not silently advertise period with 7d numbers.
			response.ErrorFrom(c, infraerrors.ServiceUnavailable(
				"AVAILABILITY_UNAVAILABLE",
				"availability for requested period is temporarily unavailable",
			))
			return
		}
		periodAvail = pctMap
	}

	items := make([]publicStatusItem, 0, len(filtered))
	for _, v := range filtered {
		item := viewToPublicItem(v)
		if days != 7 {
			// Missing samples → 0% for selected period (not 7d mislabel).
			pct := periodAvail[v.ID]
			item.Availability = pct
			switch days {
			case 15:
				item.Availability15d = pct
			case 30:
				item.Availability30d = pct
			}
		}
		items = append(items, item)
	}

	payload := publicStatusResponse{
		Period:    period,
		Overall:   computeOverall(items),
		UpdatedAt: maxTimelineUpdatedAt(items),
		Items:     items,
		Groups:    groupCounts(items),
	}
	h.writeCachedJSON(c, payload)
}

// Get GET /api/v1/public/status/:id
// Period is validated and echoed; all of 7d/15d/30d are always returned on models.
func (h *BoxAIPublicStatusHandler) Get(c *gin.Context) {
	period, _, err := parsePublicStatusPeriod(c.Query("period"))
	if err != nil {
		response.ErrorFrom(c, infraerrors.BadRequest("INVALID_PERIOD", err.Error()))
		return
	}
	if !h.featureEnabled(c) {
		response.ErrorFrom(c, service.ErrChannelMonitorNotFound)
		return
	}
	if h.monitorService == nil {
		response.InternalError(c, "monitor service unavailable")
		return
	}

	id, ok := admin.ParseChannelMonitorID(c)
	if !ok {
		return
	}

	publicIDs, err := h.listPublicVisibleIDs(c.Request.Context())
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	if publicIDs != nil {
		if _, ok := publicIDs[id]; !ok {
			response.ErrorFrom(c, service.ErrChannelMonitorNotFound)
			return
		}
	}

	detail, err := h.monitorService.GetUserDetail(c.Request.Context(), id)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}

	models := make([]publicStatusModelDetail, 0, len(detail.Models))
	for _, m := range detail.Models {
		models = append(models, publicStatusModelDetail{
			Model:           m.Model,
			LatestStatus:    m.LatestStatus,
			LatestLatencyMs: m.LatestLatencyMs,
			Availability7d:  m.Availability7d,
			Availability15d: m.Availability15d,
			Availability30d: m.Availability30d,
			AvgLatency7dMs:  m.AvgLatency7dMs,
		})
	}

	h.writeCachedJSON(c, publicStatusDetailResponse{
		ID:        detail.ID,
		Name:      detail.Name,
		Provider:  detail.Provider,
		GroupName: detail.GroupName,
		Period:    period,
		UpdatedAt: publicStatusEmptyUpdatedAt, // detail has no timeline; stable empty stamp
		Models:    models,
	})
}

// SetPublicVisible PUT /api/v1/admin/channel-monitors/:id/public-visible
func (h *BoxAIPublicStatusHandler) SetPublicVisible(c *gin.Context) {
	id, ok := admin.ParseChannelMonitorID(c)
	if !ok {
		return
	}
	var req struct {
		PublicVisible *bool `json:"public_visible" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.PublicVisible == nil {
		response.ErrorFrom(c, infraerrors.BadRequest("VALIDATION_ERROR", "public_visible is required"))
		return
	}
	if h.db == nil {
		response.InternalError(c, "database unavailable")
		return
	}
	res, err := h.db.ExecContext(c.Request.Context(),
		`UPDATE channel_monitors SET public_visible = $1, updated_at = NOW() WHERE id = $2`,
		*req.PublicVisible, id)
	if err != nil {
		response.ErrorFrom(c, fmt.Errorf("set public_visible: %w", err))
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		response.ErrorFrom(c, service.ErrChannelMonitorNotFound)
		return
	}
	response.Success(c, gin.H{"id": id, "public_visible": *req.PublicVisible})
}

// ListPublicVisibleFlags returns id -> public_visible for admin list enrichment.
func (h *BoxAIPublicStatusHandler) ListPublicVisibleFlags(ctx context.Context, ids []int64) (map[int64]bool, error) {
	out := make(map[int64]bool, len(ids))
	if len(ids) == 0 || h.db == nil {
		return out, nil
	}
	if len(ids) > publicStatusBatchIDsMax {
		ids = ids[:publicStatusBatchIDsMax]
	}
	args := make([]any, len(ids))
	placeholders := make([]string, len(ids))
	for i, id := range ids {
		args[i] = id
		placeholders[i] = fmt.Sprintf("$%d", i+1)
	}
	q := fmt.Sprintf(
		`SELECT id, public_visible FROM channel_monitors WHERE id IN (%s)`,
		strings.Join(placeholders, ","),
	)
	rows, err := h.db.QueryContext(ctx, q, args...)
	if err != nil {
		if isUndefinedColumn(err) {
			// Fail-closed once column is expected: do not invent public=true.
			return out, fmt.Errorf("public_visible column unavailable: %w", err)
		}
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var vis bool
		if err := rows.Scan(&id, &vis); err != nil {
			return nil, err
		}
		out[id] = vis
	}
	return out, rows.Err()
}

// BatchPublicVisible GET /api/v1/admin/channel-monitors/public-visible?ids=1,2,3
func (h *BoxAIPublicStatusHandler) BatchPublicVisible(c *gin.Context) {
	raw := strings.TrimSpace(c.Query("ids"))
	if raw == "" {
		response.Success(c, gin.H{"items": map[string]bool{}})
		return
	}
	parts := strings.Split(raw, ",")
	ids := make([]int64, 0, len(parts))
	for _, p := range parts {
		if len(ids) >= publicStatusBatchIDsMax {
			break
		}
		id, err := strconv.ParseInt(strings.TrimSpace(p), 10, 64)
		if err != nil || id <= 0 {
			continue
		}
		ids = append(ids, id)
	}
	flags, err := h.ListPublicVisibleFlags(c.Request.Context(), ids)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	out := make(map[string]bool, len(flags))
	for id, vis := range flags {
		out[strconv.FormatInt(id, 10)] = vis
	}
	response.Success(c, gin.H{"items": out})
}

// --- helpers ---

func (h *BoxAIPublicStatusHandler) featureEnabled(c *gin.Context) bool {
	if h.settingService == nil {
		return true
	}
	return h.settingService.GetChannelMonitorRuntime(c.Request.Context()).Enabled
}

// listPublicVisibleIDs returns a set of monitor IDs that are enabled+public.
// nil map means "no filter available — treat all enabled as public" (tests / no db).
func (h *BoxAIPublicStatusHandler) listPublicVisibleIDs(ctx context.Context) (map[int64]struct{}, error) {
	if h.db == nil {
		return nil, nil
	}
	rows, err := h.db.QueryContext(ctx,
		`SELECT id FROM channel_monitors WHERE enabled = TRUE AND public_visible = TRUE`)
	if err != nil {
		if isUndefinedColumn(err) {
			// Migration not applied: fall back to all enabled (ListUserView already filters enabled).
			return nil, nil
		}
		return nil, fmt.Errorf("list public monitors: %w", err)
	}
	defer rows.Close()
	out := make(map[int64]struct{})
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out[id] = struct{}{}
	}
	return out, rows.Err()
}

func isUndefinedColumn(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "public_visible") &&
		(strings.Contains(msg, "does not exist") || strings.Contains(msg, "undefined_column"))
}

func parsePublicStatusPeriod(raw string) (period string, days int, err error) {
	p := strings.TrimSpace(strings.ToLower(raw))
	if p == "" {
		p = publicStatusDefaultPeriod
	}
	switch p {
	case "7d":
		return "7d", 7, nil
	case "15d":
		return "15d", 15, nil
	case "30d":
		return "30d", 30, nil
	default:
		return "", 0, fmt.Errorf("period must be one of 7d, 15d, 30d")
	}
}

func viewToPublicItem(v *service.UserMonitorView) publicStatusItem {
	extras := make([]publicStatusExtraModel, 0, len(v.ExtraModels))
	for _, e := range v.ExtraModels {
		extras = append(extras, publicStatusExtraModel{
			Model:     e.Model,
			Status:    e.Status,
			LatencyMs: e.LatencyMs,
		})
	}
	timeline := make([]publicStatusTimelinePoint, 0, len(v.Timeline))
	for _, p := range v.Timeline {
		timeline = append(timeline, publicStatusTimelinePoint{
			Status:        p.Status,
			LatencyMs:     p.LatencyMs,
			PingLatencyMs: p.PingLatencyMs,
			CheckedAt:     p.CheckedAt.UTC().Format(time.RFC3339),
		})
	}
	status := v.PrimaryStatus
	if status == "" {
		status = "unknown"
	}
	return publicStatusItem{
		ID:             v.ID,
		Name:           v.Name,
		Provider:       v.Provider,
		GroupName:      v.GroupName,
		PrimaryModel:   v.PrimaryModel,
		Status:         status,
		LatencyMs:      v.PrimaryLatencyMs,
		PingLatencyMs:  v.PrimaryPingLatencyMs,
		Availability:   v.Availability7d,
		Availability7d: v.Availability7d,
		ExtraModels:    extras,
		Timeline:       timeline,
	}
}

// maxTimelineUpdatedAt derives a stable updated_at from the newest probe timestamp
// across items (not wall-clock), so ETag stays stable between unchanged fleets.
func maxTimelineUpdatedAt(items []publicStatusItem) string {
	var maxT time.Time
	for _, it := range items {
		for _, p := range it.Timeline {
			if p.CheckedAt == "" {
				continue
			}
			t, err := time.Parse(time.RFC3339, p.CheckedAt)
			if err != nil {
				continue
			}
			if t.After(maxT) {
				maxT = t
			}
		}
	}
	if maxT.IsZero() {
		return publicStatusEmptyUpdatedAt
	}
	return maxT.UTC().Format(time.RFC3339)
}

// computeOverall: empty fleet or unknown/empty probe history is operational
// ("no history ≠ outage"). Explicit failed/error/degraded → degraded.
// Documented in docs/status-surface.md; Vue console must match.
func computeOverall(items []publicStatusItem) string {
	if len(items) == 0 {
		return "operational"
	}
	for _, it := range items {
		switch it.Status {
		case "failed", "error", "degraded":
			return "degraded"
		case "operational", "unknown", "":
			// continue
		default:
			return "degraded"
		}
	}
	return "operational"
}

func groupCounts(items []publicStatusItem) []publicStatusGroup {
	counts := map[string]int{}
	order := make([]string, 0)
	for _, it := range items {
		name := strings.TrimSpace(it.GroupName)
		if name == "" {
			continue
		}
		if _, ok := counts[name]; !ok {
			order = append(order, name)
		}
		counts[name]++
	}
	if len(order) == 0 {
		return nil
	}
	out := make([]publicStatusGroup, 0, len(order))
	for _, name := range order {
		out = append(out, publicStatusGroup{Name: name, Count: counts[name]})
	}
	return out
}

// etagMatch reports whether If-None-Match matches the given strong etag
// (supports weak tags and comma-separated lists per RFC 9110).
func etagMatch(ifNoneMatch, etag string) bool {
	if ifNoneMatch == "" || etag == "" {
		return false
	}
	// Strip surrounding quotes from our etag for comparison base.
	want := strings.Trim(etag, `"`)
	for _, part := range strings.Split(ifNoneMatch, ",") {
		token := strings.TrimSpace(part)
		if token == "*" {
			return true
		}
		token = strings.TrimPrefix(token, "W/")
		token = strings.TrimPrefix(token, "w/")
		token = strings.Trim(token, `"`)
		if token == want {
			return true
		}
	}
	return false
}

func (h *BoxAIPublicStatusHandler) writeCachedJSON(c *gin.Context, payload any) {
	body, err := json.Marshal(response.Response{
		Code:    0,
		Message: "success",
		Data:    payload,
	})
	if err != nil {
		response.InternalError(c, "encode status failed")
		return
	}

	sum := sha256.Sum256(body)
	etag := `"` + hex.EncodeToString(sum[:16]) + `"`
	c.Header("ETag", etag)
	c.Header("Cache-Control", publicStatusCacheControl)
	if etagMatch(c.GetHeader("If-None-Match"), etag) {
		c.Status(http.StatusNotModified)
		return
	}
	c.Data(http.StatusOK, "application/json; charset=utf-8", body)
}
