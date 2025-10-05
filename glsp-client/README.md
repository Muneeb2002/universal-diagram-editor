# GLSP Client Framework

This repository contains the Eclipse GLSP (Graphical Language Server Platform) client framework and a standalone workflow application.

## 📁 Project Structure

```
glsp-client/
├── packages/                    # Core GLSP client framework
│   ├── client/                 # Main client framework
│   ├── glsp-sprotty/          # Sprotty integration layer
│   └── protocol/              # Communication protocol
├── workflow-standalone/        # Standalone workflow application
├── package.json               # Root package configuration
└── tsconfig.json             # TypeScript configuration
```

## 🏗️ Architecture Overview

### Core Framework (`packages/`)
- **`@eclipse-glsp/client`** - Main client framework with features, tools, and UI components
- **`@eclipse-glsp/sprotty`** - Enhanced Sprotty integration for GLSP
- **`@eclipse-glsp/protocol`** - Client-server communication protocol

### Application (`workflow-standalone/`)
- **Standalone web application** that uses the GLSP framework
- **Ecore diagram editor** with file picker and toolbar
- **Complete browser application** with HTML, CSS, and webpack bundling

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

#### 2. Application Development
```bash
# Navigate to standalone app
cd workflow-standalone

# Install dependencies
yarn install

# Build the application
yarn build

# Start development server
yarn start:exampleServer

# Watch mode
yarn watch
```

## 📦 Package Details

### `@eclipse-glsp/client`
**Purpose**: Main client framework for building diagram editors

**Key Features**:
- Tool palette and command palette
- Editing tools (move, resize, create, delete)
- Context menus and keyboard shortcuts
- Accessibility features
- Export functionality
- Validation and error handling

**Build**: `yarn build` (compiles TypeScript to JavaScript)

### `@eclipse-glsp/sprotty`
**Purpose**: Enhanced Sprotty integration layer

**Key Features**:
- GLSP-specific Sprotty extensions
- Layout overrides
- SVG view customizations
- API overrides

**Build**: `yarn build` (compiles TypeScript to JavaScript)

### `@eclipse-glsp/protocol`
**Purpose**: Communication protocol between client and server

**Key Features**:
- JSON-RPC based communication
- Action protocol definitions
- Client-server interfaces
- Shared utilities

**Build**: `yarn build` (compiles TypeScript to JavaScript)

### `workflow-standalone`
**Purpose**: Complete standalone web application

**Key Features**:
- Ecore diagram editor
- File picker for loading metamodels
- Custom toolbar
- WebSocket connection to GLSP server
- Webpack bundling for deployment

**Build**: `yarn build` (TypeScript compilation + webpack bundling)

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

### Application Commands (workflow-standalone/)
```bash
yarn build              # Build application (compile + bundle)
yarn compile            # Compile TypeScript
yarn bundle             # Bundle with webpack
yarn start:exampleServer # Start example server
yarn watch              # Watch mode (compile + bundle)
yarn clean              # Clean build artifacts
```

## 🌐 Running the Application

### 1. Start the GLSP Server
```bash
# In another terminal, start the GLSP server
cd ../glsp-server-node/workflow-server-bundled
yarn start:websocket
```

### 2. Start the Client Application
```bash
# In glsp-client/workflow-standalone
yarn start:exampleServer
```

### 3. Open in Browser
Navigate to `http://localhost:3000` (or the port shown in the console)

## 📝 Customization

### Adding New Features
1. **Create feature module** in `packages/client/src/features/`
2. **Export from index** - run `yarn generate:index`
3. **Build packages** - `yarn build`
4. **Use in application** - import and configure in `workflow-standalone`

### Custom Diagram Types
1. **Define model elements** in your application
2. **Create views** for rendering
3. **Configure in diagram module**
4. **Add to container** configuration

## 🔗 Dependencies

### Framework Dependencies
- **Sprotty** - Diagram rendering engine
- **Inversify** - Dependency injection
- **Snabbdom** - Virtual DOM
- **Lodash** - Utility functions

### Application Dependencies
- **@eclipse-glsp/client** - GLSP framework
- **Webpack** - Module bundler
- **TypeScript** - Type-safe JavaScript

## 🐛 Troubleshooting

### Build Issues
```bash
# Clean everything and rebuild
yarn clean
yarn install
yarn build
```

### Port Conflicts
- GLSP Server: Default port 8081 (WebSocket)
- Client App: Default port 3000
- Change ports in respective configuration files

### TypeScript Errors
```bash
# Regenerate index files
yarn generate:index

# Check TypeScript configuration
yarn compile
```

## 📚 Additional Resources

- [Eclipse GLSP Documentation](https://www.eclipse.org/glsp/)
- [Sprotty Documentation](https://github.com/eclipse/sprotty)
- [TypeScript Documentation](https://www.typescriptlang.org/)

## 🤝 Contributing

1. Make changes to the appropriate package
2. Run tests: `yarn test`
3. Lint code: `yarn lint`
4. Build: `yarn build`
5. Test the application: `yarn start:exampleServer`

---

**Note**: This is a customized version of the Eclipse GLSP client framework with a standalone workflow application for Ecore diagram editing.