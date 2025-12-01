-- name: CreateCheckin :one
INSERT INTO checkins (user_id, location_id, key_id, direction, notes, occurred_at)
VALUES ($1, $2, $3, $4, $5, COALESCE($6, NOW()))
RETURNING *;

-- name: ListCheckins :many
SELECT c.*
FROM checkins c
WHERE (
  sqlc.arg(is_admin)::boolean = TRUE
  OR EXISTS (
    SELECT 1
    FROM users u
    WHERE u.id = sqlc.arg(viewer_id)
      AND c.location_id = ANY(COALESCE(u.location_ids, '{}'))
  )
)
AND (
  sqlc.narg(location_id)::uuid IS NULL
  OR c.location_id = sqlc.narg(location_id)::uuid
)
AND (
  sqlc.narg(user_id)::uuid IS NULL
  OR c.user_id = sqlc.narg(user_id)::uuid
)
ORDER BY c.occurred_at DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: ListCheckinDetails :many
SELECT
  c.id,
  c.user_id,
  u.display_name AS user_display_name,
  u.upn          AS user_upn,
  u.department   AS user_department,
  c.location_id,
  l.name         AS location_name,
  l.identifier   AS location_identifier,
  c.key_id,
  c.direction,
  c.notes,
  c.occurred_at,
  c.created_at
FROM checkins c
JOIN users u ON c.user_id = u.id
JOIN locations l ON c.location_id = l.id
WHERE (
  sqlc.arg(is_admin)::boolean = TRUE
  OR EXISTS (
    SELECT 1
    FROM users u2
    WHERE u2.id = sqlc.arg(viewer_id)
      AND c.location_id = ANY(COALESCE(u2.location_ids, '{}'))
  )
)
AND (
  sqlc.narg(location_id)::uuid IS NULL
  OR c.location_id = sqlc.narg(location_id)::uuid
)
AND (
  sqlc.narg(user_id)::uuid IS NULL
  OR c.user_id = sqlc.narg(user_id)::uuid
)
ORDER BY c.occurred_at DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');
