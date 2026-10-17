package network

import "encoding/binary"

// Layout of struct ifmibdata (macOS <net/if_mib.h>) as returned by the sysctl
// net.link.generic.ifdata.<ifindex>.1 (IFDATA_GENERAL). Reading it avoids forking `netstat`,
// which cost more than every other network operation combined.
//
// NET_RT_IFLIST2 looks tempting but carries 32-bit byte counters that wrap at 4 GB on current
// macOS; ifmibdata embeds the 64-bit if_data64. struct layout (if_data64 is packed to 4 bytes):
//
//	ifmd_name[16] pcount flags snd_len snd_maxlen snd_drops filler[4]   -> 52 bytes
//	if_data64: 8 bytes of u8 fields, mtu u32, metric u32, baudrate u64, ipackets u64, ierrors u64,
//	           opackets u64, oerrors u64, collisions u64, ibytes u64, obytes u64, ...
const (
	ifmibDataOff = 52
	offIBytes    = ifmibDataOff + 64
	offOBytes    = ifmibDataOff + 72
	minIfmibLen  = offOBytes + 8
)

// parseIfMib returns the cumulative byte counters in an ifmibdata blob.
func parseIfMib(b []byte) (Counter, bool) {
	if len(b) < minIfmibLen {
		return Counter{}, false
	}
	return Counter{
		Rx: binary.NativeEndian.Uint64(b[offIBytes:]),
		Tx: binary.NativeEndian.Uint64(b[offOBytes:]),
	}, true
}
