package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/boxai/creator"
	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	middleware2 "github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/gin-gonic/gin"
)

// BoxAICreatorCloudHandler is product-first Creator cloud HTTP glue.
type BoxAICreatorCloudHandler struct{ service *creator.Service }

func NewBoxAICreatorCloudHandler(db *sql.DB) *BoxAICreatorCloudHandler {
	return &BoxAICreatorCloudHandler{service: creator.MustNewFromEnv(db)}
}

func creatorUser(c *gin.Context) (int64, bool) {
	s, ok := middleware2.GetAuthSubjectFromContext(c)
	if !ok || s.UserID <= 0 {
		response.Unauthorized(c, "authentication required")
		return 0, false
	}
	return s.UserID, true
}
func creatorError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, creator.ErrUnavailable):
		response.Error(c, http.StatusServiceUnavailable, err.Error())
	case errors.Is(err, sql.ErrNoRows):
		response.NotFound(c, "Creator cloud resource not found")
	case errors.Is(err, creator.ErrObjectConflict):
		response.Error(c, http.StatusConflict, err.Error())
	case errors.Is(err, creator.ErrQuotaExceeded):
		response.Error(c, http.StatusForbidden, err.Error())
	case errors.Is(err, creator.ErrInvalidRecord),
		errors.Is(err, creator.ErrInvalidRecordKind),
		errors.Is(err, creator.ErrInvalidRecordPath),
		errors.Is(err, creator.ErrInvalidClientID),
		errors.Is(err, creator.ErrInvalidObject),
		errors.Is(err, creator.ErrInvalidDimensions),
		errors.Is(err, creator.ErrObjectNotUploaded),
		errors.Is(err, creator.ErrObjectSize):
		response.BadRequest(c, err.Error())
	default:
		response.InternalError(c, "Creator cloud operation failed")
	}
}
func bindCreatorJSON(c *gin.Context, dst any) bool {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, creator.MaxPayloadBytes+4096)
	d := json.NewDecoder(c.Request.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(dst); err != nil {
		response.BadRequest(c, "invalid JSON body")
		return false
	}
	return true
}
func (h *BoxAICreatorCloudHandler) Snapshot(c *gin.Context) {
	uid, ok := creatorUser(c)
	if !ok {
		return
	}
	includeDeleted := c.Query("include_deleted") == "true" || c.Query("include_deleted") == "1"
	v, e := h.service.Snapshot(c.Request.Context(), uid, c.Query("kind"), includeDeleted)
	if e != nil {
		creatorError(c, e)
		return
	}
	response.Success(c, v)
}
func (h *BoxAICreatorCloudHandler) PutRecord(c *gin.Context) {
	uid, ok := creatorUser(c)
	if !ok {
		return
	}
	var in struct {
		Payload         json.RawMessage `json:"payload"`
		ClientUpdatedAt *time.Time      `json:"client_updated_at"`
	}
	if !bindCreatorJSON(c, &in) {
		return
	}
	var at time.Time
	if in.ClientUpdatedAt != nil {
		at = *in.ClientUpdatedAt
	}
	rev, e := h.service.PutRecord(c.Request.Context(), uid, c.Param("kind"), c.Param("client_id"), in.Payload, at)
	if e != nil {
		creatorError(c, e)
		return
	}
	response.Success(c, gin.H{"revision": rev})
}
func (h *BoxAICreatorCloudHandler) DeleteRecord(c *gin.Context) {
	uid, ok := creatorUser(c)
	if !ok {
		return
	}
	var in struct {
		ClientUpdatedAt *time.Time `json:"client_updated_at"`
	}
	if !bindCreatorJSON(c, &in) {
		return
	}
	var at time.Time
	if in.ClientUpdatedAt != nil {
		at = *in.ClientUpdatedAt
	}
	if e := h.service.DeleteRecord(c.Request.Context(), uid, c.Param("kind"), c.Param("client_id"), at); e != nil {
		creatorError(c, e)
		return
	}
	response.Success(c, gin.H{"deleted": true})
}
func (h *BoxAICreatorCloudHandler) Upload(c *gin.Context) {
	uid, ok := creatorUser(c)
	if !ok {
		return
	}
	var in creator.ObjectInput
	if !bindCreatorJSON(c, &in) {
		return
	}
	o, u, e := h.service.BeginUpload(c.Request.Context(), uid, c.Param("client_id"), in)
	if e != nil {
		creatorError(c, e)
		return
	}
	response.Success(c, gin.H{"object": o, "upload_url": u, "already_ready": o.Status == "ready", "expires_in": int(creator.PresignTTL.Seconds())})
}
func (h *BoxAICreatorCloudHandler) Complete(c *gin.Context) {
	uid, ok := creatorUser(c)
	if !ok {
		return
	}
	o, e := h.service.Complete(c.Request.Context(), uid, c.Param("client_id"))
	if e != nil {
		creatorError(c, e)
		return
	}
	response.Success(c, o)
}
func (h *BoxAICreatorCloudHandler) URL(c *gin.Context) {
	uid, ok := creatorUser(c)
	if !ok {
		return
	}
	u, e := h.service.URL(c.Request.Context(), uid, c.Param("client_id"))
	if e != nil {
		creatorError(c, e)
		return
	}
	response.Success(c, gin.H{"url": u, "expires_in": int(creator.PresignTTL.Seconds())})
}
func (h *BoxAICreatorCloudHandler) DeleteObject(c *gin.Context) {
	uid, ok := creatorUser(c)
	if !ok {
		return
	}
	if e := h.service.DeleteObject(c.Request.Context(), uid, c.Param("client_id")); e != nil {
		creatorError(c, e)
		return
	}
	response.Success(c, gin.H{"deleted": true})
}
