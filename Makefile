.PHONY: setup check agent-check web-check build
setup:
	git config core.hooksPath .githooks
	cd web && npm ci
agent-check:
	cd agent && gofmt -l . | (! grep .) && go vet ./... && go test ./... && golangci-lint run
web-check:
	cd web && npm run lint && npx tsc -b
check: agent-check web-check
build:
	cd agent && go build -o ../bin/minidash-agent ./cmd/minidash-agent
	cd web && npm run build
