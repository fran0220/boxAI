//go:build unit

package handler

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
	"github.com/Wei-Shaw/sub2api/internal/service"

	"github.com/stretchr/testify/require"
)

type fakeCreatorKeyAPI struct {
	keys        []service.APIKey
	listErr     error
	create      *service.APIKey
	createErr   error
	createdName string
	createdGID  *int64
	groups      []service.Group
	groupsErr   error
	listCalls   int
	listFilters []service.APIKeyListFilters
	updatedID   int64
	updatedGID  *int64
	updateErr   error
}

func (f *fakeCreatorKeyAPI) List(_ context.Context, _ int64, _ pagination.PaginationParams, filters service.APIKeyListFilters) ([]service.APIKey, *pagination.PaginationResult, error) {
	f.listCalls++
	f.listFilters = append(f.listFilters, filters)
	if f.listErr != nil {
		return nil, nil, f.listErr
	}
	// Simulate search filter when provided.
	out := f.keys
	if filters.Search != "" {
		var filtered []service.APIKey
		for _, k := range f.keys {
			if stringsContainsFold(k.Name, filters.Search) {
				filtered = append(filtered, k)
			}
		}
		out = filtered
	}
	return out, &pagination.PaginationResult{Total: int64(len(out))}, nil
}

func (f *fakeCreatorKeyAPI) Create(_ context.Context, _ int64, req service.CreateAPIKeyRequest) (*service.APIKey, error) {
	f.createdName = req.Name
	f.createdGID = req.GroupID
	if f.createErr != nil {
		return nil, f.createErr
	}
	if f.create != nil {
		return f.create, nil
	}
	return &service.APIKey{
		ID:      99,
		Name:    req.Name,
		Key:     "sk-new-creator",
		Status:  service.StatusActive,
		GroupID: req.GroupID,
	}, nil
}

func (f *fakeCreatorKeyAPI) Update(_ context.Context, id int64, _ int64, req service.UpdateAPIKeyRequest) (*service.APIKey, error) {
	if f.updateErr != nil {
		return nil, f.updateErr
	}
	f.updatedID = id
	f.updatedGID = req.GroupID
	for i := range f.keys {
		if f.keys[i].ID == id {
			if req.GroupID != nil {
				f.keys[i].GroupID = req.GroupID
			}
			k := f.keys[i]
			return &k, nil
		}
	}
	return &service.APIKey{ID: id, Name: CreatorAPIKeyName, Key: "sk-upgraded", Status: service.StatusActive, GroupID: req.GroupID}, nil
}

func (f *fakeCreatorKeyAPI) GetAvailableGroups(_ context.Context, _ int64) ([]service.Group, error) {
	return f.groups, f.groupsErr
}

func stringsContainsFold(s, sub string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(sub))
}

func TestEnsureCreatorAPIKeyReturnsExisting(t *testing.T) {
	api := &fakeCreatorKeyAPI{keys: []service.APIKey{
		{ID: 1, Name: "other", Key: "sk-other", Status: service.StatusActive},
		{ID: 2, Name: CreatorAPIKeyName, Key: "sk-creator", Status: service.StatusActive},
	}}
	got, created, err := ensureCreatorAPIKey(context.Background(), api, 7)
	require.NoError(t, err)
	require.False(t, created)
	require.Equal(t, "sk-creator", got.Key)
	require.Empty(t, api.createdName)
	require.NotEmpty(t, api.listFilters)
	require.Equal(t, CreatorAPIKeyName, api.listFilters[0].Search)
}

func TestEnsureCreatorAPIKeyCreatesWhenMissing(t *testing.T) {
	gid := int64(42)
	api := &fakeCreatorKeyAPI{
		keys:   []service.APIKey{{ID: 1, Name: "other", Key: "sk-other", Status: service.StatusActive}},
		groups: []service.Group{{ID: gid, Name: "default"}},
	}
	got, created, err := ensureCreatorAPIKey(context.Background(), api, 7)
	require.NoError(t, err)
	require.True(t, created)
	require.Equal(t, CreatorAPIKeyName, api.createdName)
	require.NotNil(t, api.createdGID)
	require.Equal(t, gid, *api.createdGID)
	require.Equal(t, "sk-new-creator", got.Key)
	require.NotNil(t, got.GroupID)
}

func TestEnsureCreatorAPIKeyCreatesWithoutGroupWhenNoneAvailable(t *testing.T) {
	api := &fakeCreatorKeyAPI{keys: nil, groups: nil}
	got, created, err := ensureCreatorAPIKey(context.Background(), api, 7)
	require.NoError(t, err)
	require.True(t, created)
	require.Nil(t, api.createdGID)
	require.Equal(t, "sk-new-creator", got.Key)
}

