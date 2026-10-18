# Included by every location: nginx drops server-level add_header once a location sets its own.
add_header X-Content-Type-Options nosniff always;
add_header Referrer-Policy no-referrer always;
add_header X-Frame-Options DENY always;
# The UI talks to its own origin's assets, to the agent's WebSocket, and to /history (proxied to
# the agent by nginx, keeping the page on one origin).
add_header Content-Security-Policy "default-src 'self'; connect-src 'self' ws: wss:; style-src 'self' 'unsafe-inline'; img-src 'self' data:" always;
