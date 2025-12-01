-- name: SetUserLocations :exec
UPDATE users
SET location_ids = $2,
    updated_at = NOW()
WHERE id = $1;

-- name: ListUserLocationIDs :many
SELECT UNNEST(location_ids)::uuid AS location_id
FROM users
WHERE id = $1;

-- name: ListUsersForLocation :many
SELECT u.*
FROM users u
WHERE u.location_ids @> ARRAY[$1::uuid]
ORDER BY u.display_name, u.upn;

-- name: HasUserLocationAccess :one
SELECT $2::uuid = ANY(u.location_ids)
FROM users u
WHERE u.id = $1;
