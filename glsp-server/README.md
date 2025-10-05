# GLSP Server Framework

This repository contains the Eclipse GLSP (Graphical Language Server Platform) server framework and workflow server implementations.

## 📁 Project Structure

```
glsp-server-node/
├── packages/                    # Core GLSP server framework
│   ├── graph/                  # Graph model definitions
│   ├── layout-elk/            # ELK layout engine integration
│   └── server/                # Main server framework
├── workflow-server/            # Development server (TypeScript source)
├── workflow-server-bundled/    # Deployment server (JavaScript bundle)
├── package.json               # Root package configuration
└── tsconfig.json             # TypeScript configuration
```

## 🏗️ Architecture Overview

### Core Framework (`packages/`)
- **`@eclipse-glsp/graph`** - Graph model definitions and utilities
- **`@eclipse-glsp/layout-elk`** - ELK layout engine integration
- **`@eclipse-glsp/server`** - Main server framework with handlers and operations

### Server Implementations
- **`workflow-server`** - Development server with TypeScript source code
- **`workflow-server-bundled`** - Pre-built deployment server (single JavaScript file)

## 🚀 Quick Start

### Prerequisites
- Node.js >= 20
- Yarn >= 1.7.0

### Build Everything
```bash
# Build all GLSP packages
yarn build

# Build and test
yarn test
```

### Development Workflow

#### 1. Framework Development
```bash
# Build GLSP packages
yarn build

# Watch mode for packages
yarn watch

# Lint code
yarn lint

# Run tests
yarn test
```

#### 2. Server Development
```bash
# Navigate to development server
cd workflow-server

# Install dependencies
yarn install

# Build the server
yarn build

# Test the server
yarn test
```

#### 3. Server Deployment
```bash
# Navigate to bundled server
cd workflow-server-bundled

# Start the server
yarn start

# Start with WebSocket
yarn start:websocket
```

## 📦 Package Details

### `@eclipse-glsp/graph`
**Purpose**: Graph model definitions and utilities

**Key Features**:
- Graph model elements (nodes, edges, compartments)
- Layout utilities
- Model validation
- Graph manipulation helpers

**Build**: `yarn build` (compiles TypeScript to JavaScript)

### `@eclipse-glsp/layout-elk`
**Purpose**: ELK layout engine integration

**Key Features**:
- Automatic layout algorithms
- Layout configuration
- Element filtering
- Layout optimization

**Build**: `yarn build` (compiles TypeScript to JavaScript)

### `@eclipse-glsp/server`
**Purpose**: Main server framework

**Key Features**:
- Request handlers
- Operation implementations
- Model management
- Client-server communication
- Session management

**Build**: `yarn build` (compiles TypeScript to JavaScript)

### `workflow-server`
**Purpose**: Development server implementation

**Key Features**:
- Complete TypeScript source code
- Ecore model handling
- Task editing operations
- Custom handlers and providers
- Development tools and debugging

**Build**: `yarn build` (TypeScript compilation)

### `workflow-server-bundled`
**Purpose**: Deployment server

**Key Features**:
- Single JavaScript file (`wf-glsp-server-node.js`)
- Pre-built and optimized
- Ready for production deployment
- Minimal dependencies

**Usage**: Direct execution with Node.js

## 🔧 Development Commands

### Root Level Commands
```bash
yarn build          # Build all packages
yarn clean          # Clean build artifacts
yarn compile        # Compile TypeScript
yarn format         # Format code with Prettier
yarn lint           # Lint code with ESLint
yarn test           # Run tests
yarn watch          # Watch mode for TypeScript compilation
```

### Development Server Commands (workflow-server/)
```bash
yarn build          # Build server
yarn compile        # Compile TypeScript
yarn test           # Run tests
yarn lint           # Lint code
yarn clean          # Clean build artifacts
```

### Deployment Server Commands (workflow-server-bundled/)
```bash
yarn start              # Start server (port 5007)
yarn start:websocket    # Start with WebSocket (port 8081)
yarn clean              # Clean bundled files
```

