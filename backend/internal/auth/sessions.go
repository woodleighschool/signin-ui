package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
)

// ErrInvalidSession means the session cookie is invalid.
var ErrInvalidSession = errors.New("auth: invalid session")

const (
	defaultSessionTTL   = 8 * time.Hour
	minSessionSecretLen = 32
	signedTokenParts    = 2
)

// Session models the signed admin cookie.
type Session struct {
	Subject   string         `json:"sub"`
	IssuedAt  time.Time      `json:"iat"`
	ExpiresAt time.Time      `json:"exp"`
	Claims    map[string]any `json:"claims,omitempty"`
}

// SessionManager issues and validates the session cookie.
type SessionManager struct {
	name   string
	secret []byte
	maxAge time.Duration
	secure bool
}

// NewSessionManager builds a manager from cookie settings.
func NewSessionManager(cookieName, secret string, secure bool) (*SessionManager, error) {
	if len(secret) < minSessionSecretLen {
		return nil, errors.New("session secret must be at least 32 bytes")
	}
	return &SessionManager{
		name:   cookieName,
		secret: []byte(secret),
		maxAge: defaultSessionTTL,
		secure: secure,
	}, nil
}

// Issue signs the session into an HTTP cookie.
func (m *SessionManager) Issue(w http.ResponseWriter, session Session) error {
	if session.Subject == "" {
		return errors.New("session subject required")
	}
	if session.IssuedAt.IsZero() {
		session.IssuedAt = time.Now().UTC()
	}
	if session.ExpiresAt.IsZero() {
		session.ExpiresAt = session.IssuedAt.Add(m.maxAge)
	}
	payload, err := json.Marshal(session)
	if err != nil {
		return err
	}
	token, err := m.sign(payload)
	if err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name:     m.name,
		Value:    token,
		Path:     "/",
		Secure:   m.secure,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		Expires:  session.ExpiresAt,
	})
	return nil
}

// Clear deletes the session cookie.
func (m *SessionManager) Clear(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     m.name,
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		Secure:   m.secure,
		HttpOnly: true,
	})
}

// Read verifies and decodes the request cookie.
func (m *SessionManager) Read(r *http.Request) (Session, error) {
	cookie, err := r.Cookie(m.name)
	if err != nil {
		return Session{}, ErrInvalidSession
	}
	payload, err := m.verify(cookie.Value)
	if err != nil {
		return Session{}, err
	}
	var sess Session
	if err = json.Unmarshal(payload, &sess); err != nil {
		return Session{}, ErrInvalidSession
	}
	if time.Now().After(sess.ExpiresAt) {
		return Session{}, ErrInvalidSession
	}
	return sess, nil
}

// sign creates the HMAC-signed token.
func (m *SessionManager) sign(payload []byte) (string, error) {
	signer := hmac.New(sha256.New, m.secret)
	if _, err := signer.Write(payload); err != nil {
		return "", err
	}
	sig := signer.Sum(nil)
	return base64.RawURLEncoding.EncodeToString(payload) + "." + base64.RawURLEncoding.EncodeToString(sig), nil
}

// verify checks the HMAC signature and returns the payload.
func (m *SessionManager) verify(token string) ([]byte, error) {
	parts := strings.Split(token, ".")
	if len(parts) != signedTokenParts {
		return nil, ErrInvalidSession
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, ErrInvalidSession
	}
	expectedSig, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, ErrInvalidSession
	}
	signer := hmac.New(sha256.New, m.secret)
	signer.Write(payload)
	if !hmac.Equal(expectedSig, signer.Sum(nil)) {
		return nil, ErrInvalidSession
	}
	return payload, nil
}
