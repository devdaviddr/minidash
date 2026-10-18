// Package historyserver exposes stored history over an authenticated HTTP endpoint (FR-37).
package historyserver

import (
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/devdaviddr/minidash/agent/internal/history"
)

// Handler serves GET /history?window=<seconds>&token=<token> returning downsampled points.
type Handler struct {
	store *history.Store
	token string
}

// New returns a Handler backed by store, requiring token for every request.
func New(store *history.Store, token string) *Handler {
	return &Handler{store: store, token: token}
}

// ServeHTTP authenticates with the shared token and returns history for the requested window.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
		tok = r.Header.Get("Authorization")
		if len(tok) > 7 && tok[:7] == "Bearer " {
			tok = tok[7:]
		}
	}
	return subtle.ConstantTimeCompare([]byte(tok), []byte(h.token)) == 1
}
