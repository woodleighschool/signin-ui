package store

import (
	"context"
	"slices"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/woodleighschool/signin-ui/internal/store/sqlc"
)

func (s *Store) ListUsers(ctx context.Context, search string) ([]sqlc.User, error) {
	return s.queries.ListUsers(ctx, strings.TrimSpace(search))
}

func (s *Store) ListUsersForLocations(
	ctx context.Context,
	isAdmin bool,
	locationIDs []uuid.UUID,
	search string,
) ([]sqlc.User, error) {
	return s.queries.ListUsersForLocations(ctx, sqlc.ListUsersForLocationsParams{
		IsAdmin:     isAdmin,
		LocationIds: locationIDs,
		Search:      strings.TrimSpace(search),
	})
}

func (s *Store) GetUser(ctx context.Context, id uuid.UUID) (sqlc.User, error) {
	return s.queries.GetUser(ctx, id)
}

func (s *Store) GetUserByUPN(ctx context.Context, upn string) (sqlc.User, error) {
	return s.queries.GetUserByUPN(ctx, upn)
}

func (s *Store) GetUserByLogin(ctx context.Context, login string) (sqlc.User, error) {
	return s.queries.GetUserByLogin(ctx, login)
}

func (s *Store) DeleteUser(ctx context.Context, id uuid.UUID) error {
	return s.queries.DeleteUser(ctx, id)
}

func (s *Store) DeleteUserByUPN(ctx context.Context, upn string) error {
	return s.queries.DeleteUserByUPN(ctx, upn)
}

func (s *Store) UpsertUser(ctx context.Context, user sqlc.UpsertUserParams) (sqlc.User, error) {
	return s.queries.UpsertUser(ctx, user)
}

// UpdateUserAccess changes admin flag and locations in one transaction.
func (s *Store) UpdateUserAccess(
	ctx context.Context,
	userID uuid.UUID,
	isAdmin *bool,
	locationIDs *[]uuid.UUID,
) (sqlc.User, error) {
	var updated sqlc.User
	err := s.WithTx(ctx, func(tx pgx.Tx) error {
		q := sqlc.New(tx)
		existing, err := q.GetUser(ctx, userID)
		if err != nil {
			return err
		}

		params := sqlc.UpsertUserParams{
			ID:          existing.ID,
			Upn:         existing.Upn,
			DisplayName: existing.DisplayName,
			ObjectID:    existing.ObjectID,
			Department:  existing.Department,
			IsAdmin:     existing.IsAdmin,
			LocationIds: existing.LocationIds,
		}
		if isAdmin != nil {
			params.IsAdmin = *isAdmin
		}
		if locationIDs != nil {
			params.LocationIds = *locationIDs
		}

		updated, err = q.UpsertUser(ctx, params)
		return err
	})
	return updated, err
}

func (s *Store) ListGroups(ctx context.Context, search string) ([]sqlc.Group, error) {
	return s.queries.ListGroups(ctx, strings.TrimSpace(search))
}

func (s *Store) GetGroup(ctx context.Context, id uuid.UUID) (sqlc.Group, error) {
	return s.queries.GetGroup(ctx, id)
}

func (s *Store) GetUserGroups(ctx context.Context, userID uuid.UUID) ([]sqlc.Group, error) {
	return s.queries.GetUserGroups(ctx, userID)
}

func (s *Store) UpsertGroup(ctx context.Context, group sqlc.UpsertGroupParams) (sqlc.Group, error) {
	return s.queries.UpsertGroup(ctx, group)
}

func (s *Store) DeleteGroup(ctx context.Context, id uuid.UUID) error {
	return s.queries.DeleteGroup(ctx, id)
}

