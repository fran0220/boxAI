// BOXAI: tenant registry for hosted multi-account gateway deployments.
//
// A Manager owns every piece of mutable gateway state (agent link, sync hubs,
// tunnels, command queue), so tenancy is introduced by giving each tenant its
// own Manager and routing every entry point through this registry.
package session

import (
	"strings"
	"sync"
)

// Tenants maps tenant ids to session managers. In single-tenant mode (the
// default desktop deployment) every identity shares one Manager; in
// multi-tenant mode managers are created lazily per tenant id.
type Tenants struct {
	single *Manager

	mu       sync.RWMutex
	managers map[string]*Manager
}

// SingleTenant wraps an existing Manager so every identity resolves to it.
func SingleTenant(m *Manager) *Tenants {
	return &Tenants{single: m}
}

// NewTenants creates an empty multi-tenant registry.
func NewTenants() *Tenants {
	return &Tenants{managers: make(map[string]*Manager)}
}

func (t *Tenants) MultiTenant() bool {
	return t.single == nil
}

// ManagerFor returns the Manager owning tenantID, creating it on first use.
// It returns nil in multi-tenant mode when tenantID is empty: an identity
// that cannot be scoped to a tenant must not reach any session state.
func (t *Tenants) ManagerFor(tenantID string) *Manager {
	if t.single != nil {
		return t.single
	}
	tenantID = strings.TrimSpace(tenantID)
	if tenantID == "" {
		return nil
	}

	t.mu.RLock()
	m := t.managers[tenantID]
	t.mu.RUnlock()
	if m != nil {
		return m
	}

	t.mu.Lock()
	defer t.mu.Unlock()
	if m := t.managers[tenantID]; m != nil {
		return m
	}
	m = NewManager()
	t.managers[tenantID] = m
	return m
}

// Peek returns the Manager for tenantID without creating one.
func (t *Tenants) Peek(tenantID string) *Manager {
	if t.single != nil {
		return t.single
	}
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.managers[strings.TrimSpace(tenantID)]
}

// Snapshot returns every instantiated Manager. Used by public (token-keyed)
// routes that must locate the tenant owning an opaque slug or share token.
func (t *Tenants) Snapshot() []*Manager {
	if t.single != nil {
		return []*Manager{t.single}
	}
	t.mu.RLock()
	defer t.mu.RUnlock()
	managers := make([]*Manager, 0, len(t.managers))
	for _, m := range t.managers {
		managers = append(managers, m)
	}
	return managers
}

// ResolveTunnelManager finds the Manager whose agent registered the public
// tunnel slug. Returns nil when no tenant owns it.
func (t *Tenants) ResolveTunnelManager(slug string) *Manager {
	if t.single != nil {
		return t.single
	}
	for _, m := range t.Snapshot() {
		if m.HasTunnelSlug(slug) {
			return m
		}
	}
	return nil
}
