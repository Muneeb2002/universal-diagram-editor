# GLSP Ecore Diagram Editor

A complete Eclipse GLSP (Graphical Language Server Platform) implementation for Ecore diagram editing, consisting of both client and server components.

## 📁 Project Structure

```
glsp-ecore-server-pichipi/
├── glsp-client/                 # GLSP Client Framework & Application
│   ├── packages/               # Core client framework
│   └── workflow-standalone/    # Standalone web application
├── glsp-server-node/           # GLSP Server Framework & Implementation
│   ├── packages/               # Core server framework
│   ├── workflow-server/        # Development server
│   └── workflow-server-bundled/ # Deployment server
└── README.md                   # This file
```

## 🏗️ Architecture Overview

This project implements a **client-server architecture** for diagram editing:

```
┌─────────────────┐    WebSocket/HTTP    ┌─────────────────┐
│   GLSP Client   │ ◄─────────────────► │   GLSP Server   │
│                 │                      │                 │
│ • Web Browser   │                      │ • Node.js       │
│ • Diagram UI    │                      │ • Model Logic   │
│ • User Input    │                      │ • Operations    │
│ • Rendering     │                      │ • Persistence   │
└─────────────────┘                      └─────────────────┘
```

### Client Side (`glsp-client/`)
- **Framework**: Core GLSP client libraries
- **Application**: Standalone web application for Ecore diagrams
- **Technology**: TypeScript, Sprotty, Webpack

### Server Side (`glsp-server-node/`)
- **Framework**: Core GLSP server libraries  
- **Implementation**: Workflow server for Ecore model handling
- **Technology**: Node.js, TypeScript, JSON-RPC

## 🚀 Quick Start

### Prerequisites
- **Node.js** >= 20
- **Yarn** >= 1.7.0

### 1. Build Everything
```bash
# Build client framework and application
cd glsp-client
yarn install
yarn build

# Build server framework and implementation
cd ../glsp-server-node
yarn install
yarn build
```

### 2. Start the Server
```bash
# Start the GLSP server (WebSocket mode)
cd glsp-server-node/workflow-server-bundled
yarn start:websocket
```
Server will start on `ws://localhost:8081`

### 3. Start the Client
```bash
# Start the web application
cd glsp-client/workflow-standalone
yarn start:exampleServer
```
Client will start on `http://localhost:3000`

### 4. Open in Browser
Navigate to `http://localhost:3000` to use the Ecore diagram editor.

## 🔧 Development Workflow

### Client Development
```bash
cd glsp-client

# Framework development
yarn build          # Build all packages
yarn watch          # Watch mode for packages
yarn test           # Run tests
yarn lint           # Lint code

# Application development
cd workflow-standalone
yarn build          # Build application
yarn watch          # Watch mode
yarn start:exampleServer  # Start dev server
```

### Server Development
```bash
cd glsp-server-node

# Framework development
yarn build          # Build all packages
yarn watch          # Watch mode for packages
yarn test           # Run tests
yarn lint           # Lint code

# Server development
cd workflow-server
yarn build          # Build server
yarn test           # Run tests

# Server deployment
cd ../workflow-server-bundled
yarn start:websocket  # Start bundled server
```

## 📦 Components

### Client Components
| Component | Purpose | Technology |
|-----------|---------|------------|
| `@eclipse-glsp/client` | Main client framework | TypeScript, Sprotty |
| `@eclipse-glsp/sprotty` | Sprotty integration | TypeScript, Sprotty |
| `@eclipse-glsp/protocol` | Communication protocol | TypeScript, JSON-RPC |
| `workflow-standalone` | Web application | TypeScript, Webpack |

### Server Components
| Component | Purpose | Technology |
|-----------|---------|------------|
| `@eclipse-glsp/server` | Main server framework | TypeScript, Node.js |
| `@eclipse-glsp/graph` | Graph model utilities | TypeScript |
| `@eclipse-glsp/layout-elk` | Layout engine | TypeScript, ELK |
| `workflow-server` | Development server | TypeScript |
| `workflow-server-bundled` | Deployment server | JavaScript |

