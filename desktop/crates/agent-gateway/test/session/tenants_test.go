// BOXAI: tests for the multi-tenant session manager registry.
package session_test

import (
	"testing"

	"github.com/liveagent/agent-gateway/internal/session"
)

func TestSingleTenantAlwaysReturnsSameManager(t *testing.T) {
	t.Parallel()

	sm := session.NewManager()
	tenants := session.SingleTenant(sm)

	if tenants.MultiTenant() {
		t.Fatal("SingleTenant registry must not report multi-tenant")
	}
	for _, tenantID := range []string{"", "local", "user:1", "user:2"} {
		if got := tenants.ManagerFor(tenantID); got != sm {
			t.Fatalf("ManagerFor(%q) = %p, want the single manager %p", tenantID, got, sm)
		}
	}
	if snapshot := tenants.Snapshot(); len(snapshot) != 1 || snapshot[0] != sm {
		t.Fatalf("Snapshot() = %#v, want the single manager", snapshot)
	}
}

func TestMultiTenantIsolatesManagersPerTenant(t *testing.T) {
	t.Parallel()

	tenants := session.NewTenants()
	if !tenants.MultiTenant() {
		t.Fatal("NewTenants registry must report multi-tenant")
	}

	userA := tenants.ManagerFor("user:1")
	userB := tenants.ManagerFor("user:2")
	if userA == nil || userB == nil {
		t.Fatal("tenant managers must be created lazily")
	}
	if userA == userB {
		t.Fatal("distinct tenants must not share a manager")
	}
	if again := tenants.ManagerFor("user:1"); again != userA {
		t.Fatal("ManagerFor must be stable per tenant id")
	}

	if got := tenants.ManagerFor(""); got != nil {
		t.Fatalf("ManagerFor(\"\") = %p, want nil for unscopable identities", got)
	}
	if got := tenants.Peek("user:3"); got != nil {
		t.Fatalf("Peek must not create managers, got %p", got)
	}
	if snapshot := tenants.Snapshot(); len(snapshot) != 2 {
		t.Fatalf("Snapshot() has %d managers, want 2", len(snapshot))
	}
}

func TestMultiTenantAgentStateIsIsolated(t *testing.T) {
	t.Parallel()

	tenants := session.NewTenants()
	userA := tenants.ManagerFor("user:1")
	userB := tenants.ManagerFor("user:2")

	userA.RecordAuthentication("agent-a", "1.0.0", "session-a")
	userA.SetSession(session.NewAgentSession(userA.LatestAuthSnapshot()))

	if !userA.IsOnline() {
		t.Fatal("tenant A agent should be online")
	}
	if userB.IsOnline() {
		t.Fatal("tenant B must not see tenant A's agent")
	}
	if status := userB.Status(); status.AgentID != "" {
		t.Fatalf("tenant B status leaked agent identity: %#v", status)
	}
}
