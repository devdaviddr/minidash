// Command minidash-agent samples host metrics and serves them to the dashboard.
package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/devdaviddr/minidash/agent/internal/collect/cpu"
	"github.com/devdaviddr/minidash/agent/internal/collect/disk"
	"github.com/devdaviddr/minidash/agent/internal/collect/memory"
	"github.com/devdaviddr/minidash/agent/internal/collect/network"
	"github.com/devdaviddr/minidash/agent/internal/collect/soc"
	"github.com/devdaviddr/minidash/agent/internal/config"
	"github.com/devdaviddr/minidash/agent/internal/hub"
	"github.com/devdaviddr/minidash/agent/internal/macmon"
	"github.com/devdaviddr/minidash/agent/internal/snapshot"
)

func main() {
	cfg, err := config.FromEnv()
	if err != nil {
		log.Fatal(err)
	}
	mm := macmon.NewRunner(cfg.MacmonBin)
	go mm.Run(context.Background())
	h := hub.New(cfg.Token, cfg.Origins)
	agg := snapshot.NewAggregator(time.Second,
		cpu.New(),
		memory.New(),
		soc.New(mm),
		disk.New(),
		network.New(),
	)
	go agg.Run(context.Background(), h.Publish)

	mux := http.NewServeMux()
	mux.Handle("/ws", h)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ok"))
	})
	srv := &http.Server{Addr: cfg.Addr, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	log.Printf("minidash-agent listening on %s", cfg.Addr)
	log.Fatal(srv.ListenAndServe())
}
