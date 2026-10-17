# Security

- The repo is public. Never commit secrets, tokens, hostnames of private services, IPs, MAC addresses, share names or usernames from the real machine. Fixtures must be sanitised.
- The agent is reachable on the LAN and requires a shared access token on every request and WebSocket. It refuses to start without a token. Never bind a public interface. Compare tokens in constant time; never log them.
- Privileged access (`powermetrics`) lives in a separate optional helper with the narrowest possible scope.
- Validate and bound everything parsed from external commands and sockets.
- Dependencies: pin versions, review additions, prefer few and well-maintained.
