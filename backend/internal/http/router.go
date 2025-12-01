package httpapi

import (
	"log/slog"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/woodleighschool/signin-ui/internal/auth"
	"github.com/woodleighschool/signin-ui/internal/config"
	"github.com/woodleighschool/signin-ui/internal/http/admin"
	authhttp "github.com/woodleighschool/signin-ui/internal/http/auth"
	"github.com/woodleighschool/signin-ui/internal/http/portal"
	"github.com/woodleighschool/signin-ui/internal/store"
)

// AdminDeps bundles dependencies for the admin API and UI.
type AdminDeps struct {
	Store        *store.Store
	Logger       *slog.Logger
	Sessions     *auth.SessionManager
	OIDCProvider *auth.OIDCProvider
	BuildInfo    BuildInfo
}

// BuildInfo is returned to clients for display.
type BuildInfo struct {
	Version   string `json:"version"`
	GitCommit string `json:"git_commit"`
	BuildDate string `json:"build_date"`
}

const defaultRequestTimeout = 60 * time.Second

// NewAdminRouter wires the admin API, auth routes, and static UI.
func NewAdminRouter(cfg config.Config, deps AdminDeps) http.Handler {
	r := baseRouter()

	r.Get("/api/v1/status", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"status":  "ok",
			"version": deps.BuildInfo,
		})
	})

	api := chi.NewRouter()
	api.Use(AdminAuth(deps.Sessions, deps.Logger))
	api.Use(LoadUser(deps.Store))
	admin.RegisterRoutes(api, cfg, deps.Store, deps.Logger)
	r.Mount("/api", api)

	authRoutes := chi.NewRouter()
	authhttp.RegisterRoutes(authRoutes, cfg, deps.OIDCProvider, deps.Sessions, deps.Logger)
	r.Mount("/api/auth", authRoutes)

	portalRoutes := chi.NewRouter()
	portal.RegisterRoutes(portalRoutes, deps.Store, deps.Logger)
	r.Mount("/api/portal", portalRoutes)

	handler := http.Handler(r)
	if cfg.FrontendDistDir != "" {
		handler = mountStatic(cfg.FrontendDistDir, handler)
	}
	return handler
}

// baseRouter applies shared middleware.
func baseRouter() *chi.Mux {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(defaultRequestTimeout))
	return r
}

// mountStatic serves the frontend when the path is not under /api/.
func mountStatic(distDir string, apiHandler http.Handler) http.Handler {
	fileServer := http.FileServer(http.Dir(distDir))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			apiHandler.ServeHTTP(w, r)
			return
		}

		reqPath := path.Clean("/" + r.URL.Path)
		fullPath := filepath.Join(distDir, strings.TrimPrefix(reqPath, "/"))
		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			r.URL.Path = "/"
		}

		fileServer.ServeHTTP(w, r)
	})
}
