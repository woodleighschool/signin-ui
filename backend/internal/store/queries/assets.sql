-- name: GetAsset :one
SELECT * FROM assets WHERE key =
$1;

-- name: UpsertAsset :one
INSERT INTO assets (key, content_type, data)
VALUES ($1, $2, $3)
ON CONFLICT (key) DO UPDATE
SET content_type = EXCLUDED.content_type,
    data = EXCLUDED.data,
    updated_at = NOW()
RETURNING *;

-- name: DeleteAsset :exec
DELETE FROM assets WHERE key = $1;
