package syncer

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/woodleighschool/signin-ui/internal/graph"
	"github.com/woodleighschool/signin-ui/internal/store"
	"github.com/woodleighschool/signin-ui/internal/store/sqlc"
)

// NewGroupJob syncs Entra ID groups and memberships.
func NewGroupJob(store *store.Store, graphClient *graph.Client, logger *slog.Logger) Job {
	return func(ctx context.Context) error {
		if graphClient == nil || !graphClient.Enabled() {
			return graph.ErrNotConfigured
		}
		groups, err := graphClient.FetchGroups(ctx)
		if err != nil {
			return fmt.Errorf("fetch groups: %w", err)
		}
		for _, g := range groups {
			syncGroup(ctx, store, logger, g)
		}
		return nil
	}
}

func syncGroup(ctx context.Context, store *store.Store, logger *slog.Logger, g graph.DirectoryGroup) {
	groupID := parseGroupID(g.ObjectID)
	row, err := store.UpsertGroup(ctx, sqlc.UpsertGroupParams{
		ID:          groupID,
		DisplayName: g.DisplayName,
		Description: pgtype.Text{String: g.Description, Valid: g.Description != ""},
	})
	if err != nil {
		logger.ErrorContext(ctx, "upsert group", "group", g.DisplayName, "err", err)
		return
	}
	members := parseGroupMembers(g.Members)
	if len(members) == 0 {
		return
	}
	if err = store.ReplaceGroupMembers(ctx, row.ID, members); err != nil {
		logger.ErrorContext(ctx, "replace group members", "group", row.DisplayName, "err", err)
	}
}

func parseGroupMembers(memberIDs []string) []uuid.UUID {
	var members []uuid.UUID
	for _, memberID := range memberIDs {
		if parsed, err := uuid.Parse(memberID); err == nil {
			members = append(members, parsed)
		}
	}
	return members
}

func parseGroupID(objectID string) uuid.UUID {
	if objectID == "" {
		return uuid.New()
	}
	parsed, err := uuid.Parse(objectID)
	if err != nil {
		return uuid.New()
	}
	return parsed
}
