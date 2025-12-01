-- name: CreateKey :one
INSERT INTO keys (id, description, key_value, location_ids)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: UpdateKey :one
UPDATE keys
SET description = $2,
    key_value = $3,
    location_ids = $4,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteKey :exec
DELETE
FROM keys
WHERE id = $1;

-- name: GetKey :one
SELECT *
FROM keys
WHERE id = $1;

-- name: GetKeyByValue :one
SELECT *
FROM keys
WHERE key_value = $1;

-- name: MarkKeyUsed :one
UPDATE keys
SET last_used_at = NOW(),
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: ListKeys :many
SELECT k.*
FROM keys k
ORDER BY k.created_at DESC;

-- name: GetKeyLocationForIdentifier :one
SELECT k.id,
       k.description,
       k.key_value,
       k.location_ids,
       k.created_at,
       k.updated_at,
       k.last_used_at,
       l.id       AS location_id,
       l.name     AS location_name,
       l.identifier AS location_identifier,
       l.notes_enabled AS location_notes_enabled
FROM keys k
JOIN locations l ON l.id = ANY(k.location_ids)
WHERE k.key_value = $1
  AND LOWER(l.identifier) = LOWER($2);
