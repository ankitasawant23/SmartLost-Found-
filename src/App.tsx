import React, { useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { auth, db } from './lib/firebase';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import FoundItemPage from './pages/FoundItemPage';
import LostItemPage from './pages/LostItemPage';
import SearchPage from './pages/SearchPage';
import ClaimPage from './pages/ClaimPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import LoadingSpinner from './components/LoadingSpinner';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminCheckLoading, setAdminCheckLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAdmin(false);

      if (!currentUser) {
        setAdminCheckLoading(false);
        setLoading(false);
        return;
      }

      setAdminCheckLoading(true);

      try {
        const userDoc = await getDoc(
          doc(db, 'users', currentUser.uid)
        );

        setIsAdmin(
          userDoc.exists() && userDoc.data().isAdmin === true
        );
      } catch (error) {
        console.error('Failed to check admin permission:', error);
        setIsAdmin(false);
      } finally {
        setAdminCheckLoading(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading || adminCheckLoading) {
    return <LoadingSpinner />;
  }

  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <div className="min-h-screen bg-gray-50">
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
              }}
            />

            {!user ? (
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="*"
                  element={<Navigate to="/login" replace />}
                />
              </Routes>
            ) : (
              <Layout>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/found" element={<FoundItemPage />} />
                  <Route path="/lost" element={<LostItemPage />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/claim/:id" element={<ClaimPage />} />
                  <Route path="/profile" element={<ProfilePage />} />

                  <Route
                    path="/admin"
                    element={
                      isAdmin ? (
                        <AdminPage />
                      ) : (
                        <Navigate to="/" replace />
                      )
                    }
                  />

                  <Route
                    path="*"
                    element={<Navigate to="/" replace />}
                  />
                </Routes>
              </Layout>
            )}
          </div>
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;

