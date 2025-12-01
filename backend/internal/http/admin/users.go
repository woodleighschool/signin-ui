package admin

import (
	"encoding/json"
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

type userDTO struct {
	ID          uuid.UUID `json:"id"`
	UPN         string    `json:"upn"`
	DisplayName string    `json:"displayName"`
	Department  string    `json:"department,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	IsAdmin     bool      `json:"isAdmin"`
}

type userDetailResponse struct {
	User          userDTO     `json:"user"`
	LocationIDs   []uuid.UUID `json:"locationIds"`
	Groups        []groupDTO  `json:"groups"`
	AccessibleIDs []uuid.UUID `json:"accessibleLocationIds"`
}

type updateUserRequest struct {
	IsAdmin     *bool        `json:"isAdmin"`
	LocationIDs *[]uuid.UUID `json:"locationIds"`
}

// usersRoutes registers directory and access endpoints.
func (h Handler) usersRoutes(r chi.Router) {
	r.Get("/", h.listUsers)
	r.Get("/{id}", h.userDetails)
	r.Patch("/{id}", h.updateUser)
}

// listUsers returns users for admin callers.
func (h Handler) listUsers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	viewer, ok := sessionctx.User(ctx)
	if !ok || !viewer.IsAdmin {
		respondError(w, http.StatusForbidden, "admin required")
		return
	}
	search := strings.TrimSpace(r.URL.Query().Get("search"))
	users, err := h.Store.ListUsers(ctx, search)
	if err != nil {
		h.Logger.Error("list users", "err", err)
		respondError(w, http.StatusInternalServerError, "failed to list users")
		return
	}
	respondJSON(w, http.StatusOK, mapUserList(users))
}

// userDetails returns user details and access info.
func (h Handler) userDetails(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	viewer, ok := sessionctx.User(ctx)
	if !ok || !viewer.IsAdmin {
		respondError(w, http.StatusForbidden, "admin required")
		return
	}
	userID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	user, err := h.Store.GetUser(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "user not found")
			return
		}
		h.Logger.Error("get user", "err", err, "user", userID)
		respondError(w, http.StatusInternalServerError, "failed to load user")
		return
	}

	userLocs, err := h.Store.ListUserLocationIDs(ctx, user.ID)
	if err != nil {
		h.Logger.Error("list user locations", "err", err, "user", userID)
		respondError(w, http.StatusInternalServerError, "failed to load access")
		return
	}
	groups, err := h.Store.GetUserGroups(ctx, user.ID)
	if err != nil {
		h.Logger.Error("get user groups", "err", err, "user", userID)
		respondError(w, http.StatusInternalServerError, "failed to load groups")
		return
	}

	resp := userDetailResponse{
		User:          mapUserDTO(user),
		LocationIDs:   userLocs,
		Groups:        mapGroups(groups),
		AccessibleIDs: []uuid.UUID{},
	}
	respondJSON(w, http.StatusOK, resp)
}

// updateUser updates admin and access fields for a user.
func (h Handler) updateUser(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	viewer, ok := sessionctx.User(ctx)
	if !ok || !viewer.IsAdmin {
		respondError(w, http.StatusForbidden, "admin required")
		return
	}
	userID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	var body updateUserRequest
	if err = decodeJSON(r, &body); err != nil {
		respondError(w, http.StatusBadRequest, "invalid body")
		return
	}

	if body.IsAdmin == nil && body.LocationIDs == nil {
		respondError(w, http.StatusBadRequest, "no fields to update")
		return
	}

	updated, err := h.Store.UpdateUserAccess(ctx, userID, body.IsAdmin, body.LocationIDs)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "user not found")
			return
		}
		h.Logger.Error("update user", "err", err, "user", userID)
		respondError(w, http.StatusInternalServerError, "failed to update user")
		return
	}
	groups, _ := h.Store.GetUserGroups(ctx, updated.ID)

	respondJSON(w, http.StatusOK, userDetailResponse{
		User:          mapUserDTO(updated),
		LocationIDs:   updated.LocationIds,
		Groups:        mapGroups(groups),
		AccessibleIDs: []uuid.UUID{},
	})
}

func mapUserDTO(u sqlc.User) userDTO {
	var created, updated time.Time
	if u.CreatedAt.Valid {
		created = u.CreatedAt.Time
	}
	if u.UpdatedAt.Valid {
		updated = u.UpdatedAt.Time
	}
	return userDTO{
		ID:          u.ID,
		UPN:         u.Upn,
		DisplayName: u.DisplayName,
		Department:  u.Department.String,
		CreatedAt:   created,
		UpdatedAt:   updated,
		IsAdmin:     u.IsAdmin,
	}
}

func mapUserList(users []sqlc.User) []userDTO {
	resp := make([]userDTO, 0, len(users))
	for _, u := range users {
		resp = append(resp, mapUserDTO(u))
	}
	return resp
}

func mapGroups(groups []sqlc.Group) []groupDTO {
	resp := make([]groupDTO, 0, len(groups))
	for _, g := range groups {
		resp = append(resp, groupDTO{
			ID:          g.ID,
			DisplayName: g.DisplayName,
			Description: g.Description.String,
		})
	}
	return resp
}

func decodeJSON(r *http.Request, dest any) error {
	return json.NewDecoder(r.Body).Decode(dest)
}
