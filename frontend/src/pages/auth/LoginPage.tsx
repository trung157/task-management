import { Link } from 'react-router-dom';
import LoginForm from '../../components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
      <div className="flex min-h-full">
        {/* Left side - Branding */}
        <div className="hidden lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:px-12 lg:py-24">
          <div className="mx-auto max-w-md">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gradient mb-6">
                TaskFlow
              </h1>
              <p className="text-lg text-slate-600 mb-8">
                Streamline your productivity with intelligent task management
              </p>
              
              <div className="space-y-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100">
                    <span className="text-primary-600">✓</span>
                  </div>
                  <span className="text-slate-600">Smart task organization</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100">
                    <span className="text-primary-600">✓</span>
                  </div>
                  <span className="text-slate-600">Real-time collaboration</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100">
                    <span className="text-primary-600">✓</span>
                  </div>
                  <span className="text-slate-600">Advanced analytics</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Login Form */}
        <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-20 xl:px-24">
          <div className="mx-auto w-full max-w-sm">
            <div className="text-center lg:hidden mb-8">
              <h1 className="text-3xl font-bold text-gradient mb-2">
                TaskFlow
              </h1>
              <p className="text-slate-600">
                Welcome back to your productivity hub
              </p>
            </div>

            <div className="hidden lg:block mb-8">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                Welcome back
              </h2>
              <p className="mt-2 text-slate-600">
                Sign in to your account to continue
              </p>
            </div>

            <LoginForm />

            <div className="mt-8 text-center">
              <p className="text-sm text-slate-600">
                Don't have an account?{' '}
                <Link 
                  to="/register" 
                  className="font-medium text-primary-600 hover:text-primary-500 transition-colors"
                >
                  Sign up for free
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
