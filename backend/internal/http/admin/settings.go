package admin

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/woodleighschool/signin-ui/internal/http/sessionctx"
	"github.com/woodleighschool/signin-ui/internal/store/sqlc"
)

const maxBackgroundUploadBytes = int64(2 << 20) // 2MiB

var allowedBackgroundTypes = map[string]struct{}{ //nolint:gochecknoglobals // allowed upload types
	"image/jpeg":  {},
	"image/pjpeg": {},
}

type portalBackgroundResponse struct {
	HasImage    bool       `json:"hasImage"`
	URL         string     `json:"url,omitempty"`
	ContentType string     `json:"contentType,omitempty"`
	UpdatedAt   *time.Time `json:"updatedAt,omitempty"`
}

func (h Handler) settingsRoutes(r chi.Router) {
	r.Get("/portal-background", h.getPortalBackground)
	r.Post("/portal-background", h.uploadPortalBackground)
	r.Delete("/portal-background", h.deletePortalBackground)
}

func (h Handler) getPortalBackground(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	viewer, ok := sessionctx.User(ctx)
	if !ok || !viewer.IsAdmin {
		respondError(w, http.StatusForbidden, "admin required")
		return
	}

	asset, err := h.Store.GetAsset(ctx, "portal_background")
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondJSON(w, http.StatusOK, portalBackgroundResponse{HasImage: false})
			return
		}
		h.Logger.Error("load portal background", "err", err)
		respondError(w, http.StatusInternalServerError, "failed to load background")
		return
	}

	respondJSON(w, http.StatusOK, mapPortalBackground(asset))
}

func (h Handler) uploadPortalBackground(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	viewer, ok := sessionctx.User(ctx)
	if !ok || !viewer.IsAdmin {
		respondError(w, http.StatusForbidden, "admin required")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxBackgroundUploadBytes)
	if err := r.ParseMultipartForm(maxBackgroundUploadBytes); err != nil {
		respondError(w, http.StatusBadRequest, "invalid upload")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		respondError(w, http.StatusBadRequest, "background file is required")
		return
	}
	defer func() {
		if cerr := file.Close(); cerr != nil {
			h.Logger.Warn("close background upload", "err", cerr)
		}
	}()

	data, err := io.ReadAll(file)
	if err != nil {
		h.Logger.Error("read background file", "err", err)
		respondError(w, http.StatusInternalServerError, "failed to read upload")
		return
	}
	if len(data) == 0 {
		respondError(w, http.StatusBadRequest, "background file is empty")
		return
	}

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = http.DetectContentType(data)
	}
	if _, exists := allowedBackgroundTypes[strings.ToLower(contentType)]; !exists {
		respondError(w, http.StatusBadRequest, "background must be a JPEG image")
		return
	}

	asset, err := h.Store.SaveAsset(ctx, "portal_background", contentType, data)
	if err != nil {
		h.Logger.Error("save portal background", "err", err)
		respondError(w, http.StatusInternalServerError, "failed to save background")
		return
	}

	respondJSON(w, http.StatusOK, mapPortalBackground(asset))
}

func (h Handler) deletePortalBackground(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	viewer, ok := sessionctx.User(ctx)
	if !ok || !viewer.IsAdmin {
		respondError(w, http.StatusForbidden, "admin required")
		return
	}

	if err := h.Store.DeleteAsset(ctx, "portal_background"); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		h.Logger.Error("delete portal background", "err", err)
		respondError(w, http.StatusInternalServerError, "failed to delete background")
		return
	}

	respondJSON(w, http.StatusNoContent, nil)
}

func mapPortalBackground(asset sqlc.Asset) portalBackgroundResponse {
	var updatedAt *time.Time
	if asset.UpdatedAt.Valid {
		t := asset.UpdatedAt.Time
		updatedAt = &t
	}

	return portalBackgroundResponse{
		HasImage:    true,
		URL:         backgroundURL(asset),
		ContentType: asset.ContentType,
		UpdatedAt:   updatedAt,
	}
}

func backgroundURL(asset sqlc.Asset) string {
	if asset.UpdatedAt.Valid {
		return fmt.Sprintf("/api/portal/background?ts=%d", asset.UpdatedAt.Time.Unix())
	}
	return "/api/portal/background"
}
