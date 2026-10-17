# Security

- The repo is public. Never commit secrets, tokens, hostnames of private services, IPs, MAC addresses, share names or usernames from the real machine. Fixtures must be sanitised.
- Agent binds to `127.0.0.1` by default. LAN exposure needs an explicit config flag and authentication, decided in the spec.
- Privileged access (`powermetrics`) lives in a separate optional helper with the narrowest possible scope.
- Validate and bound everything parsed from external commands and sockets.
- Dependencies: pin versions, review additions, prefer few and well-maintained.
