package graph

import (
	"context"
	"errors"
	"fmt"

	msgraphusers "github.com/microsoftgraph/msgraph-sdk-go/users"
)

const graphUserPageSize = int32(100)

// DirectoryUser mirrors a user pulled from Entra ID.
type DirectoryUser struct {
	ObjectID    string
	UPN         string
	DisplayName string
	Active      bool
	Department  string
}

// FetchUsers reads users from Graph and normalises them.
func (c *Client) FetchUsers(ctx context.Context) ([]DirectoryUser, error) {
	if !c.enabled {
		return nil, ErrNotConfigured
	}
	if c.graph == nil {
		return nil, errors.New("graph client missing")
	}
	builder := c.graph.Users()
	adapter := c.graph.GetAdapter()
	selectFields := []string{"id", "userPrincipalName", "displayName", "department", "accountEnabled"}
	var users []DirectoryUser
	for {
		top := graphUserPageSize
		resp, err := builder.Get(ctx, &msgraphusers.UsersRequestBuilderGetRequestConfiguration{
			QueryParameters: &msgraphusers.UsersRequestBuilderGetQueryParameters{
				Top:    &top,
				Select: selectFields,
			},
		})
		if err != nil {
			return nil, fmt.Errorf("list users: %w", err)
		}
		for _, user := range resp.GetValue() {
			if user == nil {
				continue
			}
			active := true
			if enabled := user.GetAccountEnabled(); enabled != nil {
				active = *enabled
			}
			users = append(users, DirectoryUser{
				ObjectID:    deref(user.GetId()),
				UPN:         deref(user.GetUserPrincipalName()),
				DisplayName: deref(user.GetDisplayName()),
				Active:      active,
				Department:  deref(user.GetDepartment()),
			})
		}
		next := resp.GetOdataNextLink()
		if next == nil || len(*next) == 0 {
			break
		}
		builder = msgraphusers.NewUsersRequestBuilder(*next, adapter)
	}
	return users, nil
}
