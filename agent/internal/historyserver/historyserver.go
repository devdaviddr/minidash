// Package historyserver exposes stored history over an authenticated HTTP endpoint (FR-37).
package historyserver

import (
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/devdaviddr/minidash/agent/internal/history"
)

// Handler serves GET /history?window=<seconds>&token=<token> returning downsampled points.
type Handler struct {
	store *history.Store
	token string
	// origins are allowed Origin host[:port] patterns ("*:8080" = any host on port 8080, "*" = any
	// origin). The dashboard UI is served from a different port than the agent, so a browser fetch
	// is cross-origin and needs these CORS mirrors of the WebSocket gating.
	origins []string
}

// New returns a Handler backed by store, requiring token for every request. origins use the same
// host patterns as MINIDASH_ORIGINS; an empty list allows browser fetches only from same-origin pages.
func New(store *history.Store, token string, origins []string) *Handler {
	return &Handler{store: store, token: token, origins: origins}
}

// ServeHTTP authenticates with the shared token and returns history for the requested window.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.cors(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if !h.authorized(r) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	window := 0
	if v := r.URL.Query().Get("window"); v != "" {
		secs, err := strconv.Atoi(v)
		if err != nil || secs < 0 {
			http.Error(w, "invalid window", http.StatusBadRequest)
			return
		}
		window = secs
	}
	points := h.store.Query(time.Duration(window) * time.Second)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"points": points})
}

// authorized accepts the token from a query parameter or an Authorization: Bearer header.
func (h *Handler) authorized(r *http.Request) bool {
	tok := r.URL.Query().Get("token")
	if tok == "" {
		bearer := r.Header.Get("Authorization")
		if len(bearer) > 7 && bearer[:7] == "Bearer " {
			tok = bearer[7:]
		}
	}
	return subtle.ConstantTimeCompare([]byte(tok), []byte(h.token)) == 1
}

// cors sets Access-Control-Allow-Origin when the request's Origin matches one of the configured
// host patterns, echoing the origin it matched. Pattern semantics match the WebSocket gating:
// "host:port", "*:port", or "*" alone. IPv6 literals may be bracketed on both sides.
func (h *Handler) cors(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return
	}
	u, err := url.Parse(origin)
	if err != nil {
		return
	}
	for _, p := range h.origins {
		if !originMatch(p, u) {
			continue
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Add("Vary", "Origin")
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Methods", "GET")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization")
			w.Header().Set("Access-Control-Max-Age", "600")
		}
		return
	}
}

// originMatch reports whether the pattern allows the origin's host (and port, when either names one).
// A pattern of "*" alone allows any origin; a pattern host may be "*" to allow any host.
func originMatch(pattern string, u *url.URL) bool {
	if pattern == "*" {
		return true
	}
	pHost, pPort := splitHostPort(pattern)
	host, port := u.Hostname(), u.Port()
	if pPort != "" {
		return port == pPort && hostMatch(pHost, host)
	}
	return hostMatch(pHost, host)
}

func hostMatch(pHost, host string) bool {
	return pHost == "*" || strings.EqualFold(strings.Trim(pHost, "[]"), strings.Trim(host, "[]"))
}

// splitHostPort splits "host:port", keeping bracketed IPv6 literals intact.
func splitHostPort(pattern string) (host, port string) {
	if strings.HasSuffix(pattern, "]") { // [::1] or [::1]:8080
		if i := strings.LastIndex(pattern, "]:"); i >= 0 {
			return pattern[:i+1], pattern[i+2:]
		}
		return pattern, ""
	}
	if i := strings.LastIndex(pattern, ":"); i >= 0 {
		return pattern[:i], pattern[i+1:]
	}
	return pattern, ""
}
