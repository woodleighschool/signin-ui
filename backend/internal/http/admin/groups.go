package admin

import (
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/woodleighschool/signin-ui/internal/http/sessionctx"
)

// groupDTO matches what the admin UI needs.
type groupDTO struct {
	ID          uuid.UUID `json:"id"`
	DisplayName string    `json:"displayName"`
	Description string    `json:"description"`
}

// groupsRoutes registers group and membership endpoints.
func (h Handler) groupsRoutes(r chi.Router) {
	r.Get("/", h.listGroups)
	r.Get("/{id}/members", h.groupEffectiveMembers)
}

// listGroups returns directory groups with optional search.
func (h Handler) listGroups(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	viewer, ok := sessionctx.User(ctx)
	if !ok || !viewer.IsAdmin {
		respondError(w, http.StatusForbidden, "admin required")
		return
	}
	search := strings.TrimSpace(r.URL.Query().Get("search"))
	groups, err := h.Store.ListGroups(ctx, search)
	if err != nil {
		h.Logger.Error("list groups", "err", err)
		respondError(w, http.StatusInternalServerError, "failed to list groups")
		return
	}
	resp := make([]groupDTO, 0, len(groups))
	for _, g := range groups {
		resp = append(resp, groupDTO{
			ID:          g.ID,
			DisplayName: g.DisplayName,
			Description: g.Description.String,
		})
	}
	respondJSON(w, http.StatusOK, resp)
}

// groupEffectiveMembers returns a group's members with details.
func (h Handler) groupEffectiveMembers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	viewer, ok := sessionctx.User(ctx)
	if !ok || !viewer.IsAdmin {
		respondError(w, http.StatusForbidden, "admin required")
		return
	}
	groupID, err := parseUUIDParam(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid group id")
		return
	}
	group, err := h.Store.GetGroup(ctx, groupID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "group not found")
			return
		}
		h.Logger.Error("get group", "err", err, "group", groupID)
		respondError(w, http.StatusInternalServerError, "failed to load group")
		return
	}
	memberIDs, err := h.Store.ListGroupMemberIDs(ctx, groupID)
	if err != nil {
		h.Logger.Error("list group member ids", "err", err, "group", groupID)
		respondError(w, http.StatusInternalServerError, "failed to load membership ids")
		return
	}
	var members []userDTO
	if len(memberIDs) > 0 {
		users, listMembersErr := h.Store.ListGroupMembers(ctx, groupID)
		if listMembersErr != nil {
			h.Logger.Error("list group members", "err", listMembersErr, "group", groupID)
			respondError(w, http.StatusInternalServerError, "failed to load members")
			return
		}
		members = mapUserList(users)
	}
	resp := groupEffectiveMembersResponse{
		Group:     groupDTO{ID: group.ID, DisplayName: group.DisplayName, Description: group.Description.String},
		Members:   members,
		MemberIDs: memberIDs,
		Count:     len(memberIDs),
	}
	respondJSON(w, http.StatusOK, resp)
}

// groupEffectiveMembersResponse wraps members and IDs.
type groupEffectiveMembersResponse struct {
	Group     groupDTO    `json:"group"`
	Members   []userDTO   `json:"members"`
	MemberIDs []uuid.UUID `json:"member_ids"`
	Count     int         `json:"count"`
}
