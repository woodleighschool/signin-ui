package config

import (
	"fmt"
	"net"
	"time"

	"github.com/caarlos0/env/v11"
)

// Config holds runtime settings loaded from env.
type Config struct {
	ListenAddr           string        `env:"LISTEN_ADDR"                       envDefault:":8080"`
	DatabaseHost         string        `env:"DATABASE_HOST,required"`
	DatabasePort         string        `env:"DATABASE_PORT"                     envDefault:"5432"`
	DatabaseName         string        `env:"DATABASE_NAME,required"`
	DatabaseUser         string        `env:"DATABASE_USER,required"`
	DatabasePassword     string        `env:"DATABASE_PASSWORD,required"`
	DatabaseSSLMode      string        `env:"DATABASE_SSLMODE"                  envDefault:"disable"`
	MaxConnLifetime      time.Duration `env:"DB_MAX_CONN_LIFETIME"              envDefault:"30m"`
	MaxConnections       int32         `env:"DB_MAX_CONNECTIONS"                envDefault:"10"`
	MinConnections       int32         `env:"DB_MIN_CONNECTIONS"                envDefault:"2"`
	AdminIssuer          string        `env:"ADMIN_OIDC_ISSUER,required"`
	AdminClientID        string        `env:"ADMIN_OIDC_CLIENT_ID,required"`
	AdminClientSecret    string        `env:"ADMIN_OIDC_CLIENT_SECRET,required"`
	SessionSecret        string        `env:"SESSION_SECRET,required"`
	SessionCookieName    string        `env:"SESSION_COOKIE_NAME"               envDefault:"signin-ui_session"`
	InitialAdminPassword string        `env:"INITIAL_ADMIN_PASSWORD"`
	SyncCron             string        `env:"SYNC_CRON"                         envDefault:"@every 5m"`
	SiteBaseURL          string        `env:"SITE_BASE_URL,required"`
	GraphTenantID        string        `env:"GRAPH_TENANT_ID"`
	GraphClientID        string        `env:"GRAPH_CLIENT_ID"`
	GraphClientSecret    string        `env:"GRAPH_CLIENT_SECRET"`
	LogLevel             string        `env:"LOG_LEVEL"                         envDefault:"info"`
	FrontendDistDir      string        `env:"FRONTEND_DIST_DIR"`
}

// Load populates Config from environment variables.
func Load() (Config, error) {
	var cfg Config
	if err := env.Parse(&cfg); err != nil {
		return Config{}, fmt.Errorf("parse config: %w", err)
	}
	return cfg, nil
}

// DatabaseURL builds the Postgres DSN.
func (c Config) DatabaseURL() string {
	hostPort := net.JoinHostPort(c.DatabaseHost, c.DatabasePort)
	return fmt.Sprintf("postgres://%s:%s@%s/%s?sslmode=%s",
		c.DatabaseUser, c.DatabasePassword, hostPort, c.DatabaseName, c.DatabaseSSLMode)
}
