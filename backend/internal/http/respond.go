package httpapi

import (
	"encoding/json"
	"net/http"
)

// writeJSON renders JSON when payload is provided.
func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if payload == nil {
		return
	}
	_ = json.NewEncoder(w).Encode(payload)
}

// writeError writes a simple JSON error body.
func writeError(w http.ResponseWriter, status int, msg string) {
	if msg == "" {
		msg = http.StatusText(status)
	}
	writeJSON(w, status, map[string]any{
		"error":   msg,
		"message": msg,
		"code":    http.StatusText(status),
	})
}
