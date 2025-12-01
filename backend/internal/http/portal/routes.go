package portal

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/woodleighschool/signin-ui/internal/store"
	"github.com/woodleighschool/signin-ui/internal/store/sqlc"
)

// Handler serves the key-based portal endpoints.
type Handler struct {
	Store  *store.Store
	Logger *slog.Logger
}

// RegisterRoutes mounts the portal endpoints.
func RegisterRoutes(r chi.Router, store *store.Store, logger *slog.Logger) {
	h := Handler{Store: store, Logger: logger}
	r.Get("/config", h.config)
	r.Post("/checkin", h.checkin)
	r.Get("/background", h.background)
}

// config returns location details and allowed users for a key.
func (h Handler) config(w http.ResponseWriter, r *http.Request) {
	keyValue := strings.TrimSpace(r.URL.Query().Get("key"))
	locationIdentifier := strings.TrimSpace(r.URL.Query().Get("location"))
	if keyValue == "" || locationIdentifier == "" {
		respondError(w, http.StatusBadRequest, "key and location are required")
		return
	}

	ctx := r.Context()
	row, err := h.Store.GetKeyLocationForIdentifier(ctx, keyValue, locationIdentifier)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusForbidden, "invalid key or location")
			return
		}
		h.Logger.Error("portal config lookup", "err", err)
		respondError(w, http.StatusInternalServerError, "failed to load config")
		return
	}
	_, _ = h.Store.MarkKeyUsed(ctx, row.ID)

	groupIDs, _ := h.Store.ListLocationGroupIDs(ctx, row.LocationID)
	users, err := h.Store.ListUsersForGroups(ctx, groupIDs)
	if err != nil {
		h.Logger.Error("portal list users (groups)", "err", err)
		respondError(w, http.StatusInternalServerError, "failed to list users")
		return
	}

	resp := map[string]any{
		"location": map[string]any{
			"id":           row.LocationID,
			"name":         row.LocationName,
			"identifier":   row.LocationIdentifier,
			"notesEnabled": row.LocationNotesEnabled,
		},
		"users": mapUsers(users),
	}
	if asset, assetErr := h.Store.GetAsset(ctx, "portal_background"); assetErr == nil {
		resp["backgroundImageUrl"] = portalBackgroundURL(asset)
	} else if !errors.Is(assetErr, pgx.ErrNoRows) {
		h.Logger.Error("portal background lookup", "err", assetErr)
	}
	respondJSON(w, http.StatusOK, resp)
}

// checkin records a portal check-in/out after validating inputs.
func (h Handler) checkin(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var body struct {
		KeyValue           string    `json:"key"`
		LocationIdentifier string    `json:"location"`
		UserID             uuid.UUID `json:"userId"`
		Direction          string    `json:"direction"`
		Notes              string    `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if body.KeyValue == "" || body.LocationIdentifier == "" || body.UserID == uuid.Nil {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}
	if body.Direction != "in" && body.Direction != "out" {
		respondError(w, http.StatusBadRequest, "invalid direction")
		return
	}

	row, err := h.Store.GetKeyLocationForIdentifier(ctx, body.KeyValue, body.LocationIdentifier)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusForbidden, "invalid key or location")
			return
		}
		h.Logger.Error("portal checkin lookup", "err", err)
		respondError(w, http.StatusInternalServerError, "failed to validate key")
		return
	}
	_, _ = h.Store.MarkKeyUsed(ctx, row.ID)

	groupIDs, _ := h.Store.ListLocationGroupIDs(ctx, row.LocationID)
	allowedUsers, err := h.Store.ListUsersForGroups(ctx, groupIDs)
	if err != nil {
		h.Logger.Error("portal list users (groups)", "err", err)
		respondError(w, http.StatusInternalServerError, "failed to validate user")
		return
	}
	if !userAllowed(body.UserID, allowedUsers) {
		respondError(w, http.StatusForbidden, "user not permitted for this location")
		return
	}

	occurred := time.Now().UTC()
	notesValue := strings.TrimSpace(body.Notes)
	notes := pgtype.Text{String: notesValue, Valid: notesValue != "" && row.LocationNotesEnabled}
	_, err = h.Store.CreateCheckin(ctx, sqlc.CreateCheckinParams{
		UserID:     body.UserID,
		LocationID: row.LocationID,
		KeyID:      pgtype.UUID{Bytes: row.ID, Valid: true},
		Direction:  body.Direction,
		Notes:      notes,
		Column6:    occurred,
	})
	if err != nil {
		h.Logger.Error("portal create checkin", "err", err)
		respondError(w, http.StatusInternalServerError, "failed to record checkin")
		return
	}
	respondJSON(w, http.StatusCreated, map[string]any{})
}

func userAllowed(id uuid.UUID, users []sqlc.User) bool {
	for _, u := range users {
		if u.ID == id {
			return true
		}
	}
	return false
}

// mapUsers trims user fields for the portal.
func mapUsers(users []sqlc.User) []map[string]any {
	resp := make([]map[string]any, 0, len(users))
	for _, u := range users {
		resp = append(resp, map[string]any{
			"id":          u.ID,
			"displayName": u.DisplayName,
			"upn":         u.Upn,
		})
	}
	return resp
}

func (h Handler) background(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	asset, err := h.Store.GetAsset(ctx, "portal_background")
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.NotFound(w, r)
			return
		}
		h.Logger.Error("portal background load", "err", err)
		respondError(w, http.StatusInternalServerError, "failed to load background")
		return
	}

	modTime := time.Now()
	if asset.UpdatedAt.Valid {
		modTime = asset.UpdatedAt.Time
	}
	w.Header().Set("Content-Type", asset.ContentType)
	w.Header().Set("Cache-Control", "public, max-age=300, stale-while-revalidate=300")
	http.ServeContent(w, r, "portal-background", modTime, bytes.NewReader(asset.Data))
}

func portalBackgroundURL(asset sqlc.Asset) string {
	if asset.UpdatedAt.Valid {
		return fmt.Sprintf("/api/portal/background?ts=%d", asset.UpdatedAt.Time.Unix())
	}
	return "/api/portal/background"
}

func respondJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if payload == nil {
		return
	}
	_ = json.NewEncoder(w).Encode(payload)
}

func respondError(w http.ResponseWriter, status int, msg string) {
	if msg == "" {
		msg = http.StatusText(status)
	}
	respondJSON(w, status, map[string]any{
		"error":   msg,
		"message": msg,
		"code":    http.StatusText(status),
	})
}
