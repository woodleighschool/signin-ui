package admin

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/woodleighschool/signin-ui/internal/http/sessionctx"
	"github.com/woodleighschool/signin-ui/internal/store/sqlc"
)

type locationDTO struct {
	ID           uuid.UUID   `json:"id"`
	Name         string      `json:"name"`
	Identifier   string      `json:"identifier"`
	CreatedAt    time.Time   `json:"createdAt"`
	GroupIDs     []uuid.UUID `json:"groupIds"`
	NotesEnabled bool        `json:"notesEnabled"`
}

// locationsRoutes handles location CRUD.
func (h Handler) locationsRoutes(r chi.Router) {
	r.Get("/", h.listLocations)
	r.Get("/{id}", h.getLocation)
	r.Post("/", h.createLocation)
	r.Patch("/{id}", h.updateLocation)
	r.Delete("/{id}", h.deleteLocation)
}

func (h Handler) listLocations(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := sessionctx.User(ctx)
	if !ok {
		respondError(w, http.StatusUnauthorized, "auth required")
		return
	}
	search := strings.TrimSpace(r.URL.Query().Get("search"))
	var locs []sqlc.Location
	var err error
	if user.IsAdmin {
		locs, err = h.Store.ListLocations(ctx, search)
	} else {
		locs, err = h.Store.ListLocationsForUser(ctx, user.ID, false, search)
	}
	if err != nil {
		h.Logger.Error("list locations", "err", err)
		respondError(w, http.StatusInternalServerError, "failed to list locations")
		return
	}
	resp := make([]locationDTO, 0, len(locs))
	for _, l := range locs {
		resp = append(resp, mapLocation(l, l.GroupIds))
	}
	respondJSON(w, http.StatusOK, resp)
}

func (h Handler) getLocation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := sessionctx.User(ctx)
	if !ok {
		respondError(w, http.StatusUnauthorized, "auth required")
		return
	}
	locID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid location id")
		return
	}
	var loc sqlc.Location
	loc, err = h.Store.GetLocation(ctx, locID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "location not found")
			return
		}
		h.Logger.Error("get location", "err", err, "id", locID)
		respondError(w, http.StatusInternalServerError, "failed to load location")
		return
	}

	if !user.IsAdmin {
		hasAccess, accessErr := h.Store.HasUserLocationAccess(ctx, user.ID, locID)
		if accessErr != nil {
			h.Logger.Error("check location access", "err", accessErr, "user", user.ID, "location", locID)
			respondError(w, http.StatusInternalServerError, "failed to check access")
			return
		}
		if !hasAccess {
			respondError(w, http.StatusForbidden, "insufficient permissions")
			return
		}
	}

	respondJSON(w, http.StatusOK, mapLocation(loc, loc.GroupIds))
}

func (h Handler) createLocation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := sessionctx.User(ctx)
	if !ok || !user.IsAdmin {
		respondError(w, http.StatusForbidden, "admin required")
		return
	}
	var body struct {
		Name         string      `json:"name"`
		Identifier   string      `json:"identifier"`
		GroupIDs     []uuid.UUID `json:"groupIds"`
		NotesEnabled bool        `json:"notesEnabled"`
	}
	if err := decodeJSON(r, &body); err != nil {
		respondError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if strings.TrimSpace(body.Identifier) == "" {
		respondError(w, http.StatusBadRequest, "identifier is required")
		return
	}
	loc, err := h.Store.CreateLocation(ctx, sqlc.CreateLocationParams{
		ID:           uuid.New(),
		Name:         strings.TrimSpace(body.Name),
		Lower:        strings.ToLower(strings.TrimSpace(body.Identifier)),
		GroupIds:     body.GroupIDs,
		NotesEnabled: body.NotesEnabled,
	})
	if err != nil {
		h.Logger.Error("create location", "err", err)
		respondError(w, http.StatusInternalServerError, "failed to create location")
		return
	}
	respondJSON(w, http.StatusCreated, mapLocation(loc, loc.GroupIds))
}

func (h Handler) updateLocation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := sessionctx.User(ctx)
	if !ok || !user.IsAdmin {
		respondError(w, http.StatusForbidden, "admin required")
		return
	}
	locID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid location id")
		return
	}
	var body struct {
		Name         string      `json:"name"`
		Identifier   string      `json:"identifier"`
		GroupIDs     []uuid.UUID `json:"groupIds"`
		NotesEnabled bool        `json:"notesEnabled"`
	}
	err = decodeJSON(r, &body)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if strings.TrimSpace(body.Identifier) == "" {
		respondError(w, http.StatusBadRequest, "identifier is required")
		return
	}
	_, err = h.Store.GetLocation(ctx, locID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "location not found")
			return
		}
		h.Logger.Error("get location", "err", err, "id", locID)
		respondError(w, http.StatusInternalServerError, "failed to load location")
		return
	}
	var loc sqlc.Location

	loc, err = h.Store.UpdateLocation(ctx, sqlc.UpdateLocationParams{
		ID:           locID,
		Name:         strings.TrimSpace(body.Name),
		Lower:        strings.ToLower(strings.TrimSpace(body.Identifier)),
		GroupIds:     body.GroupIDs,
		NotesEnabled: body.NotesEnabled,
	})
	if err != nil {
		h.Logger.Error("update location", "err", err, "id", locID)
		respondError(w, http.StatusInternalServerError, "failed to update location")
		return
	}
	respondJSON(w, http.StatusOK, mapLocation(loc, loc.GroupIds))
}

func (h Handler) deleteLocation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := sessionctx.User(ctx)
	if !ok || !user.IsAdmin {
		respondError(w, http.StatusForbidden, "admin required")
		return
	}
	locID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid location id")
		return
	}
	if err = h.Store.DeleteLocation(ctx, locID); err != nil {
		h.Logger.Error("delete location", "err", err, "id", locID)
		respondError(w, http.StatusInternalServerError, "failed to delete location")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func mapLocation(loc sqlc.Location, groupIDs []uuid.UUID) locationDTO {
	return locationDTO{
		ID:           loc.ID,
		Name:         loc.Name,
		Identifier:   loc.Identifier,
		CreatedAt:    loc.CreatedAt.Time,
		GroupIDs:     groupIDs,
		NotesEnabled: loc.NotesEnabled,
	}
}
