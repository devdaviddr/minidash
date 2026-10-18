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
	h := New(store, "secret", nil)

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
	h := New(store, "secret", nil)
	req := httptest.NewRequest("GET", "/history", nil)
	req.Header.Set("Authorization", "Bearer secret")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("bearer token: got %d", rec.Code)
	}
}

func TestHistoryCORS(t *testing.T) {
	store := history.New(time.Hour, "")
	h := New(store, "secret", []string{"*:8080"})

	// An allowed origin gets the header echoed back.
	req := httptest.NewRequest("GET", "/history?token=secret", nil)
	req.Header.Set("Origin", "http://192.168.0.108:8080")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("allowed origin: got %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://192.168.0.108:8080" {
		t.Fatalf("allowed origin: ACAO %q", got)
	}
	if got := rec.Header().Get("Vary"); got != "Origin" {
		t.Fatalf("allowed origin: Vary %q", got)
	}

	// A disallowed origin gets no header, so the browser refuses the response.
	req = httptest.NewRequest("GET", "/history?token=secret", nil)
	req.Header.Set("Origin", "http://evil.example:1234")
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("disallowed origin: unexpected ACAO header")
	}

	// "*" alone allows everything.
	h = New(store, "secret", []string{"*"})
	req = httptest.NewRequest("GET", "/history?token=secret", nil)
	req.Header.Set("Origin", "https://minidash.example.ts.net")
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://minidash.example.ts.net" {
		t.Fatalf("* pattern: ACAO %q", got)
	}

	// A preflight is answered with the method and no auth check.
	h = New(store, "secret", []string{"*:8080"})
	req = httptest.NewRequest("OPTIONS", "/history", nil)
	req.Header.Set("Origin", "http://localhost:8080")
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("preflight: got %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Methods"); got != "GET" {
		t.Fatalf("preflight: methods %q", got)
	}

	// No Origin header (curl, scripts) is unaffected.
	req = httptest.NewRequest("GET", "/history?token=secret", nil)
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("no origin: got %d ACAO %q", rec.Code, rec.Header().Get("Access-Control-Allow-Origin"))
	}
}
