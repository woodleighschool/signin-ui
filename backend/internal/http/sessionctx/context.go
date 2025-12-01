package sessionctx

import (
	"context"

	"github.com/woodleighschool/signin-ui/internal/auth"
	"github.com/woodleighschool/signin-ui/internal/store/sqlc"
)

type contextKey string

const (
	SessionKey contextKey = "session"
	UserKey    contextKey = "currentUser"
)

// WithSession adds the auth session to context.
func WithSession(ctx context.Context, sess auth.Session) context.Context {
	return context.WithValue(ctx, SessionKey, sess)
}

// Session pulls the session from context.
func Session(ctx context.Context) (auth.Session, bool) {
	val := ctx.Value(SessionKey)
	if val == nil {
		return auth.Session{}, false
	}
	sess, ok := val.(auth.Session)
	return sess, ok
}

// WithUser adds the loaded user to context.
func WithUser(ctx context.Context, user sqlc.User) context.Context {
	return context.WithValue(ctx, UserKey, user)
}

// User pulls the loaded user from context.
func User(ctx context.Context) (sqlc.User, bool) {
	val := ctx.Value(UserKey)
	if val == nil {
		return sqlc.User{}, false
	}
	user, ok := val.(sqlc.User)
	return user, ok
}
