package handler

import (
	"net/http"

	"github.com/liveagent/agent-gateway/internal/config"
)

func Health(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":           true,
			"ready":        true,
			"hosted":       cfg.MultiTenant,
			"multi_tenant": cfg.MultiTenant,
		})
	}
}
