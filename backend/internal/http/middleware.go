package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/woodleighschool/signin-ui/internal/auth"
	"github.com/woodleighschool/signin-ui/internal/http/sessionctx"
	"github.com/woodleighschool/signin-ui/internal/store"
	"github.com/woodleighschool/signin-ui/internal/store/sqlc"
)

// AdminAuth checks the session cookie and stores it in context.
func AdminAuth(sessions *auth.SessionManager, logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if sessions == nil {
				writeError(w, http.StatusUnauthorized, "session manager missing")
				return
			}
			sess, err := sessions.Read(r)
			if err != nil {
				logger.Warn("unauthorized", "err", err)
				writeError(w, http.StatusUnauthorized, "auth required")
				return
			}
			ctx := sessionctx.WithSession(r.Context(), sess)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireAdmin loads the user and enforces the admin flag.
func RequireAdmin(store *store.Store, logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if store == nil {
				writeError(w, http.StatusInternalServerError, "store unavailable")
				return
			}
			user, ctxWithUser, err := loadCurrentUser(r, store)
			if err != nil {
				if logger != nil {
					logger.Warn("admin access denied", "err", err)
				}
				writeError(w, http.StatusUnauthorized, "auth required")
				return
			}
			if !user.IsAdmin {
				writeError(w, http.StatusForbidden, "admin access required")
				return
			}
			next.ServeHTTP(w, r.WithContext(ctxWithUser))
		})
	}
}

// LocationResolver extracts a location ID for access checks.
type LocationResolver func(r *http.Request) (uuid.UUID, error)

// RequireLocationAccess allows admins or users with location access.
func RequireLocationAccess(
	store *store.Store,
	logger *slog.Logger,
	resolve LocationResolver,
) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctxWithUser, status, msg := authorizeLocation(r, store, logger, resolve)
			if status != 0 {
				writeError(w, status, msg)
				return
			}
			next.ServeHTTP(w, r.WithContext(ctxWithUser))
		})
	}
}

// LoadUser fetches the current user into context.
func LoadUser(store *store.Store) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, ctxWithUser, err := loadCurrentUser(r, store)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "auth required")
				return
			}
			next.ServeHTTP(w, r.WithContext(ctxWithUser))
		})
	}
}

func loadCurrentUser(r *http.Request, store *store.Store) (sqlc.User, context.Context, error) {
	if user, ok := sessionctx.User(r.Context()); ok {
		return user, r.Context(), nil
	}
	sess, ok := sessionctx.Session(r.Context())
	if !ok {
		return sqlc.User{}, r.Context(), errors.New("missing session")
	}
	login := sessionLogin(sess)
	if login == "" {
		return sqlc.User{}, r.Context(), errors.New("missing login claim")
	}

	if login == "local:admin" {
		user := sqlc.User{
			ID:          uuid.Nil,
			Upn:         login,
			DisplayName: "Local Admin",
			IsAdmin:     true,
		}
		ctx := sessionctx.WithUser(r.Context(), user)
		return user, ctx, nil
	}

	user, err := store.GetUserByUPN(r.Context(), login)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			user, err = store.GetUserByLogin(r.Context(), login)
		}
	}
	if err != nil {
		return sqlc.User{}, r.Context(), err
	}
	ctx := sessionctx.WithUser(r.Context(), user)
	return user, ctx, nil
}

func sessionLogin(sess auth.Session) string {
	if upn := claimString(sess, "upn"); upn != "" {
		return upn
	}
	if preferred := claimString(sess, "preferred_username"); preferred != "" {
		return preferred
	}
	if email := claimString(sess, "email"); email != "" {
		return email
	}
	return strings.TrimSpace(sess.Subject)
}

func claimString(sess auth.Session, key string) string {
	if sess.Claims == nil {
		return ""
	}
	if val, ok := sess.Claims[key]; ok {
		if s, okVal := val.(string); okVal {
			return strings.TrimSpace(s)
		}
	}
	return ""
}

func authorizeLocation(
	r *http.Request,
	store *store.Store,
	logger *slog.Logger,
	resolve LocationResolver,
) (context.Context, int, string) {
	if store == nil {
		return r.Context(), http.StatusInternalServerError, "store unavailable"
	}
	user, ctxWithUser, err := loadCurrentUser(r, store)
	if err != nil {
		if logger != nil {
			logger.Warn("location access denied", "err", err)
		}
		return r.Context(), http.StatusUnauthorized, "auth required"
	}
	if user.IsAdmin {
		return ctxWithUser, 0, ""
	}
	if resolve == nil {
		return ctxWithUser, http.StatusBadRequest, "location resolver missing"
	}
	locationID, err := resolve(r)
	if err != nil {
		return ctxWithUser, http.StatusBadRequest, "invalid location"
	}
	hasAccess, err := store.HasUserLocationAccess(r.Context(), user.ID, locationID)
	if err != nil {
		return ctxWithUser, http.StatusInternalServerError, "failed to check access"
	}
	if !hasAccess {
		return ctxWithUser, http.StatusForbidden, "location access required"
	}
	return ctxWithUser, 0, ""
}
