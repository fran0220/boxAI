//go:build unit

// BOXAI: exact-host browser audience and admin scope regressions.
package middleware

import (
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"
)

func TestBrowserAudienceAllowedMatrix(t *testing.T) {
	require.True(t, browserAudienceAllowed("api.you-box.com", "", nil), "legacy audience-less tokens remain compatible")
	require.True(t, browserAudienceAllowed("you-box.com", "", []string{service.BrowserSurfaceWeb}))
	require.True(t, browserAudienceAllowed("console.you-box.com", "", []string{service.BrowserSurfaceConsole}))
	require.True(t, browserAudienceAllowed("localhost:8080", "http://localhost:5173", []string{service.BrowserSurfaceWeb}))
	require.True(t, browserAudienceAllowed("127.0.0.1:8080", "http://127.0.0.1:3000", []string{service.BrowserSurfaceConsole}))
	require.False(t, browserAudienceAllowed("api.you-box.com", "https://you-box.com", []string{service.BrowserSurfaceWeb}))
	require.False(t, browserAudienceAllowed("arbitrary.example", "", []string{service.BrowserSurfaceWeb}))
	require.False(t, browserAudienceAllowed("you-box.com", "", []string{service.BrowserSurfaceConsole}))
}

func TestAdminBrowserAudienceRequiresConsoleAndAdminScope(t *testing.T) {
	require.True(t, adminBrowserAudienceAllowed(nil, ""))
	require.True(t, adminBrowserAudienceAllowed([]string{service.BrowserSurfaceConsole}, "console user admin"))
	require.False(t, adminBrowserAudienceAllowed([]string{service.BrowserSurfaceConsole}, "console user"))
	require.False(t, adminBrowserAudienceAllowed([]string{service.BrowserSurfaceWeb}, "admin"))
}

func TestAdminBrowserRequestRequiresConsoleHostAudienceAndScope(t *testing.T) {
	require.True(t, adminBrowserRequestAllowed("api.you-box.com", "", nil, ""), "legacy audience-less tokens remain compatible")
	require.True(t, adminBrowserRequestAllowed("console.you-box.com", "", []string{service.BrowserSurfaceConsole}, "console user admin"))
	require.True(t, adminBrowserRequestAllowed("localhost:8080", "http://localhost:3000", []string{service.BrowserSurfaceConsole}, "console user admin"))
	require.False(t, adminBrowserRequestAllowed("api.you-box.com", "https://console.you-box.com", []string{service.BrowserSurfaceConsole}, "console user admin"))
	require.False(t, adminBrowserRequestAllowed("you-box.com", "", []string{service.BrowserSurfaceConsole}, "console user admin"))
	require.False(t, adminBrowserRequestAllowed("console.you-box.com", "", []string{service.BrowserSurfaceWeb}, "admin"))
	require.False(t, adminBrowserRequestAllowed("console.you-box.com", "", []string{service.BrowserSurfaceConsole}, "console user"))
}
