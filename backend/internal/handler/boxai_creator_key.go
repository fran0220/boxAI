package handler

// BOXAI product feature — idempotent Creator gateway API key.
//
// Creator (you-box.com/create/*) authenticates to /v1/* with the user's JWT,
// which DesktopJWTGatewayAuth rewrites into an API key. Prefer a dedicated
// key named "boxai-creator" so usage is attributable and stable across
// sessions. This endpoint creates it on first call and returns metadata
// (never the plaintext key after the fact — Creator uses JWT only).
//
//	POST /api/v1/boxai/creator/ensure-key   (authenticated)
//
// Tracked in FORK_DELTA.md.

import (
	"context"
	"strings"

	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	middleware2 "github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"

	"github.com/gin-gonic/gin"
)

// CreatorAPIKeyName is the canonical name for the Creator/web JWT bridge key.
const CreatorAPIKeyName = "boxai-creator"

// boxaiEnsureCreatorKeyResponse intentionally omits plaintext key material.
// Creator clients authenticate via JWT; the gateway bridge resolves the key
// server-side. Returning the key would turn any XSS into long-lived key theft.
type boxaiEnsureCreatorKeyResponse struct {
	ID      int64  `json:"id"`
	Name    string `json:"name"`
	Created bool   `json:"created"`
	GroupID *int64 `json:"group_id,omitempty"`
	Status  string `json:"status"`
}

// BoxAIEnsureCreatorKey returns the user's boxai-creator API key metadata,
// creating one if none is active. Requires jwtAuth upstream.
func (h *AuthHandler) BoxAIEnsureCreatorKey(apiKeyService *service.APIKeyService) gin.HandlerFunc {
	return boxaiEnsureCreatorKey(apiKeyService)
}

type creatorKeyAPI interface {
	List(ctx context.Context, userID int64, params pagination.PaginationParams, filters service.APIKeyListFilters) ([]service.APIKey, *pagination.PaginationResult, error)
	Create(ctx context.Context, userID int64, req service.CreateAPIKeyRequest) (*service.APIKey, error)
	Update(ctx context.Context, id int64, userID int64, req service.UpdateAPIKeyRequest) (*service.APIKey, error)
	GetAvailableGroups(ctx context.Context, userID int64) ([]service.Group, error)
}

func boxaiEnsureCreatorKey(keys creatorKeyAPI) gin.HandlerFunc {
	return func(c *gin.Context) {
		subject, ok := middleware2.GetAuthSubjectFromContext(c)
		if !ok {
			response.Unauthorized(c, "User not authenticated")
			return
		}
		if keys == nil {
			response.InternalError(c, "API key service unavailable")
			return
		}

		apiKey, created, err := ensureCreatorAPIKey(c.Request.Context(), keys, subject.UserID)
		if err != nil {
			response.ErrorFrom(c, err)
			return
		}

		response.Success(c, boxaiEnsureCreatorKeyResponse{
			ID:      apiKey.ID,
			Name:    apiKey.Name,
			Created: created,
			GroupID: apiKey.GroupID,
			Status:  apiKey.Status,
		})
	}
}

func ensureCreatorAPIKey(ctx context.Context, keys creatorKeyAPI, userID int64) (*service.APIKey, bool, error) {
	existing, err := findActiveCreatorKey(ctx, keys, userID)
	if err != nil {
		return nil, false, err
	}
	if existing != nil {
		// Upgrade: bind a group if the key was created before groups were available.
		if existing.GroupID == nil {
			if groupID := firstAvailableGroupID(ctx, keys, userID); groupID != nil {
				updated, updErr := keys.Update(ctx, existing.ID, userID, service.UpdateAPIKeyRequest{
					GroupID: groupID,
				})
				if updErr == nil && updated != nil {
					return updated, false, nil
				}
				// Fall through with the ungrouped key if bind fails (e.g. race).
			}
		}
		return existing, false, nil
	}

	req := service.CreateAPIKeyRequest{Name: CreatorAPIKeyName}
	// Prefer binding an eligible group so gateway routing and JWT-bridge
	// preference stay consistent with Desktop (grouped keys only).
	if groupID := firstAvailableGroupID(ctx, keys, userID); groupID != nil {
		req.GroupID = groupID
	}

	created, err := keys.Create(ctx, userID, req)
	if err != nil {
		// Race: another request may have created the key between list and create.
		if existing, findErr := findActiveCreatorKey(ctx, keys, userID); findErr == nil && existing != nil {
			return existing, false, nil
		}
		return nil, false, err
	}
	return created, true, nil
}

func firstAvailableGroupID(ctx context.Context, keys creatorKeyAPI, userID int64) *int64 {
	groups, err := keys.GetAvailableGroups(ctx, userID)
	if err != nil || len(groups) == 0 {
		return nil
	}
	id := groups[0].ID
	return &id
}

// findActiveCreatorKey pages through the user's keys (search-filtered) so a
// creator key beyond the first page is not missed.
func findActiveCreatorKey(ctx context.Context, keys creatorKeyAPI, userID int64) (*service.APIKey, error) {
	const pageSize = 100
	for page := 1; page <= 20; page++ {
		list, result, err := keys.List(
			ctx,
			userID,
			pagination.PaginationParams{Page: page, PageSize: pageSize},
			service.APIKeyListFilters{Search: CreatorAPIKeyName},
		)
		if err != nil {
			return nil, err
		}
		for i := range list {
			key := list[i]
			if !key.IsActive() || key.Key == "" {
				continue
			}
			if strings.EqualFold(strings.TrimSpace(key.Name), CreatorAPIKeyName) {
				return &key, nil
			}
		}
		if result == nil || int64(page*pageSize) >= result.Total || len(list) == 0 {
			break
		}
	}
	return nil, nil
}
