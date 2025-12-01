package admin

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/woodleighschool/signin-ui/internal/http/sessionctx"
)

// checkinsRoutes serves read-only checkin listings.
func (h Handler) checkinsRoutes(r chi.Router) {
	r.Get("/", h.listCheckins)
}

func (h Handler) listCheckins(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	viewer, ok := sessionctx.User(ctx)
	if !ok {
		respondError(w, http.StatusUnauthorized, "auth required")
		return
	}

	locationID := parseNullUUID(r.URL.Query().Get("locationId"))
	userID := parseNullUUID(r.URL.Query().Get("userId"))
	const (
		defaultCheckinLimit  = int32(50)
		defaultCheckinOffset = int32(0)
	)

	limit := parseInt32(r.URL.Query().Get("limit"), defaultCheckinLimit)
	offset := parseInt32(r.URL.Query().Get("offset"), defaultCheckinOffset)

	records, err := h.Store.ListCheckinDetails(ctx, viewer.IsAdmin, viewer.ID, locationID, userID, limit, offset)
	if err != nil {
		h.Logger.Error("list checkins", "err", err)
		respondError(w, http.StatusInternalServerError, "failed to list checkins")
		return
	}

	resp := make([]map[string]any, 0, len(records))
	for _, c := range records {
		resp = append(resp, map[string]any{
			"id":                 c.ID,
			"userId":             c.UserID,
			"userDisplayName":    c.UserDisplayName,
			"userUpn":            c.UserUpn,
			"userDepartment":     c.UserDepartment.String,
			"locationId":         c.LocationID,
			"locationName":       c.LocationName,
			"locationIdentifier": c.LocationIdentifier,
			"keyId":              c.KeyID,
			"direction":          c.Direction,
			"notes":              c.Notes.String,
			"occurredAt":         c.OccurredAt,
			"createdAt":          c.CreatedAt,
		})
	}
	respondJSON(w, http.StatusOK, resp)
}

func parseNullUUID(value string) uuid.NullUUID {
	if value == "" {
		return uuid.NullUUID{}
	}
	id, err := uuid.Parse(value)
	if err != nil {
		return uuid.NullUUID{}
	}
	return uuid.NullUUID{UUID: id, Valid: true}
}
