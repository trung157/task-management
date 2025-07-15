# 🚀 TaskFlow - Full-Stack Task Management System

<## 🚀 **Quick Start**

### Step 1: Check System Requirements

Before starting, run the requirements check script:

```bash
# Windows
check-requirements.bat

# Linux/macOS  
chmod +x check-requirements.sh
./check-requirements.sh
```

This will verify that you have all necessary tools installed.

### Step 2: Prerequisites align="center">
  
  **A modern, scalable task management platform built with React, Node.js, TypeScript, and PostgreSQL**
  
  [![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)
  [![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue.svg)](https://postgresql.org/)
  [![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://docker.com/)
  [![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
</div>

## �️ **Project Structure**

This is a monorepo containing both frontend and backend applications:

```
task-management/
├── 📁 frontend/          # React + TypeScript frontend
├── 📁 backend/           # Node.js + Express API
├── 📁 docs/              # Documentation files
├── 🐳 docker-compose.yml # Multi-service container setup
├── 📋 package.json       # Workspace configuration
└── 📖 README.md          # This file
```

## ✨ **Key Features**

### 🎯 **Core Functionality**
- **Task Management**: Create, edit, delete, and organize tasks
- **User Authentication**: JWT-based secure authentication
- **Real-time Updates**: Live task updates across sessions
- **Priority Management**: High, Medium, Low priority levels
- **Status Tracking**: Pending, In Progress, Completed states
- **Due Date Management**: Calendar integration with notifications

### 🔐 **Security & Performance**
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: API protection against abuse
- **Input Validation**: Comprehensive data validation
- **SQL Injection Protection**: Parameterized queries
- **CORS Configuration**: Secure cross-origin requests
- **Caching**: Redis caching for improved performance

### 📊 **Advanced Features**
- **Search & Filter**: Advanced filtering and search capabilities
- **Bulk Operations**: Multi-task operations
- **Analytics**: Task completion metrics and insights
- **File Uploads**: Task attachment support
- **Email Notifications**: Automated task reminders
- **API Versioning**: Future-proof API design

## � **Quick Start**

### Prerequisites
- **Node.js** 18.0.0 or higher ([Download here](https://nodejs.org/))
- **PostgreSQL** 15 or higher
- **Redis** (for caching)
- **Docker** (optional, for containerized setup)

> ⚠️ **Important**: If you get "npm is not recognized" error, please follow the [Installation Guide](./INSTALL.md) first.

### 🐳 **Docker Setup (Recommended)**

1. **Install Prerequisites:**
   - Install [Node.js](https://nodejs.org/) (required for development)
   - Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)

2. **Clone the repository**
   ```bash
   git clone https://github.com/trung157/task-management.git
   cd task-management
   ```

3. **Environment Setup**
   ```bash
   # Windows
   copy "backend\.env.example" "backend\.env"
   
   # Linux/macOS
   cp backend/.env.example backend/.env
   
   # Edit backend/.env with your configuration
   ```

4. **Start with Docker**
   ```bash
   docker-compose up -d
   ```

4. **Access the Application**
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:3000
   - API Documentation: http://localhost:3000/docs

### 💻 **Local Development Setup**

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Setup Database**
   ```bash
   # Start PostgreSQL and Redis
   # Create database: taskflow_db
   ```

3. **Configure Environment**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env file with your database credentials
   ```

4. **Run Database Migrations**
   ```bash
   npm run db:migrate
   ```

5. **Start Development Servers**
   ```bash
   # Start both frontend and backend
   npm run dev
   
   # Or start individually
   npm run dev:backend   # Backend on port 3000
   npm run dev:frontend  # Frontend on port 5173
   ```

## 📁 **Technology Stack**

### **Frontend**
- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **React Query** - Server state management
- **React Router** - Client-side routing
- **Framer Motion** - Animation library

### **Backend**
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **TypeScript** - Type-safe server development
- **PostgreSQL** - Primary database
- **Redis** - Caching and session storage
- **JWT** - Authentication tokens
- **Winston** - Logging framework

### **DevOps & Tools**
- **Docker** - Containerization
- **Jest** - Testing framework
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **GitHub Actions** - CI/CD pipeline

## 📚 **Documentation**

- [Frontend Documentation](./frontend/README.md)
- [Backend API Documentation](./backend/README.md)
- [API Reference](./backend/openapi.yaml)
- [Environment Setup](./backend/ENVIRONMENT_SETUP_GUIDE.md)
- [Database Schema](./backend/DATABASE_SETUP.md)

## 🧪 **Testing**

```bash
# Run all tests
npm run test

# Backend tests
npm run test:backend

# Frontend tests  
npm run test:frontend

# Integration tests
npm run test:integration
```

## 🚀 **Deployment**

### **Production Build**
```bash
npm run build
```

### **Docker Production**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 **Team**

- **TaskFlow Team** - Initial work

## 🙏 **Acknowledgments**

- React team for the amazing framework
- Express.js community for the robust backend framework
- PostgreSQL for the reliable database
- All open source contributors

---

<div align="center">
  <p>Made with ❤️ by TaskFlow Team</p>
  <p>
    <a href="https://github.com/trung157/task-management/issues">Report Bug</a> •
    <a href="https://github.com/trung157/task-management/issues">Request Feature</a>
  </p>
</div>
- **Progressive Enhancement**: Works without JavaScript

### **Component Structure**
```
src/
├── components/
│   ├── TaskForm.tsx      # Task creation/editing form
│   ├── TaskList.tsx      # Main task display with sections
│   ├── TaskItem.tsx      # Individual task card
│   └── TaskFilter.tsx    # Search and filter controls
├── types/
│   └── Task.ts          # TypeScript type definitions
└── styles/
    ├── index.css        # Global styles with design tokens
    └── App.css         # Component-specific styles
```

### **Design System**
- **Design Tokens**: Consistent spacing, colors, and typography
- **Component Variants**: Reusable component patterns
- **Utility Classes**: Tailwind CSS for rapid development
- **Custom Properties**: CSS variables for theming

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd task-management
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Start development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. **Open in browser**
   ```
   http://localhost:5173
   ```

## 🛠️ Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript check
```

## 🎯 Usage Guide

### **Creating Tasks**
1. Fill in the task form in the main content area
2. Set priority level (High, Medium, Low)
3. Choose due date (optional)
4. Click "Add Task" or press Enter

### **Managing Tasks**
- **Complete**: Click the checkbox to mark as done
- **Edit**: Click the edit button on any task
- **Delete**: Click the delete button with confirmation
- **Priority**: Visual badges show priority levels

### **Filtering & Search**
- **Search**: Type in the search box for real-time filtering
- **Status**: Filter by All, Pending, or Completed
- **Priority**: Filter by priority levels
- **Clear**: Use "Clear All" to reset filters

## 🎨 Design Highlights

### **Color Palette**
- **Primary**: Indigo to Purple gradient
- **Secondary**: Blue to Pink gradient  
- **Accent**: Green for success, Red for urgent, Yellow for pending
- **Neutrals**: White/transparent overlays for glassmorphism

### **Typography**
- **Headings**: Inter font family, semibold weights
- **Body Text**: System fonts for optimal readability
- **UI Text**: Consistent sizing scale (xs, sm, base, lg, xl, 2xl)

### **Layout Grid**
- **Desktop**: 4-column grid (1-3 split)
- **Tablet**: 2-column grid
- **Mobile**: Single column stack

## 🔧 Technical Details

### **Built With**
- **React 18+**: Modern React with hooks and functional components
- **TypeScript 5+**: Full type safety and IntelliSense
- **Tailwind CSS 3+**: Utility-first CSS framework
- **Vite 5+**: Lightning-fast build tool
- **PostCSS**: CSS processing and optimization

### **Browser Support**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### **Performance Optimizations**
- **Code Splitting**: Automatic route-based splitting
- **Tree Shaking**: Unused code elimination
- **Image Optimization**: WebP format support
- **Lazy Loading**: Components load on demand

## 🌟 Future Enhancements

- [ ] **Database Integration**: Persistent storage with API
- [ ] **User Authentication**: Multi-user support
- [ ] **Task Categories**: Organize tasks by category
- [ ] **Drag & Drop**: Reorder tasks and priorities
- [ ] **Notifications**: Browser notifications for due dates
- [ ] **Offline Support**: PWA with service workers
- [ ] **Export/Import**: CSV, JSON export capabilities
- [ ] **Team Collaboration**: Share tasks with others

## 📚 Resources

- [React Documentation](https://reactjs.org/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Vite Guide](https://vitejs.dev/guide/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <p>Built with ❤️ using modern web technologies</p>
  <p>© 2025 TaskFlow. All rights reserved.</p>
</div>
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
