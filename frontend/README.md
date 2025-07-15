# Task Management Frontend

A modern React TypeScript frontend for task management built with Vite, React Router, Context API, and Tailwind CSS.

## 🚀 Features

- **Modern React with TypeScript** - Type-safe development with latest React patterns
- **React Router** - Client-side routing with protected routes
- **Context API** - Global state management for auth, tasks, and notifications
- **Tailwind CSS** - Utility-first CSS framework for rapid UI development
- **React Query** - Powerful data fetching and caching
- **React Hook Form** - Performant forms with easy validation
- **Responsive Design** - Mobile-first responsive design
- **Component Organization** - Well-structured and reusable components

## 📁 Project Structure

```
frontend/
├── public/                 # Static assets
├── src/
│   ├── assets/            # Images, fonts, etc.
│   ├── components/        # Reusable UI components
│   │   ├── auth/         # Authentication components
│   │   ├── layout/       # Layout components (Header, Sidebar)
│   │   └── ui/           # Generic UI components
│   ├── contexts/         # React Context providers
│   │   ├── AuthContext.tsx
│   │   ├── TaskContext.tsx
│   │   └── NotificationContext.tsx
│   ├── hooks/            # Custom React hooks
│   ├── pages/            # Page components
│   │   ├── auth/         # Login, Register pages
│   │   ├── dashboard/    # Dashboard page
│   │   ├── tasks/        # Task management pages
│   │   ├── categories/   # Category management
│   │   └── profile/      # User profile
│   ├── services/         # API service layer
│   ├── styles/           # Global styles and CSS
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions
│   ├── App.tsx           # Main app component
│   ├── main.tsx          # Application entry point
│   └── env.d.ts          # Environment type definitions
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 🛠️ Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **State Management**: React Context API
- **Data Fetching**: React Query (TanStack Query)
- **Forms**: React Hook Form
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios
- **Icons**: Emoji-based icons (can be replaced with icon library)

## 🚦 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env.local
```

4. Update environment variables in `.env.local`:
```env
VITE_API_URL=http://localhost:3001/api
VITE_APP_TITLE=TaskFlow
VITE_APP_VERSION=1.0.0
```

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Build

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## 🔧 Configuration

### Path Aliases

The project uses path aliases for cleaner imports:

- `@/*` - src directory
- `@components/*` - components directory
- `@pages/*` - pages directory
- `@hooks/*` - hooks directory
- `@utils/*` - utils directory
- `@services/*` - services directory
- `@types/*` - types directory
- `@contexts/*` - contexts directory
- `@assets/*` - assets directory
- `@styles/*` - styles directory

### API Configuration

The frontend is configured to proxy API requests to `http://localhost:3001` during development. Update the proxy settings in `vite.config.ts` if your backend runs on a different port.

## 🎨 Styling

### Tailwind CSS

The project uses Tailwind CSS with custom configurations:

- Custom color palette defined in `tailwind.config.js`
- Component classes in `src/styles/globals.css`
- Responsive design utilities
- Dark mode support (can be enabled)

### Component Classes

Common component classes are defined in the global CSS:

- `.btn-primary`, `.btn-secondary`, `.btn-danger` - Button styles
- `.input-field`, `.input-field-error` - Input field styles
- `.card`, `.card-header`, `.card-body` - Card component styles
- `.badge-*` - Badge/tag styles

## 🔐 Authentication

The app includes a complete authentication system:

- Login and registration pages
- Protected routes
- JWT token management
- User context and hooks
- Automatic token refresh (backend support required)

## 📱 State Management

### Context Providers

- **AuthContext** - User authentication state
- **TaskContext** - Task management state and operations
- **NotificationContext** - Global notification system

### Usage Example

```tsx
// Using auth context
const { user, login, logout } = useAuth()

// Using task context
const { tasks, addTask, updateTask } = useTask()

// Using notification context
const { addNotification } = useNotification()

addNotification({
  type: 'success',
  title: 'Task completed!',
  message: 'Great job on finishing your task.'
})
```

## 🧩 Components

### Layout Components

- **Layout** - Main application layout with sidebar and header
- **Header** - Top navigation bar with user menu
- **Sidebar** - Left navigation sidebar
- **ProtectedRoute** - Route wrapper for authenticated users

### UI Components

- **LoadingSpinner** - Loading indicator
- **NotificationContainer** - Global notification display

### Page Components

All pages are organized by feature:

- Authentication (Login, Register)
- Dashboard (Overview and stats)
- Tasks (Task listing and management)
- Categories (Category management)
- Profile (User settings)

## 🔌 API Integration

### Service Layer

API calls are organized in the `services/` directory:

- `authService.ts` - Authentication endpoints
- Additional services can be added for tasks, categories, etc.

### Example Service Usage

```tsx
// In a component
const handleLogin = async (credentials) => {
  try {
    await login(credentials)
    navigate('/dashboard')
  } catch (error) {
    addNotification({
      type: 'error',
      title: 'Login failed',
      message: error.message
    })
  }
}
```

## 🧪 Testing

Testing setup is prepared but not fully implemented. The project is configured for:

- Jest or Vitest for unit testing
- React Testing Library for component testing
- Test utilities and setup files

## 📦 Build Output

The production build includes:

- Optimized bundle splitting
- Source maps for debugging
- Vendor chunk separation
- Tree-shaking for minimal bundle size

## 🤝 Contributing

1. Follow the established folder structure
2. Use TypeScript for all new files
3. Follow the existing naming conventions
4. Add proper error handling
5. Update types when adding new features

## 📄 Environment Variables

Create a `.env.local` file with:

```env
VITE_API_URL=http://localhost:3001/api
VITE_APP_TITLE=TaskFlow
VITE_APP_VERSION=1.0.0
```

## 🔗 Related

- Backend API: `../backend/` - Node.js/Express backend
- Database: PostgreSQL with TypeORM
- Authentication: JWT-based authentication

## 📚 Learn More

- [React Documentation](https://reactjs.org/)
- [Vite Documentation](https://vitejs.dev/)
- [React Router](https://reactrouter.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [React Query](https://tanstack.com/query/)
