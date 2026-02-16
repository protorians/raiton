# Protorians Raiton
Protorians Raiton development kit for backend microservice

## Bun Optimization
Raiton is optimized for Bun. It automatically detects the Bun runtime and uses `Bun.serve` for maximum performance.

### Usage with Bun
To run your project with Bun:

```bash
bun run source/bin/index.ts
```

Or using the provided scripts:

```bash
# Development mode with hot reload
bun run bun:dev

# Start built project
bun run bun:start
```
