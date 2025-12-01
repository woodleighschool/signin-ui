package auth

import (
	"context"
	"fmt"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

// OIDCProvider bundles the OAuth client and ID token verifier.
type OIDCProvider struct {
	verifier *oidc.IDTokenVerifier
	oauth    *oauth2.Config
}

// NewOIDCProvider prepares the OAuth config and verifier.
func NewOIDCProvider(ctx context.Context, issuer, clientID, clientSecret, siteBaseURL string) (*OIDCProvider, error) {
	provider, err := oidc.NewProvider(ctx, issuer)
	if err != nil {
		return nil, fmt.Errorf("discover oidc provider: %w", err)
	}
	config := &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  siteBaseURL + "/api/auth/callback",
		Endpoint:     provider.Endpoint(),
		Scopes:       []string{oidc.ScopeOpenID, "profile", "email"},
	}
	verifier := provider.Verifier(&oidc.Config{ClientID: clientID})
	return &OIDCProvider{verifier: verifier, oauth: config}, nil
}

// AuthCodeURL builds the login URL.
func (p *OIDCProvider) AuthCodeURL(state string, opts ...oauth2.AuthCodeOption) string {
	return p.oauth.AuthCodeURL(state, opts...)
}

// Exchange swaps the auth code for a token.
func (p *OIDCProvider) Exchange(ctx context.Context, code string) (*oauth2.Token, error) {
	return p.oauth.Exchange(ctx, code)
}

// VerifyIDToken checks the ID token signature and claims.
func (p *OIDCProvider) VerifyIDToken(ctx context.Context, raw string) (*oidc.IDToken, error) {
	return p.verifier.Verify(ctx, raw)
}

// OAuth2Config returns the raw OAuth configuration.
func (p *OIDCProvider) OAuth2Config() *oauth2.Config {
	return p.oauth
}