// ReplaceGroupMembers resets a group's members in one transaction.
func (s *Store) ReplaceGroupMembers(ctx context.Context, groupID uuid.UUID, userIDs []uuid.UUID) error {
	return s.WithTx(ctx, func(tx pgx.Tx) error {
		queries := sqlc.New(tx)
		if err := queries.DeleteGroupMembers(ctx, groupID); err != nil {
			return err
		}
		for _, userID := range userIDs {
			if err := queries.AddGroupMember(ctx, sqlc.AddGroupMemberParams{
				GroupID: groupID,
				UserID:  userID,
			}); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *Store) ListGroupMemberIDs(ctx context.Context, groupID uuid.UUID) ([]uuid.UUID, error) {
	return s.queries.ListGroupMemberIDs(ctx, groupID)
}

func (s *Store) ListGroupMembers(ctx context.Context, groupID uuid.UUID) ([]sqlc.User, error) {
	return s.queries.ListGroupMembers(ctx, groupID)
}

func (s *Store) ListUserLocationIDs(ctx context.Context, userID uuid.UUID) ([]uuid.UUID, error) {
	return s.queries.ListUserLocationIDs(ctx, userID)
}

func (s *Store) HasUserLocationAccess(ctx context.Context, userID, locationID uuid.UUID) (bool, error) {
	return s.queries.HasUserLocationAccess(ctx, sqlc.HasUserLocationAccessParams{
		ID:      userID,
		Column2: locationID,
	})
}

func (s *Store) SetUserLocations(ctx context.Context, userID uuid.UUID, locationIDs []uuid.UUID) error {
	return s.queries.SetUserLocations(ctx, sqlc.SetUserLocationsParams{
		ID:          userID,
		LocationIds: locationIDs,
	})
}

func (s *Store) AddUserLocationAccess(ctx context.Context, userID, locationID uuid.UUID) error {
	current, err := s.ListUserLocationIDs(ctx, userID)
	if err != nil {
		return err
	}
	if slices.Contains(current, locationID) {
		return nil
	}
	current = append(current, locationID)
	return s.queries.SetUserLocations(ctx, sqlc.SetUserLocationsParams{
		ID:          userID,
		LocationIds: current,
	})
}

func (s *Store) RemoveUserLocationAccess(ctx context.Context, userID, locationID uuid.UUID) error {
	locations, err := s.ListUserLocationIDs(ctx, userID)
	if err != nil {
		return err
	}
	var filtered []uuid.UUID
	for _, id := range locations {
		if id != locationID {
			filtered = append(filtered, id)
		}
	}
	return s.queries.SetUserLocations(ctx, sqlc.SetUserLocationsParams{
		ID:          userID,
		LocationIds: filtered,
	})
}

func (s *Store) DeleteAccessForUser(ctx context.Context, userID uuid.UUID) error {
	return s.queries.SetUserLocations(ctx, sqlc.SetUserLocationsParams{
		ID:          userID,
		LocationIds: []uuid.UUID{},
	})
}

func (s *Store) ListUsersForLocation(ctx context.Context, locationID uuid.UUID) ([]sqlc.User, error) {
	return s.queries.ListUsersForLocation(ctx, locationID)
}

// ListLocationGroupIDs returns the group IDs for a location.
func (s *Store) ListLocationGroupIDs(ctx context.Context, locationID uuid.UUID) ([]uuid.UUID, error) {
	loc, err := s.GetLocation(ctx, locationID)
	if err != nil {
		return nil, err
	}
	return loc.GroupIds, nil
}

func (s *Store) ReplaceLocationGroups(ctx context.Context, locationID uuid.UUID, groupIDs []uuid.UUID) error {
	loc, err := s.GetLocation(ctx, locationID)
	if err != nil {
		return err
	}
	_, err = s.queries.UpdateLocation(ctx, sqlc.UpdateLocationParams{
		ID:           locationID,
		Name:         loc.Name,
		Lower:        loc.Identifier,
		GroupIds:     groupIDs,
		NotesEnabled: loc.NotesEnabled,
	})
	return err
}

func (s *Store) ListUsersForGroups(ctx context.Context, groupIDs []uuid.UUID) ([]sqlc.User, error) {
	seen := make(map[uuid.UUID]struct{})
	var users []sqlc.User

	for _, gid := range groupIDs {
		members, err := s.queries.ListGroupMembers(ctx, gid)
		if err != nil {
			return nil, err
		}
		for _, m := range members {
			if _, ok := seen[m.ID]; ok {
				continue
			}
			seen[m.ID] = struct{}{}
			users = append(users, m)
		}
	}

	return users, nil
}

func (s *Store) CreateLocation(ctx context.Context, params sqlc.CreateLocationParams) (sqlc.Location, error) {
	return s.queries.CreateLocation(ctx, params)
}

func (s *Store) UpdateLocation(ctx context.Context, params sqlc.UpdateLocationParams) (sqlc.Location, error) {
	return s.queries.UpdateLocation(ctx, params)
}

func (s *Store) DeleteLocation(ctx context.Context, id uuid.UUID) error {
	return s.queries.DeleteLocation(ctx, id)
}

func (s *Store) GetLocation(ctx context.Context, id uuid.UUID) (sqlc.Location, error) {
	return s.queries.GetLocation(ctx, id)
}

func (s *Store) GetLocationByIdentifier(ctx context.Context, identifier string) (sqlc.Location, error) {
	return s.queries.GetLocationByIdentifier(ctx, identifier)
}

func (s *Store) ListLocations(ctx context.Context, search string) ([]sqlc.Location, error) {
	return s.queries.ListLocations(ctx, strings.TrimSpace(search))
}

func (s *Store) ListLocationsForUser(
	ctx context.Context,
	userID uuid.UUID,
	isAdmin bool,
	search string,
) ([]sqlc.Location, error) {
	return s.queries.ListLocationsForUser(ctx, sqlc.ListLocationsForUserParams{
		UserID:  userID,
		IsAdmin: isAdmin,
		Search:  strings.TrimSpace(search),
	})
}

func (s *Store) CreateKey(ctx context.Context, params sqlc.CreateKeyParams) (sqlc.Key, error) {
	return s.queries.CreateKey(ctx, params)
}

func (s *Store) UpdateKey(ctx context.Context, params sqlc.UpdateKeyParams) (sqlc.Key, error) {
	return s.queries.UpdateKey(ctx, params)
}

func (s *Store) DeleteKey(ctx context.Context, id uuid.UUID) error {
	return s.queries.DeleteKey(ctx, id)
}

func (s *Store) GetKey(ctx context.Context, id uuid.UUID) (sqlc.Key, error) {
	return s.queries.GetKey(ctx, id)
}

func (s *Store) GetKeyByValue(ctx context.Context, keyValue string) (sqlc.Key, error) {
	return s.queries.GetKeyByValue(ctx, keyValue)
}

func (s *Store) MarkKeyUsed(ctx context.Context, id uuid.UUID) (sqlc.Key, error) {
	return s.queries.MarkKeyUsed(ctx, id)
}

func (s *Store) ListKeys(ctx context.Context) ([]sqlc.Key, error) {
	return s.queries.ListKeys(ctx)
}

func (s *Store) ListKeyLocations(ctx context.Context, keyID uuid.UUID) ([]uuid.UUID, error) {
	key, err := s.GetKey(ctx, keyID)
	if err != nil {
		return nil, err
	}
	return key.LocationIds, nil
}

func (s *Store) ReplaceKeyLocations(ctx context.Context, keyID uuid.UUID, locationIDs []uuid.UUID) error {
	key, err := s.GetKey(ctx, keyID)
	if err != nil {
		return err
	}
	_, err = s.queries.UpdateKey(ctx, sqlc.UpdateKeyParams{
		ID:          keyID,
		Description: key.Description,
		KeyValue:    key.KeyValue,
		LocationIds: locationIDs,
	})
	return err
}

func (s *Store) GetKeyLocationForIdentifier(
	ctx context.Context,
	keyValue, identifier string,
) (sqlc.GetKeyLocationForIdentifierRow, error) {
	return s.queries.GetKeyLocationForIdentifier(ctx, sqlc.GetKeyLocationForIdentifierParams{
		KeyValue: keyValue,
		Lower:    strings.ToLower(strings.TrimSpace(identifier)),
	})
}

func (s *Store) CreateCheckin(ctx context.Context, params sqlc.CreateCheckinParams) (sqlc.Checkin, error) {
	return s.queries.CreateCheckin(ctx, params)
}

func (s *Store) ListCheckins(
	ctx context.Context,
	isAdmin bool,
	viewerID uuid.UUID,
	locationID, userID uuid.NullUUID,
	limit, offset int32,
) ([]sqlc.Checkin, error) {
	return s.queries.ListCheckins(ctx, sqlc.ListCheckinsParams{
		IsAdmin:  isAdmin,
		ViewerID: viewerID,
		LocationID: pgtype.UUID{
			Bytes: nullUUID(locationID),
			Valid: locationID.Valid,
		},
		UserID: pgtype.UUID{
			Bytes: nullUUID(userID),
			Valid: userID.Valid,
		},
		Limit:  limit,
		Offset: offset,
	})
}

func (s *Store) ListCheckinDetails(
	ctx context.Context,
	isAdmin bool,
	viewerID uuid.UUID,
	locationID, userID uuid.NullUUID,
	limit, offset int32,
) ([]sqlc.ListCheckinDetailsRow, error) {
	return s.queries.ListCheckinDetails(ctx, sqlc.ListCheckinDetailsParams{
		IsAdmin:  isAdmin,
		ViewerID: viewerID,
		LocationID: pgtype.UUID{
			Bytes: nullUUID(locationID),
			Valid: locationID.Valid,
		},
		UserID: pgtype.UUID{
			Bytes: nullUUID(userID),
			Valid: userID.Valid,
		},
		Limit:  limit,
		Offset: offset,
	})
}

// UpsertUserAdmin updates only the admin flag.
func (s *Store) UpsertUserAdmin(ctx context.Context, userID uuid.UUID, isAdmin bool) (sqlc.User, error) {
	user, err := s.GetUser(ctx, userID)
	if err != nil {
		return sqlc.User{}, err
	}
	return s.UpsertUser(ctx, sqlc.UpsertUserParams{
		ID:          userID,
		Upn:         user.Upn,
		DisplayName: user.DisplayName,
		ObjectID:    user.ObjectID,
		Department:  user.Department,
		IsAdmin:     isAdmin,
		LocationIds: user.LocationIds,
	})
}

// TouchUser bumps updated_at with minimal changes.
func (s *Store) TouchUser(ctx context.Context, userID uuid.UUID) (sqlc.User, error) {
	user, err := s.GetUser(ctx, userID)
	if err != nil {
		return sqlc.User{}, err
	}
	return s.UpsertUser(ctx, sqlc.UpsertUserParams{
		ID:          userID,
		Upn:         user.Upn,
		DisplayName: user.DisplayName,
		ObjectID:    user.ObjectID,
		Department:  user.Department,
		IsAdmin:     user.IsAdmin,
		LocationIds: user.LocationIds,
	})
}

func (s *Store) SaveAsset(ctx context.Context, key, contentType string, data []byte) (sqlc.Asset, error) {
	return s.queries.UpsertAsset(ctx, sqlc.UpsertAssetParams{
		Key:         key,
		ContentType: contentType,
		Data:        data,
	})
}

func (s *Store) GetAsset(ctx context.Context, key string) (sqlc.Asset, error) {
	return s.queries.GetAsset(ctx, key)
}

func (s *Store) DeleteAsset(ctx context.Context, key string) error {
	return s.queries.DeleteAsset(ctx, key)
}

func nullUUID(v uuid.NullUUID) uuid.UUID {
	if v.Valid {
		return v.UUID
	}
	return uuid.Nil
}
