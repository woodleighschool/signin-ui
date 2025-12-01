package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/woodleighschool/signin-ui/internal/auth"
	"github.com/woodleighschool/signin-ui/internal/config"
	"github.com/woodleighschool/signin-ui/internal/graph"
	httpapi "github.com/woodleighschool/signin-ui/internal/http"
	"github.com/woodleighschool/signin-ui/internal/store"
	"github.com/woodleighschool/signin-ui/internal/syncer"
)

const (
	shutdownTimeout     = 10 * time.Second
	requestReadTimeout  = 15 * time.Second
	requestWriteTimeout = 30 * time.Second
	idleTimeout         = 60 * time.Second
	syncInterval        = 15 * time.Minute
)

var (
	buildVersion = "dev"     //nolint:gochecknoglobals // injected at build time
	gitCommit    = "unknown" //nolint:gochecknoglobals // injected at build time
	buildDate    = "unknown" //nolint:gochecknoglobals // injected at build time
)

// main starts the server and blocks until it stops.
func main() {
	os.Exit(run())
}

func run() int {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg, err := config.Load()
	if err != nil {
		panic(err)
	}

	logger := newLogger(cfg.LogLevel)
	buildInfo := newBuildInfo()
	logger.InfoContext(ctx, "starting signin-ui",
		"version", buildInfo.Version,
		"commit", buildInfo.GitCommit,
		"build_date", buildInfo.BuildDate,
	)

	db, err := openStore(ctx, cfg, logger)
	if err != nil {
		return 1
	}
	defer db.Close()

	oidcProvider, sessions, err := setupAuth(ctx, cfg, logger)
	if err != nil {
		return 1
	}

	scheduler := scheduleSync(ctx, cfg, db, logger)
	defer scheduler.Stop()

	router := httpapi.NewAdminRouter(cfg, httpapi.AdminDeps{
		Store:        db,
		Logger:       logger,
		Sessions:     sessions,
		OIDCProvider: oidcProvider,
		BuildInfo:    buildInfo,
	})
	server := newHTTPServer(cfg.ListenAddr, router)

	return serve(ctx, logger, server)
}

func newBuildInfo() httpapi.BuildInfo {
	return httpapi.BuildInfo{
		Version:   buildVersion,
		GitCommit: gitCommit,
		BuildDate: buildDate,
	}
}

func openStore(ctx context.Context, cfg config.Config, logger *slog.Logger) (*store.Store, error) {
	db, err := store.Open(ctx, store.Options{
		URL:             cfg.DatabaseURL(),
		MaxConnections:  cfg.MaxConnections,
		MinConnections:  cfg.MinConnections,
		MaxConnLifetime: cfg.MaxConnLifetime,
	})
	if err != nil {
		logger.ErrorContext(ctx, "connect db", "err", err)
		return nil, err
	}
	if err = db.Migrate(ctx); err != nil {
		logger.ErrorContext(ctx, "run migrations", "err", err)
		return nil, err
	}
	return db, nil
}

func setupAuth(
	ctx context.Context,
	cfg config.Config,
	logger *slog.Logger,
) (*auth.OIDCProvider, *auth.SessionManager, error) {
	oidcProvider, err := auth.NewOIDCProvider(
		ctx,
		cfg.AdminIssuer,
		cfg.AdminClientID,
		cfg.AdminClientSecret,
		cfg.SiteBaseURL,
	)
	if err != nil {
		logger.ErrorContext(ctx, "oidc provider", "err", err)
		return nil, nil, err
	}

	sessions, err := auth.NewSessionManager(
		cfg.SessionCookieName,
		cfg.SessionSecret,
		strings.HasPrefix(cfg.SiteBaseURL, "https"),
	)
	if err != nil {
		logger.ErrorContext(ctx, "session manager", "err", err)
		return nil, nil, err
	}
	return oidcProvider, sessions, nil
}

func scheduleSync(ctx context.Context, cfg config.Config, db *store.Store, logger *slog.Logger) *syncer.Scheduler {
	scheduler := syncer.NewScheduler(logger)
	graphClient, err := graph.NewClient(ctx, cfg.GraphTenantID, cfg.GraphClientID, cfg.GraphClientSecret)
	if err != nil {
		logger.WarnContext(ctx, "graph client", "err", err)
	}
	if graphClient != nil && graphClient.Enabled() {
		addSyncJob(logger, scheduler, cfg.SyncCron, "entra-users", syncer.NewUserJob(db, graphClient, logger))
		addSyncJob(logger, scheduler, cfg.SyncCron, "entra-groups", syncer.NewGroupJob(db, graphClient, logger))
	}
	scheduler.Start()
	return scheduler
}

func addSyncJob(logger *slog.Logger, scheduler *syncer.Scheduler, cron, name string, job syncer.Job) {
	if err := scheduler.Add(cron, name, syncInterval, job); err != nil {
		logger.Warn("schedule sync job", "job", name, "err", err)
	}
}

func serve(ctx context.Context, logger *slog.Logger, server *http.Server) int {
	serverErrCh := startServer(logger, "http", server)

	var serveErr error

	select {
	case <-ctx.Done():
		logger.InfoContext(ctx, "shutdown signal received")
	case err := <-serverErrCh:
		if err != nil {
			logger.ErrorContext(ctx, "http server error", "err", err)
			serveErr = err
		}
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	if err := shutdownServer(shutdownCtx, logger, "http", server); err != nil {
		serveErr = err
	}

	// Wait for server goroutines before exiting.
	<-serverErrCh

	if serveErr != nil {
		return 1
	}
	return 0
}

// newLogger builds the slog logger.
func newLogger(level string) *slog.Logger {
	lvl := new(slog.LevelVar)
	switch strings.ToLower(level) {
	case "debug":
		lvl.Set(slog.LevelDebug)
	case "warn":
		lvl.Set(slog.LevelWarn)
	case "error":
		lvl.Set(slog.LevelError)
	default:
		lvl.Set(slog.LevelInfo)
	}
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: lvl})
	return slog.New(handler)
}

// newHTTPServer returns an HTTP server with configured timeouts.
func newHTTPServer(addr string, handler http.Handler) *http.Server {
	return &http.Server{
		Addr:         addr,
		Handler:      handler,
		ReadTimeout:  requestReadTimeout,
		WriteTimeout: requestWriteTimeout,
		IdleTimeout:  idleTimeout,
	}
}

// startServer runs the HTTP server in a goroutine.
func startServer(logger *slog.Logger, name string, server *http.Server) <-chan error {
	errCh := make(chan error, 1)
	go func() {
		defer close(errCh)
		logger.Info("listening", "server", name, "addr", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
			return
		}
		errCh <- nil
	}()
	return errCh
}

// shutdownServer tries a graceful stop.
func shutdownServer(ctx context.Context, logger *slog.Logger, name string, server *http.Server) error {
	if server == nil {
		return nil
	}
	if err := server.Shutdown(ctx); err != nil {
		logger.ErrorContext(ctx, "graceful shutdown failed", "server", name, "err", err)
		return err
	}
	logger.InfoContext(ctx, "server stopped", "server", name)
	return nil
}
