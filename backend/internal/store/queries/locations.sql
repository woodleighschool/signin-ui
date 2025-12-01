-- name: CreateLocation :one
INSERT INTO locations (id, name, identifier, group_ids, notes_enabled)
VALUES ($1, $2, LOWER($3), $4, $5)
RETURNING *;

-- name: UpdateLocation :one
UPDATE locations
SET name = $2,
    identifier = LOWER($3),
    group_ids = $4,
    notes_enabled = $5,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteLocation :exec
DELETE
FROM locations
WHERE id = $1;

-- name: GetLocation :one
SELECT *
FROM locations
WHERE id = $1;

-- name: GetLocationByIdentifier :one
SELECT *
FROM locations
WHERE LOWER(identifier) = LOWER($1);

-- name: ListLocations :many
SELECT *
FROM locations
WHERE CASE
        WHEN sqlc.arg(search)::text = '' THEN TRUE
        ELSE (
          name ILIKE '%' || sqlc.arg(search)::text || '%'
          OR identifier ILIKE '%' || sqlc.arg(search)::text || '%'
        )
      END
ORDER BY name, identifier;

-- name: ListLocationsForUser :many
SELECT l.*
FROM locations l
WHERE (
  sqlc.arg(is_admin)::bool = TRUE
  OR l.id = ANY(
    SELECT u.location_ids FROM users u WHERE u.id = sqlc.arg(user_id)
  )
)
AND (
  CASE
    WHEN sqlc.arg(search)::text = '' THEN TRUE
    ELSE (
      l.name ILIKE '%' || sqlc.arg(search)::text || '%'
      OR l.identifier ILIKE '%' || sqlc.arg(search)::text || '%'
    )
  END
)
ORDER BY l.name, l.identifier;
