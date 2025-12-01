package syncer

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/woodleighschool/signin-ui/internal/graph"
	"github.com/woodleighschool/signin-ui/internal/store"
	"github.com/woodleighschool/signin-ui/internal/store/sqlc"
)

// NewUserJob syncs Entra ID users into the store.
func NewUserJob(store *store.Store, graphClient *graph.Client, logger *slog.Logger) Job {
	return func(ctx context.Context) error {
		if graphClient == nil || !graphClient.Enabled() {
			return graph.ErrNotConfigured
		}
		users, err := graphClient.FetchUsers(ctx)
		if err != nil {
			return fmt.Errorf("fetch users: %w", err)
		}
		for _, u := range users {
			syncDirectoryUser(ctx, store, logger, u)
		}
		return nil
	}
}

// shouldSkipUser filters inactive or guest users.
func shouldSkipUser(u graph.DirectoryUser) bool {
	if !u.Active {
		return true
	}
	return strings.Contains(strings.ToUpper(u.UPN), "#EXT#")
}

// parseDirectoryUserID parses the Graph object ID.
func parseDirectoryUserID(objectID string) (uuid.UUID, bool) {
	if objectID == "" {
		return uuid.Nil, false
	}
	id, err := uuid.Parse(objectID)
	if err != nil {
		return uuid.Nil, false
	}
	return id, true
}

// deleteDirectoryUser removes a user by object ID or UPN.
func deleteDirectoryUser(
	ctx context.Context,
	store *store.Store,
	userID uuid.UUID,
	hasObjectID bool,
	upn string,
) error {
	if hasObjectID {
		return store.DeleteUser(ctx, userID)
	}
	if upn == "" {
		return nil
	}
	return store.DeleteUserByUPN(ctx, upn)
}

func syncDirectoryUser(ctx context.Context, store *store.Store, logger *slog.Logger, u graph.DirectoryUser) {
	if u.UPN == "" {
		return
	}
	userID, hasObjectID := parseDirectoryUserID(u.ObjectID)
	if shouldSkipUser(u) {
		if err := deleteDirectoryUser(ctx, store, userID, hasObjectID, u.UPN); err != nil {
			logger.ErrorContext(ctx, "delete user", "upn", u.UPN, "err", err)
		}
		return
	}
	if !hasObjectID {
		resolvedID, err := resolveUserID(ctx, store, u.UPN)
		if err != nil {
			logger.ErrorContext(ctx, "lookup user by UPN", "upn", u.UPN, "err", err)
			return
		}
		userID = resolvedID
	}
	if _, err := store.UpsertUser(ctx, sqlc.UpsertUserParams{
		ID:          userID,
		Upn:         u.UPN,
		DisplayName: u.DisplayName,
		ObjectID:    pgtype.Text{String: u.ObjectID, Valid: u.ObjectID != ""},
		Department:  pgtype.Text{String: u.Department, Valid: u.Department != ""},
		LocationIds: []uuid.UUID{},
	}); err != nil {
		logger.ErrorContext(ctx, "upsert user", "upn", u.UPN, "err", err)
	}
}

func resolveUserID(ctx context.Context, store *store.Store, upn string) (uuid.UUID, error) {
	existing, err := store.GetUserByUPN(ctx, upn)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return uuid.New(), nil
		}
		return uuid.Nil, err
	}
	return existing.ID, nil
}