## 🌐 Running the Server

### Option 1: Development Server
```bash
# Build the development server
cd workflow-server
yarn build

# Run with Node.js
node lib/node/index.js --port 8081 --webSocket
```

### Option 2: Bundled Server (Recommended for Production)
```bash
# Start bundled server
cd workflow-server-bundled
yarn start:websocket
```

### Server Options
```bash
# Available command line options
--port <port>          # Set server port (default: 0)
--host <host>          # Set host name (default: 127.0.0.1)
--webSocket            # Use WebSocket launcher
--logLevel <level>     # Set log level (default: 3)
--fileLog              # Enable file logging
--no-consoleLog        # Disable console logging
```

## 🔌 Client-Server Communication

### Protocol
- **JSON-RPC** based communication
- **WebSocket** or **HTTP** transport
- **Action-based** request/response pattern

### Default Ports
- **HTTP Server**: Port 5007
- **WebSocket Server**: Port 8081

### Connection
The client connects to the server using:
```
ws://localhost:8081/workflow
```

## 📝 Customization

### Adding New Operations
1. **Create operation handler** in `workflow-server/src/common/handler/`
2. **Register in diagram module**
3. **Build server**: `yarn build`
4. **Test with client**

### Custom Model Elements
1. **Define model classes** in `workflow-server/src/common/model/`
2. **Create handlers** for operations
3. **Configure in diagram module**
4. **Update client-side model**

### Adding New Features
1. **Create feature module** in `workflow-server/src/common/`
2. **Implement handlers and providers**
3. **Register in server configuration**
4. **Build and test**

## 🔗 Dependencies

### Framework Dependencies
- **Inversify** - Dependency injection
- **Express** - HTTP server framework
- **WebSocket** - Real-time communication
- **ELK** - Layout engine

### Server Dependencies
- **@eclipse-glsp/server** - GLSP server framework
- **@eclipse-glsp/graph** - Graph model utilities
- **@eclipse-glsp/layout-elk** - Layout engine integration

## 🐛 Troubleshooting

### Build Issues
```bash
# Clean everything and rebuild
yarn clean
yarn install
yarn build
```

### Port Conflicts
- Change port in server startup command
- Update client connection URL
- Check firewall settings

### Connection Issues
```bash
# Test server connectivity
curl http://localhost:5007/health

# Check WebSocket connection
# Use browser developer tools Network tab
```

### TypeScript Errors
```bash
# Regenerate index files
yarn generate:index

# Check TypeScript configuration
yarn compile
```

## 🚀 Deployment

### Development Deployment
```bash
# Use development server
cd workflow-server
yarn build
node lib/node/index.js --port 8081 --webSocket
```

### Production Deployment
```bash
# Use bundled server
cd workflow-server-bundled
yarn start:websocket
```

### Docker Deployment
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY workflow-server-bundled/ .
EXPOSE 8081
CMD ["node", "wf-glsp-server-node.js", "--port", "8081", "--webSocket"]
```

## 📊 Monitoring

### Logging
- **Console logging**: Default enabled
- **File logging**: Use `--fileLog` flag
- **Log levels**: 0-5 (0=error, 5=debug)

### Health Checks
```bash
# Check server health
curl http://localhost:5007/health

# Check WebSocket connection
# Monitor in browser developer tools
```

## 📚 Additional Resources

- [Eclipse GLSP Documentation](https://www.eclipse.org/glsp/)
- [Node.js Documentation](https://nodejs.org/docs/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [ELK Layout Engine](https://www.eclipse.org/elk/)

## 🤝 Contributing

1. Make changes to the appropriate package
2. Run tests: `yarn test`
3. Lint code: `yarn lint`
4. Build: `yarn build`
5. Test the server: `yarn start:websocket`

---

**Note**: This is a customized version of the Eclipse GLSP server framework with workflow server implementations for Ecore diagram editing.