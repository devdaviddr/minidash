// Package hub fans snapshots out to authenticated WebSocket clients.
package hub

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"

	"github.com/devdaviddr/minidash/agent/internal/snapshot"
)

const (
	authTimeout  = 5 * time.Second
	writeTimeout = 5 * time.Second
)

// Hub broadcasts the latest snapshot to every connected client.
type Hub struct {
	token   string
	origins []string

	mu      sync.Mutex
	clients map[chan []byte]struct{}
	last    []byte
}

// New returns a Hub that requires token from every client. origins are extra allowed
// Origin host patterns (the dashboard UI is served from a different origin than the agent).
func New(token string, origins []string) *Hub {
	return &Hub{token: token, origins: origins, clients: map[chan []byte]struct{}{}}
}

// Publish sends s to all clients. A slow client only ever holds the newest snapshot.
func (h *Hub) Publish(s snapshot.Snapshot) {
	b, err := json.Marshal(s)
	if err != nil {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	h.last = b
	for ch := range h.clients {
		select {
		case ch <- b:
		default:
			select { // drop the stale message, keep the fresh one
			case <-ch:
			default:
			}
			select {
			case ch <- b:
			default:
			}
		}
	}
}

func (h *Hub) subscribe() (chan []byte, []byte) {
	ch := make(chan []byte, 1)
	h.mu.Lock()
	h.clients[ch] = struct{}{}
	last := h.last
	h.mu.Unlock()
	return ch, last
}

func (h *Hub) unsubscribe(ch chan []byte) {
	h.mu.Lock()
	delete(h.clients, ch)
	h.mu.Unlock()
}

type authMsg struct {
	Type  string `json:"type"`
	Token string `json:"token"`
}

func (h *Hub) authorized(m authMsg) bool {
	return m.Type == "auth" && subtle.ConstantTimeCompare([]byte(m.Token), []byte(h.token)) == 1
}

// ServeHTTP upgrades to WebSocket, requires an auth message first, then streams snapshots.
func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	c, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: h.origins})
	if err != nil {
		return
	}
	defer func() { _ = c.CloseNow() }()

	actx, cancel := context.WithTimeout(r.Context(), authTimeout)
	var m authMsg
	err = wsjson.Read(actx, c, &m)
	cancel()
	if err != nil || !h.authorized(m) {
		_ = c.Close(websocket.StatusPolicyViolation, "unauthorized")
		return
	}

	ch, last := h.subscribe()
	defer h.unsubscribe(ch)
	ctx := c.CloseRead(r.Context()) // ignore client messages; ctx ends when the client leaves
	if last != nil && !write(ctx, c, last) {
		return
	}
	for {
		select {
		case <-ctx.Done():
			return
		case b := <-ch:
			if !write(ctx, c, b) {
				return
			}
		}
	}
}

func write(ctx context.Context, c *websocket.Conn, b []byte) bool {
	wctx, cancel := context.WithTimeout(ctx, writeTimeout)
	defer cancel()
	return c.Write(wctx, websocket.MessageText, b) == nil
}
