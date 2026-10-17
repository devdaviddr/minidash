// Command minidash-agent samples host metrics and serves them to the dashboard.
package main

import (
	"log"
	"net/http"
	"time"

	"github.com/devdaviddr/minidash/agent/internal/config"
)

func main() {
	cfg, err := config.FromEnv()
	if err != nil {
		log.Fatal(err)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ok"))
	})
	srv := &http.Server{Addr: cfg.Addr, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	log.Printf("minidash-agent listening on %s", cfg.Addr)
	log.Fatal(srv.ListenAndServe())
}
