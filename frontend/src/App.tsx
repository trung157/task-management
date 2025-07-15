import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorProvider } from './contexts/ErrorContext';
import { ErrorBoundary, ErrorManager } from './components/error/ErrorComponents';
import AppRouter from './router/AppRouter';
import { NotificationProvider } from './contexts/NotificationContext';
import './styles/globals.css';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Router>
        <ErrorProvider>
          <NotificationProvider>
            <AuthProvider>
              <AppRouter />
              <ErrorManager />
            </AuthProvider>
          </NotificationProvider>
        </ErrorProvider>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
