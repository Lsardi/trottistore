# Load Tests

## Prerequisites
Services must be running: `pnpm dev`

## Run
```bash
# Test against local
pnpm test:load

# Test against staging
LOAD_TEST_URL=https://staging.example.com pnpm test:load
```

## Scenarios
| Test | Target RPS | Duration | Connections |
|------|-----------|----------|-------------|
| Health check | 1000 | 10s | 10 |
| Product listing | 100 | 10s | 20 |
| Product detail | 200 | 10s | 20 |
| Categories | 500 | 10s | 10 |
| Auth (stress) | 50 | 10s | 10 |
