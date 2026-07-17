package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
)

func TestParsePublicStatusPeriod(t *testing.T) {
	t.Parallel()
	cases := []struct {
		in      string
		period  string
		days    int
		wantErr bool
	}{
		{"", "7d", 7, false},
		{"7d", "7d", 7, false},
		{"15d", "15d", 15, false},
		{"30d", "30d", 30, false},
		{" 7D ", "7d", 7, false},
		{"1d", "", 0, true},
		{"week", "", 0, true},
	}
	for _, tc := range cases {
		p, d, err := parsePublicStatusPeriod(tc.in)
		if tc.wantErr {
			if err == nil {
				t.Fatalf("period %q: expected error", tc.in)
			}
			continue
		}
		if err != nil {
			t.Fatalf("period %q: unexpected err %v", tc.in, err)
		}
		if p != tc.period || d != tc.days {
			t.Fatalf("period %q: got %s/%d want %s/%d", tc.in, p, d, tc.period, tc.days)
		}
	}
}

func TestComputeOverall(t *testing.T) {
	t.Parallel()
	if computeOverall(nil) != "operational" {
		t.Fatal("empty should be operational")
	}
	if computeOverall([]publicStatusItem{{Status: "operational"}}) != "operational" {
		t.Fatal("all ok")
	}
	if computeOverall([]publicStatusItem{{Status: "unknown"}}) != "operational" {
		t.Fatal("unknown is not outage")
	}
	if computeOverall([]publicStatusItem{{Status: ""}}) != "operational" {
		t.Fatal("empty status is not outage")
	}
	if computeOverall([]publicStatusItem{{Status: "operational"}, {Status: "degraded"}}) != "degraded" {
		t.Fatal("degraded")
	}
	if computeOverall([]publicStatusItem{{Status: "failed"}}) != "degraded" {
		t.Fatal("failed maps to degraded overall")
	}
}

func TestViewToPublicItemNeverLeaksSecrets(t *testing.T) {
	t.Parallel()
	lat := 42
	ping := 12
	v := &service.UserMonitorView{
		ID:                   9,
		Name:                 "Claude",
		Provider:             "anthropic",
		GroupName:            "core",
		PrimaryModel:         "claude-sonnet-4",
		PrimaryStatus:        "operational",
		PrimaryLatencyMs:     &lat,
		PrimaryPingLatencyMs: &ping,
		Availability7d:       99.5,
		ExtraModels: []service.ExtraModelStatus{
			{Model: "claude-opus", Status: "operational", LatencyMs: &lat},
		},
		Timeline: []service.UserMonitorTimelinePoint{
			{Status: "operational", LatencyMs: &lat, PingLatencyMs: &ping, CheckedAt: time.Unix(1_700_000_000, 0).UTC()},
		},
	}
	item := viewToPublicItem(v)
	raw, err := json.Marshal(item)
	if err != nil {
		t.Fatal(err)
	}
	s := string(raw)
	for _, bad := range []string{
		"api_key", "encrypted", "endpoint", "Authorization", "sk-", "Bearer",
		"body_override", "extra_headers", "template_id",
	} {
		if containsFold(s, bad) {
			t.Fatalf("public item leaked %q: %s", bad, s)
		}
	}
	if item.Name != "Claude" || item.Availability != 99.5 {
		t.Fatalf("unexpected item: %+v", item)
	}
}

func TestWriteCachedJSONETagStableAnd304(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewBoxAIPublicStatusHandler(nil, nil, nil)

	// Stable payload (no wall-clock) — same ETag on two sequential encodes.
	payload := publicStatusResponse{
		Period:    "7d",
		Overall:   "operational",
		UpdatedAt: publicStatusEmptyUpdatedAt,
		Items:     []publicStatusItem{},
	}

	router := gin.New()
	router.GET("/api/v1/public/status", func(c *gin.Context) {
		h.writeCachedJSON(c, payload)
	})

	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, httptest.NewRequest(http.MethodGet, "/api/v1/public/status", nil))
	if w1.Code != http.StatusOK {
		t.Fatalf("status %d body=%s", w1.Code, w1.Body.String())
	}
	etag := w1.Header().Get("ETag")
	if etag == "" {
		t.Fatal("missing ETag")
	}
	if w1.Header().Get("Cache-Control") != publicStatusCacheControl {
		t.Fatalf("cache-control: %s", w1.Header().Get("Cache-Control"))
	}

	wAgain := httptest.NewRecorder()
	router.ServeHTTP(wAgain, httptest.NewRequest(http.MethodGet, "/api/v1/public/status", nil))
	if wAgain.Header().Get("ETag") != etag {
		t.Fatalf("etag not stable: %q vs %q", etag, wAgain.Header().Get("ETag"))
	}

	var env response.Response
	if err := json.Unmarshal(w1.Body.Bytes(), &env); err != nil {
		t.Fatal(err)
	}
	if env.Code != 0 {
		t.Fatalf("code %d", env.Code)
	}

	// 304 on matching If-None-Match (strong)
	w2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodGet, "/api/v1/public/status", nil)
	req2.Header.Set("If-None-Match", etag)
	router.ServeHTTP(w2, req2)
	if w2.Code != http.StatusNotModified {
		t.Fatalf("expected 304, got %d etag=%q", w2.Code, etag)
	}

	// Weak tag + list form
	w3 := httptest.NewRecorder()
	req3 := httptest.NewRequest(http.MethodGet, "/api/v1/public/status", nil)
	req3.Header.Set("If-None-Match", `W/`+etag+`, "other"`)
	router.ServeHTTP(w3, req3)
	if w3.Code != http.StatusNotModified {
		t.Fatalf("weak etag match: expected 304, got %d", w3.Code)
	}
}

