import { RouterProvider } from 'react-router';
import { router } from './utils/app-routes';
import { Toaster } from 'sonner@2.0.3';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <Toaster position="top-right" />
    </AuthProvider>
  );
}

export default App;