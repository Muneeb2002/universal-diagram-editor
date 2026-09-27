# GLSP Universal Editor (Ecore)

A client–server diagram editor built on Eclipse GLSP for Ecore metamodels and instance models. It includes a standalone web client and a Node.js server.

## Project structure

```
glsp-client-server-editor/
├── glsp-client/                        # GLSP client and app
│   ├── packages/                       # Core client framework
│   └── universal-editor-standalone/    # Standalone web app
├── glsp-server/                        # GLSP server
│   ├── packages/                       # Core server framework
│   ├── universal-editor-server/        # Development server (TypeScript)
│   └── universal-editor-server-bundled/# Bundled server (deploy)
└── README.md
```

## Architecture

- **Client** (`glsp-client/`): Browser app (TypeScript, Sprotty, Webpack). Renders Ecore diagrams, toolbar, sidebar, shape mapping dialog, instance management.
- **Server** (`glsp-server/`): Node.js GLSP server (TypeScript). Handles metamodel/instance model, diagram state, and persistence.

```
┌─────────────────────┐     WebSocket      ┌─────────────────────┐
│   Browser client    │ ◄────────────────► │   Node.js server    │
│   (port 3000 etc.)  │                    │   (port 8081)       │
└─────────────────────┘                    └─────────────────────┘
```

## Quick start

### Prerequisites

- **Node.js** ≥ 20  
- **Yarn** ≥ 1.7.0  

### 1. Build

```bash
# Client
cd glsp-client
yarn install
yarn build
cd universal-editor-standalone
yarn install
yarn build

# Server
cd ../../glsp-server
yarn install
yarn build

cd universal-editor-server
yarn build
```

### 2. Start the server

```bash
# Changed: the build steps above leave the terminal in glsp-server/universal-editor-server.
yarn start:websocket
```

Server listens on **ws://localhost:8081** (WebSocket).

### 3. Run the client

After building the client, open the app in a browser:

- **Option A:** Open **`glsp-client/universal-editor-standalone/app/index.html`** in your browser (double‑click or File → Open).
- **Option B:** Serve the app over HTTP, then open the URL (e.g. for CORS or local dev):
  ```bash
  # Changed: serve the standalone root so both the app bundle and sibling css directory are available.
  npx serve glsp-client/universal-editor-standalone -p 3000
  ```
  Then open **http://localhost:3000/app/** in a browser.

## Development

### Client

```bash
cd glsp-client
yarn build          # Build packages
yarn watch          # Watch packages
yarn lint           # Lint

cd universal-editor-standalone
yarn build          # Build app
yarn watch          # Watch + bundle
yarn lint           # Lint app
```

### Server

```bash
cd glsp-server
yarn build          # Build packages and server
yarn watch          # Watch mode
yarn lint           # Lint
yarn test           # Tests

cd universal-editor-server-bundled
yarn start:websocket   # Run bundled server
```

## Ports

| Role              | Default        |
|-------------------|----------------|
| Client (if served)| http://localhost:3000 |
| Server WebSocket  | ws://localhost:8081  |
| Server HTTP       | http://localhost:5007 (if used) |

## Features

- **Ecore metamodel editing**: Load/save Ecore JSON, create/edit/delete EClasses, EEnums, attributes, references, inheritance.
- **Instance mode**: Create and edit instance models from a loaded metamodel.
- **Shape mapping**: Map classes/enums to visual shapes (rectangle, circle, arrow, line, custom SVG) and persist mappings.
- **Graphical model editor**: Define custom shapes (rectangle, circle, line, arrow, custom SVG, combined shapes) for mapping.
- **Layout**: Diagram layout and manual positioning with persisted positions.

## Configuration

- **Client**: Webpack and TypeScript in `glsp-client/universal-editor-standalone`. Server URL is configured for the build (e.g. Webpack DefinePlugin).
- **Server**: Port and WebSocket/HTTP in `glsp-server/universal-editor-server-bundled` (e.g. `--port 8081`, `-w` for WebSocket).

## Troubleshooting

**Port in use**

```bash
lsof -i :3000
lsof -i :8081
# kill -9 <PID> if needed
```

**Clean rebuild**

```bash
yarn clean
rm -rf node_modules
yarn install
yarn build
```

**Connection issues**

- Ensure the server is running and the client is built with the correct server host/port.
- In the browser, check the WebSocket connection (e.g. DevTools → Network → WS).

## Documentation

- [Client](glsp-client/README.md) – Client framework and universal-editor-standalone
- [Server](glsp-server/README.md) – Server framework and universal-editor-server
- [Eclipse GLSP](https://www.eclipse.org/glsp/)
- [Sprotty](https://github.com/eclipse/sprotty)

## License

Based on Eclipse GLSP; see project and Eclipse GLSP licensing terms.
