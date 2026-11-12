import { createBrowserRouter, RouterProvider } from 'react-router';
import { EditorPage } from './pages/EditorPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PublicPage } from './pages/PublicPage';
import { QrPage } from './pages/QrPage';

const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/edit/:draftId', element: <EditorPage /> },
  { path: '/t/:id', element: <PublicPage /> },
  { path: '/t/:id/qr', element: <QrPage /> },
  { path: '*', element: <NotFoundPage /> },
]);

export function App() {
  return <RouterProvider router={router} />;
}
