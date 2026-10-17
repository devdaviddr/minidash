# Included by every location: nginx drops server-level add_header once a location sets its own.
add_header X-Content-Type-Options nosniff always;
add_header Referrer-Policy no-referrer always;
add_header X-Frame-Options DENY always;
# The UI talks only to its own origin's assets and to the agent's WebSocket.
add_header Content-Security-Policy "default-src 'self'; connect-src 'self' ws: wss:; style-src 'self' 'unsafe-inline'; img-src 'self' data:" always;
