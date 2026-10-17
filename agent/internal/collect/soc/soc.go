// Package soc reports Apple Silicon GPU, CPU clusters, power, temperatures and fans via macmon.
package soc

import (
	"context"

	"github.com/devdaviddr/minidash/agent/internal/macmon"
)

// Data is the soc collector payload (contracts/snapshot.schema.json#/$defs/socData).
type Data struct {
	GPU      GPU       `json:"gpu"`
	Clusters []Cluster `json:"clusters"`
	Power    Power     `json:"power"`
	TempC    Temp      `json:"tempC"`
	Fans     []Fan     `json:"fans"`
}

// GPU holds utilisation (percent) and clock.
type GPU struct {
	Usage   float64 `json:"usage"`
	FreqMHz float64 `json:"freqMhz"`
}

// Cluster is a CPU cluster ("E" efficiency or "P" performance).
type Cluster struct {
	Label   string  `json:"label"`
	Usage   float64 `json:"usage"`
	FreqMHz float64 `json:"freqMhz"`
}

// Power is draw in watts.
type Power struct {
	System float64 `json:"system"`
	CPU    float64 `json:"cpu"`
	GPU    float64 `json:"gpu"`
	ANE    float64 `json:"ane"`
	RAM    float64 `json:"ram"`
}

// Temp is average die temperature in Celsius.
type Temp struct {
	CPU float64 `json:"cpu"`
	GPU float64 `json:"gpu"`
}

// Fan is one fan reading.
type Fan struct {
	Name   string  `json:"name"`
	RPM    float64 `json:"rpm"`
	MaxRPM float64 `json:"maxRpm"`
}

// Collector implements snapshot.Collector for the SoC sensors.
type Collector struct{ src macmon.Source }

// New returns a collector reading from src.
func New(src macmon.Source) *Collector { return &Collector{src: src} }

// Name implements snapshot.Collector.
func (*Collector) Name() string { return "soc" }

// Collect implements snapshot.Collector.
func (c *Collector) Collect(context.Context) (any, error) {
	s, err := c.src.Latest()
	if err != nil {
		return nil, err
	}
	d := Data{
		GPU:   GPU{Usage: s.GPUActive * 100, FreqMHz: s.GPUFreqMHz},
		Power: Power{System: s.SysPower, CPU: s.CPUPower, GPU: s.GPUPower, ANE: s.ANEPower, RAM: s.RAMPower},
		TempC: Temp{CPU: s.Temp.CPU, GPU: s.Temp.GPU},
		// Non-nil so JSON is [] not null.
		Clusters: []Cluster{}, Fans: []Fan{},
	}
	for _, t := range s.CPUTiers {
		d.Clusters = append(d.Clusters, Cluster{Label: t.Label, Usage: t.ActiveRatio * 100, FreqMHz: t.FreqMHz})
	}
	for _, f := range s.Fans {
		d.Fans = append(d.Fans, Fan{Name: f.Name, RPM: f.RPM, MaxRPM: f.MaxRPM})
	}
	return d, nil
}
