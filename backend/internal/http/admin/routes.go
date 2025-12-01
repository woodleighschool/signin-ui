package admin

import (
	"log/slog"

	"github.com/go-chi/chi/v5"
	"github.com/woodleighschool/signin-ui/internal/config"
	"github.com/woodleighschool/signin-ui/internal/store"
)

// Handler carries admin handlers and shared deps.
type Handler struct {
	Store  *store.Store
	Logger *slog.Logger
	Config config.Config
}

// RegisterRoutes mounts admin endpoints under /v1.
func RegisterRoutes(r chi.Router, cfg config.Config, store *store.Store, logger *slog.Logger) {
	h := Handler{Store: store, Logger: logger, Config: cfg}
	r.Route("/v1", func(r chi.Router) {
		r.Route("/locations", h.locationsRoutes)
		r.Route("/keys", h.keysRoutes)
		r.Route("/users", h.usersRoutes)
		r.Route("/groups", h.groupsRoutes)
		r.Route("/checkins", h.checkinsRoutes)
		r.Route("/settings", h.settingsRoutes)
	})
}