## 🌐 Network Configuration

### Default Ports
- **Client Application**: `http://localhost:3000`
- **GLSP Server (HTTP)**: `http://localhost:5007`
- **GLSP Server (WebSocket)**: `ws://localhost:8081`

### Connection Flow
1. Client loads in browser (`localhost:3000`)
2. Client connects to server via WebSocket (`localhost:8081`)
3. Server handles diagram operations and model management
4. Client renders diagram updates in real-time

## 📝 Features

### Ecore Diagram Editor
- **File Loading**: Load Ecore metamodel files
- **Visual Editing**: Create, edit, and delete Ecore elements
- **Real-time Updates**: Live synchronization between client and server
- **Layout Management**: Automatic and manual layout options
- **Validation**: Model validation with error reporting

### Development Features
- **Hot Reload**: Development servers with watch mode
- **Type Safety**: Full TypeScript support
- **Modular Architecture**: Extensible framework design
- **Testing**: Comprehensive test suites
- **Linting**: Code quality enforcement

## 🔧 Configuration

### Client Configuration
- **Webpack**: Module bundling and development server
- **TypeScript**: Type checking and compilation
- **ESLint**: Code linting and formatting
- **Environment**: Development and production builds

### Server Configuration
- **Ports**: Configurable via command line arguments
- **Logging**: Console and file logging options
- **WebSocket**: Real-time communication setup
- **CORS**: Cross-origin request handling

## 🐛 Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Check if ports are in use
lsof -i :3000  # Client port
lsof -i :8081  # Server WebSocket port
lsof -i :5007  # Server HTTP port

# Kill processes if needed
kill -9 <PID>
```

#### Build Failures
```bash
# Clean and rebuild
yarn clean
rm -rf node_modules
yarn install
yarn build
```

#### Connection Issues
```bash
# Test server connectivity
curl http://localhost:5007/health

# Check WebSocket connection in browser dev tools
# Network tab → WS filter
```

### Debug Mode
```bash
# Server with debug logging
cd glsp-server-node/workflow-server-bundled
yarn start:websocket --logLevel 5

# Client with source maps
cd glsp-client/workflow-standalone
yarn watch  # Enables source maps
```

## 🚀 Deployment

### Development Deployment
```bash
# Start both client and server
./start-dev.sh  # Create this script for convenience
```

### Production Deployment
```bash
# Build everything
yarn build

# Deploy server
cd glsp-server-node/workflow-server-bundled
yarn start:websocket

# Deploy client (static files)
cd glsp-client/workflow-standalone
yarn build
# Serve app/ directory with any web server
```

### Docker Deployment
```dockerfile
# Server
FROM node:20-alpine
WORKDIR /app
COPY glsp-server-node/workflow-server-bundled/ .
EXPOSE 8081
CMD ["node", "wf-glsp-server-node.js", "--port", "8081", "--webSocket"]

# Client
FROM nginx:alpine
COPY glsp-client/workflow-standalone/app/ /usr/share/nginx/html/
EXPOSE 80
```

## 📚 Documentation

- **[Client Documentation](glsp-client/README.md)** - Detailed client framework and application guide
- **[Server Documentation](glsp-server-node/README.md)** - Detailed server framework and implementation guide
- **[Eclipse GLSP](https://www.eclipse.org/glsp/)** - Official GLSP documentation
- **[Sprotty](https://github.com/eclipse/sprotty)** - Diagram rendering engine

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Run tests**: `yarn test`
5. **Lint code**: `yarn lint`
6. **Build**: `yarn build`
7. **Test the application**: Start both client and server
8. **Submit a pull request**

## 📄 License

This project is based on the Eclipse GLSP framework and follows the same licensing terms.

---

**Note**: This is a customized implementation of Eclipse GLSP specifically designed for Ecore diagram editing with both client and server components.