func TestEnsureCreatorAPIKeyIgnoresInactiveCreator(t *testing.T) {
	api := &fakeCreatorKeyAPI{keys: []service.APIKey{
		{ID: 2, Name: CreatorAPIKeyName, Key: "sk-dead", Status: "disabled"},
	}}
	got, created, err := ensureCreatorAPIKey(context.Background(), api, 7)
	require.NoError(t, err)
	require.True(t, created)
	require.Equal(t, "sk-new-creator", got.Key)
}

func TestEnsureCreatorAPIKeyCaseInsensitiveName(t *testing.T) {
	api := &fakeCreatorKeyAPI{keys: []service.APIKey{
		{ID: 2, Name: "BoxAI-Creator", Key: "sk-ci", Status: service.StatusActive},
	}}
	got, created, err := ensureCreatorAPIKey(context.Background(), api, 7)
	require.NoError(t, err)
	require.False(t, created)
	require.Equal(t, "sk-ci", got.Key)
}

func TestEnsureCreatorAPIKeyPropagatesListError(t *testing.T) {
	api := &fakeCreatorKeyAPI{listErr: errors.New("db down")}
	_, _, err := ensureCreatorAPIKey(context.Background(), api, 7)
	require.Error(t, err)
}

func TestEnsureCreatorAPIKeyUpgradesUngroupedWhenGroupAvailable(t *testing.T) {
	gid := int64(11)
	api := &fakeCreatorKeyAPI{
		keys: []service.APIKey{
			{ID: 2, Name: CreatorAPIKeyName, Key: "sk-creator", Status: service.StatusActive},
		},
		groups: []service.Group{{ID: gid, Name: "default"}},
	}
	got, created, err := ensureCreatorAPIKey(context.Background(), api, 7)
	require.NoError(t, err)
	require.False(t, created)
	require.Equal(t, int64(2), api.updatedID)
	require.NotNil(t, got.GroupID)
	require.Equal(t, gid, *got.GroupID)
}

func TestEnsureCreatorAPIKeySkipsUpgradeWhenAlreadyGrouped(t *testing.T) {
	gid := int64(5)
	api := &fakeCreatorKeyAPI{
		keys: []service.APIKey{
			{ID: 2, Name: CreatorAPIKeyName, Key: "sk-creator", Status: service.StatusActive, GroupID: &gid},
		},
		groups: []service.Group{{ID: 99, Name: "other"}},
	}
	got, created, err := ensureCreatorAPIKey(context.Background(), api, 7)
	require.NoError(t, err)
	require.False(t, created)
	require.Equal(t, int64(0), api.updatedID)
	require.Equal(t, gid, *got.GroupID)
}

func TestEnsureCreatorAPIKeyCreateRaceRecovers(t *testing.T) {
	api := &racingCreatorKeyAPI{
		listSequence: [][]service.APIKey{
			{}, // first list empty
			{{ID: 5, Name: CreatorAPIKeyName, Key: "sk-raced", Status: service.StatusActive}},
		},
		createErr: errors.New("duplicate"),
	}
	got, created, err := ensureCreatorAPIKey(context.Background(), api, 7)
	require.NoError(t, err)
	require.False(t, created)
	require.Equal(t, "sk-raced", got.Key)
}

type racingCreatorKeyAPI struct {
	listSequence [][]service.APIKey
	listIdx      int
	createErr    error
}

func (f *racingCreatorKeyAPI) List(_ context.Context, _ int64, _ pagination.PaginationParams, _ service.APIKeyListFilters) ([]service.APIKey, *pagination.PaginationResult, error) {
	if f.listIdx >= len(f.listSequence) {
		return nil, &pagination.PaginationResult{Total: 0}, nil
	}
	keys := f.listSequence[f.listIdx]
	f.listIdx++
	return keys, &pagination.PaginationResult{Total: int64(len(keys))}, nil
}

func (f *racingCreatorKeyAPI) Create(_ context.Context, _ int64, _ service.CreateAPIKeyRequest) (*service.APIKey, error) {
	return nil, f.createErr
}

func (f *racingCreatorKeyAPI) Update(_ context.Context, _ int64, _ int64, _ service.UpdateAPIKeyRequest) (*service.APIKey, error) {
	return nil, errors.New("unexpected Update")
}

func (f *racingCreatorKeyAPI) GetAvailableGroups(_ context.Context, _ int64) ([]service.Group, error) {
	return nil, nil
}
