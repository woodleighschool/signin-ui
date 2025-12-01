package admin

import (
	"encoding/json"
	"net/http"
)

type apiError struct {
	Error       string            `json:"error"`
	Code        string            `json:"code,omitempty"`
	FieldErrors map[string]string `json:"fieldErrors,omitempty"`
	Message     string            `json:"message,omitempty"`
}

// respondJSON writes JSON responses for admin endpoints.
func respondJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if payload == nil {
		return
	}
	_ = json.NewEncoder(w).Encode(payload)
}

// respondError returns a consistent error body.
func respondError(w http.ResponseWriter, status int, msg string) {
	if msg == "" {
		msg = http.StatusText(status)
	}
	respondJSON(w, status, apiError{
		Error:   msg,
		Message: msg,
		Code:    http.StatusText(status),
	})
}
