package historyserver

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/devdaviddr/minidash/agent/internal/history"
	"github.com/devdaviddr/minidash/agent/internal/snapshot"
)

func TestHistoryAuth(t *testing.T) {
	store := history.New(time.Hour, "")
	store.Add(snapshot.Snapshot{Seq: 1, TS: time.Now().UTC(), IntervalMS: 1000,
		Collectors: map[string]snapshot.Result{"cpu": {OK: true, Data: map[string]any{"total": 1.0}}}})
	h := New(store, "secret")

	// No token -> 401.
	req := httptest.NewRequest("GET", "/history", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("no token: got %d", rec.Code)
	}

	// Valid token -> 200 with points.
	req = httptest.NewRequest("GET", "/history?token=secret", nil)
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("valid token: got %d", rec.Code)
	}
	var body struct {
		Points []map[string]any `json:"points"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("bad json: %v", err)
	}
	if len(body.Points) != 1 {
		t.Fatalf("expected 1 point, got %d", len(body.Points))
	}
}

func TestHistoryBearerHeader(t *testing.T) {
	store := history.New(time.Hour, "")
	h := New(store, "secret")
	req := httptest.NewRequest("GET", "/history", nil)
	req.Header.Set("Authorization", "Bearer secret")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("bearer token: got %d", rec.Code)
	}
}