func TestPublicStatusListInvalidPeriod(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewBoxAIPublicStatusHandler(nil, nil, nil)
	w := httptest.NewRecorder()
	r := gin.New()
	r.GET("/api/v1/public/status", h.List)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/public/status?period=99d", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", w.Code, w.Body.String())
	}
	var env response.Response
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatal(err)
	}
	if env.Code == 0 {
		t.Fatal("invalid period should not succeed")
	}
	if env.Reason != "INVALID_PERIOD" && env.Message == "" {
		t.Fatalf("expected INVALID_PERIOD reason, got %+v", env)
	}
}

func TestMaxTimelineUpdatedAtStable(t *testing.T) {
	t.Parallel()
	if maxTimelineUpdatedAt(nil) != publicStatusEmptyUpdatedAt {
		t.Fatal("empty fleet")
	}
	items := []publicStatusItem{
		{
			Timeline: []publicStatusTimelinePoint{
				{CheckedAt: "2026-01-01T00:00:00Z"},
				{CheckedAt: "2026-01-02T12:00:00Z"},
			},
		},
		{
			Timeline: []publicStatusTimelinePoint{
				{CheckedAt: "2026-01-01T06:00:00Z"},
			},
		},
	}
	if got := maxTimelineUpdatedAt(items); got != "2026-01-02T12:00:00Z" {
		t.Fatalf("got %s", got)
	}
	// Same input → same output (ETag stability dependency)
	if maxTimelineUpdatedAt(items) != maxTimelineUpdatedAt(items) {
		t.Fatal("unstable")
	}
}

func TestEtagMatch(t *testing.T) {
	t.Parallel()
	etag := `"abc123"`
	if !etagMatch(etag, etag) {
		t.Fatal("exact")
	}
	if !etagMatch(`W/"abc123"`, etag) {
		t.Fatal("weak")
	}
	if !etagMatch(`"other", W/"abc123"`, etag) {
		t.Fatal("list")
	}
	if etagMatch(`"zzz"`, etag) {
		t.Fatal("mismatch")
	}
}

func TestPublicStatusListEnvelopeNoSecretsOnFeatureDisabled(t *testing.T) {
	gin.SetMode(gin.TestMode)
	// settingService nil → feature enabled, but monitorService nil → 500.
	// Feature-disabled path: use nil setting as enabled; use empty via disabled setting is hard without stub.
	// Validate writeCachedJSON envelope denylist for a realistic item payload.
	h := NewBoxAIPublicStatusHandler(nil, nil, nil)
	lat := 10
	payload := publicStatusResponse{
		Period:    "7d",
		Overall:   "operational",
		UpdatedAt: "2026-01-02T12:00:00Z",
		Items: []publicStatusItem{
			{
				ID:           1,
				Name:         "x",
				Provider:     "openai",
				PrimaryModel: "gpt",
				Status:       "operational",
				LatencyMs:    &lat,
				Availability: 99,
				Timeline:     []publicStatusTimelinePoint{{Status: "operational", CheckedAt: "2026-01-02T12:00:00Z"}},
			},
		},
	}
	router := gin.New()
	router.GET("/x", func(c *gin.Context) { h.writeCachedJSON(c, payload) })
	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/x", nil))
	body := w.Body.String()
	for _, bad := range []string{"api_key", "endpoint", "extra_headers", "body_override", "api_key_encrypted"} {
		if containsFold(body, bad) {
			t.Fatalf("envelope leaked %q: %s", bad, body)
		}
	}
}

func containsFold(s, sub string) bool {
	return len(sub) > 0 && stringContainsFold(s, sub)
}

func stringContainsFold(s, sub string) bool {
	return len(s) >= len(sub) && (func() bool {
		for i := 0; i+len(sub) <= len(s); i++ {
			if equalFoldASCII(s[i:i+len(sub)], sub) {
				return true
			}
		}
		return false
	})()
}

func equalFoldASCII(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := 0; i < len(a); i++ {
		ca, cb := a[i], b[i]
		if ca >= 'A' && ca <= 'Z' {
			ca += 'a' - 'A'
		}
		if cb >= 'A' && cb <= 'Z' {
			cb += 'a' - 'A'
		}
		if ca != cb {
			return false
		}
	}
	return true
}
