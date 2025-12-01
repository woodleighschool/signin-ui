package admin

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/woodleighschool/signin-ui/internal/http/sessionctx"
	"github.com/woodleighschool/signin-ui/internal/store/sqlc"
)

type keyDTO struct {
	ID          uuid.UUID     `json:"id"`
	Description string        `json:"description"`
	KeyValue    string        `json:"keyValue"`
	CreatedAt   time.Time     `json:"createdAt"`
	Locations   []locationDTO `json:"locations"`
}

// keysRoutes handles portal keys (admin only).
func (h Handler) keysRoutes(r chi.Router) {
	r.Get("/", h.listKeys)
	r.Get("/{id}", h.getKey)
	r.Post("/", h.createKey)
	r.Patch("/{id}", h.updateKey)
	r.Delete("/{id}", h.deleteKey)
}

func (h Handler) listKeys(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	viewer, ok := sessionctx.User(ctx)
	if !ok || !viewer.IsAdmin {
		respondError(w, http.StatusForbidden, "admin required")
		return
	}
	keys, err := h.Store.ListKeys(ctx)
	if err != nil {
		h.Logger.Error("list keys", "err", err)
		respondError(w, http.StatusInternalServerError, "failed to list keys")
		return
	}
	resp := make([]keyDTO, 0, len(keys))
	for _, k := range keys {
		resp = append(resp, h.mapKey(ctx, k))
	}
	respondJSON(w, http.StatusOK, resp)
}

func (h Handler) getKey(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	viewer, ok := sessionctx.User(ctx)
	if !ok || !viewer.IsAdmin {
		respondError(w, http.StatusForbidden, "admin required")
		return
	}
	keyID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid key id")
		return
	}
	key, err := h.Store.GetKey(ctx, keyID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "key not found")
			return
		}
		h.Logger.Error("get key", "err", err, "key", keyID)
		respondError(w, http.StatusInternalServerError, "failed to load key")
		return
	}

	respondJSON(w, http.StatusOK, h.mapKey(ctx, key))
}

func (h Handler) createKey(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	viewer, ok := sessionctx.User(ctx)
	if !ok || !viewer.IsAdmin {
		respondError(w, http.StatusForbidden, "admin required")
		return
	}
	var err error
	var body struct {
		Description string      `json:"description"`
		KeyValue    string      `json:"keyValue"`
		LocationIDs []uuid.UUID `json:"locationIds"`
	}
	if err = decodeJSON(r, &body); err != nil {
		respondError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if body.KeyValue == "" {
		body.KeyValue = generateKeyValue()
	}

	key, err := h.Store.CreateKey(ctx, sqlc.CreateKeyParams{
		ID:          uuid.New(),
		Description: pgtype.Text{String: body.Description, Valid: body.Description != ""},
		KeyValue:    body.KeyValue,
		LocationIds: body.LocationIDs,
	})
	if err != nil {
		h.Logger.Error("create key", "err", err)
		respondError(w, http.StatusInternalServerError, "failed to create key")
		return
	}

	var locs []locationDTO
	for _, lid := range body.LocationIDs {
		loc, getLocErr := h.Store.GetLocation(ctx, lid)
		if getLocErr == nil {
			locs = append(locs, mapLocation(loc, loc.GroupIds))
		}
	}

	respondJSON(w, http.StatusCreated, keyDTO{
		ID:          key.ID,
		Description: key.Description.String,
		KeyValue:    key.KeyValue,
		CreatedAt:   key.CreatedAt.Time,
		Locations:   locs,
	})
}

func (h Handler) updateKey(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	viewer, ok := sessionctx.User(ctx)
	if !ok || !viewer.IsAdmin {
		respondError(w, http.StatusForbidden, "admin required")
		return
	}
	keyID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid key id")
		return
	}
	var body struct {
		Description string      `json:"description"`
		KeyValue    string      `json:"keyValue"`
		LocationIDs []uuid.UUID `json:"locationIds"`
	}
	if err = decodeJSON(r, &body); err != nil {
		respondError(w, http.StatusBadRequest, "invalid body")
		return
	}

	_, err = h.Store.GetKey(ctx, keyID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "key not found")
			return
		}
		h.Logger.Error("load key", "err", err, "key", keyID)
		respondError(w, http.StatusInternalServerError, "failed to load key")
		return
	}

	key, err := h.Store.UpdateKey(ctx, sqlc.UpdateKeyParams{
		ID:          keyID,
		Description: pgtype.Text{String: body.Description, Valid: body.Description != ""},
		KeyValue:    body.KeyValue,
		LocationIds: body.LocationIDs,
	})
	if err != nil {
		h.Logger.Error("update key", "err", err, "key", keyID)
		respondError(w, http.StatusInternalServerError, "failed to update key")
		return
	}

	var locs []locationDTO
	for _, lid := range body.LocationIDs {
		loc, getLocErr := h.Store.GetLocation(ctx, lid)
		if getLocErr == nil {
			locs = append(locs, mapLocation(loc, loc.GroupIds))
		}
	}

	respondJSON(w, http.StatusOK, keyDTO{
		ID:          key.ID,
		Description: key.Description.String,
		KeyValue:    key.KeyValue,
		CreatedAt:   key.CreatedAt.Time,
		Locations:   locs,
	})
}

func (h Handler) deleteKey(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	viewer, ok := sessionctx.User(ctx)
	if !ok || !viewer.IsAdmin {
		respondError(w, http.StatusForbidden, "admin required")
		return
	}
	keyID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid key id")
		return
	}
	if err = h.Store.DeleteKey(ctx, keyID); err != nil {
		h.Logger.Error("delete key", "err", err, "key", keyID)
		respondError(w, http.StatusInternalServerError, "failed to delete key")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h Handler) mapKey(ctx context.Context, key sqlc.Key) keyDTO {
	locIDs, _ := h.Store.ListKeyLocations(ctx, key.ID)
	var locs []locationDTO
	for _, lid := range locIDs {
		loc, getLocErr := h.Store.GetLocation(ctx, lid)
		if getLocErr == nil {
			locs = append(locs, mapLocation(loc, loc.GroupIds))
		}
	}
	return keyDTO{
		ID:          key.ID,
		Description: key.Description.String,
		KeyValue:    key.KeyValue,
		CreatedAt:   key.CreatedAt.Time,
		Locations:   locs,
	}
}

func generateKeyValue() string {
	const keyBytes = 24

	buf := make([]byte, keyBytes)
	if _, err := rand.Read(buf); err != nil {
		return uuid.NewString()
	}
	return base64.RawURLEncoding.EncodeToString(buf)
}
