package hub

import (
	"context"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"

	"github.com/devdaviddr/minidash/agent/internal/snapshot"
)

func dial(t *testing.T, h *Hub) (*websocket.Conn, context.Context) {
	t.Helper()
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	t.Cleanup(cancel)
	c, _, err := websocket.Dial(ctx, "ws"+strings.TrimPrefix(srv.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = c.CloseNow() })
	return c, ctx
}

// AC-8 (backend half): authenticated clients receive snapshots.
func TestAuthenticatedClientReceivesSnapshots(t *testing.T) {
	h := New("secret", nil)
	c, ctx := dial(t, h)
	if err := wsjson.Write(ctx, c, authMsg{Type: "auth", Token: "secret"}); err != nil {
		t.Fatal(err)
	}
	go func() {
		for i := 0; i < 20; i++ {
			h.Publish(snapshot.Snapshot{Schema: 1, Seq: uint64(i + 1)})
			time.Sleep(20 * time.Millisecond)
		}
	}()
	var s snapshot.Snapshot
	if err := wsjson.Read(ctx, c, &s); err != nil || s.Seq == 0 {
		t.Fatalf("no snapshot: %v %+v", err, s)
	}
}

func TestWrongTokenIsClosed(t *testing.T) {
	h := New("secret", nil)
	c, ctx := dial(t, h)
	_ = wsjson.Write(ctx, c, authMsg{Type: "auth", Token: "nope"})
	_, _, err := c.Read(ctx)
	if websocket.CloseStatus(err) != websocket.StatusPolicyViolation {
		t.Fatalf("want policy violation, got %v", err)
	}
}

func TestNoAuthMessageGetsNoData(t *testing.T) {
	h := New("secret", nil)
	c, ctx := dial(t, h)
	h.Publish(snapshot.Snapshot{Schema: 1, Seq: 1})
	_ = wsjson.Write(ctx, c, map[string]string{"type": "hello"})
	if _, _, err := c.Read(ctx); websocket.CloseStatus(err) != websocket.StatusPolicyViolation {
		t.Fatalf("unauthenticated client must be closed, got %v", err)
	}
}

func TestSlowClientKeepsNewest(t *testing.T) {
	h := New("secret", nil)
	ch, _ := h.subscribe()
	for i := uint64(1); i <= 5; i++ {
		h.Publish(snapshot.Snapshot{Schema: 1, Seq: i})
	}
	if got := string(<-ch); !strings.Contains(got, `"seq":5`) {
		t.Fatalf("expected newest snapshot, got %s", got)
	}
}
