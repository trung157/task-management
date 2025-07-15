# 🚀 TaskFlow - Modern Task Management App

<div align="center">
  <img src="public/vite.svg" alt="TaskFlow Logo" width="120" height="120">
  
  **A beautiful, modern task management application built with React, TypeScript, and Tailwind CSS**
  
  [![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.0+-blue.svg)](https://tailwindcss.com/)
  [![Vite](https://img.shields.io/badge/Vite-5.0+-purple.svg)](https://vitejs.dev/)
</div>

## ✨ Features

### 🎨 **Beautiful Modern UI**
- **Glassmorphism Design**: Stunning glass-like components with backdrop blur effects
- **Gradient Backgrounds**: Eye-catching animated gradient backgrounds
- **Dark Theme**: Optimized for low-light environments
- **Responsive Design**: Perfect on desktop, tablet, and mobile devices
- **Micro-interactions**: Smooth animations and hover effects

### 📋 **Smart Task Management**
- **Create & Edit Tasks**: Intuitive form with validation
- **Priority Levels**: High, Medium, Low priority with visual indicators
- **Due Dates**: Date picker with overdue highlighting
- **Status Tracking**: Pending and Completed task sections
- **Search & Filter**: Real-time search with multiple filter options
- **Progress Analytics**: Visual progress tracking and statistics

### 🔍 **Advanced Filtering**
- **Text Search**: Search by title, description, or tags
- **Status Filter**: All, Pending, Completed
- **Priority Filter**: Filter by priority levels
- **Active Filter Display**: See all applied filters at a glance
- **One-click Clear**: Reset all filters instantly

### 📱 **Mobile-First Design**
- **Touch-Friendly**: Large touch targets for mobile devices
- **Responsive Grid**: Adapts from 1-column to 4-column layout
- **Mobile Sidebar**: Collapsible sidebar for small screens
- **Swipe Gestures**: (Future enhancement)

## 🏗️ Architecture & Best Practices

### **International UI/UX Standards**
- **Left-to-Right Layout**: Sidebar → Main Content → Secondary Content
- **F-Pattern Design**: Natural reading flow optimization
- **Consistent Navigation**: Predictable interface patterns
- **Accessibility First**: WCAG 2.1 compliance with focus management
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
