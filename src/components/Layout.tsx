import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
Home,
Search,
Plus,
User,
Settings,
Bell,
Menu,
X,
Shield,
CheckCheck
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
const [showMobileMenu, setShowMobileMenu] = useState(false);
const [showNotifications, setShowNotifications] = useState(false);

const location = useLocation();
const navigate = useNavigate();

const { user } = useAuth();

const {
notifications,
unreadCount,
markAsRead,
markAllAsRead
} = useNotification();

const handleLogout = async () => {
try {
await signOut(auth);
} catch (error) {
console.error('Error signing out:', error);
}
};

// Handle notification click
const handleNotificationClick = async (notification: any) => {
try {
if (!notification.read) {
await markAsRead(notification.id);
}

  setShowNotifications(false);

  if (notification.link) {
    navigate(notification.link);
  } else {
    console.warn('Notification link is missing:', notification.id);
  }
} catch (error) {
  console.error('Error opening notification:', error);
}

};

const navItems = [
{ path: '/', icon: Home, label: 'Home' },
{ path: '/search', icon: Search, label: 'Search' },
{ path: '/found', icon: Plus, label: 'Found', primary: true },
{ path: '/lost', icon: Plus, label: 'Lost' },
{ path: '/profile', icon: User, label: 'Profile' },
];

return ( <div className="flex flex-col min-h-screen">

  {/* Header */}
  <header className="bg-white shadow-sm border-b border-gray-200 relative z-40">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center h-16">

        {/* Logo */}
        <div className="flex items-center">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Search className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">
              Lost & Found
            </span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex space-x-8">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                location.pathname === item.path
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center space-x-4">

          {/* Notification Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-md"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />

              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">

                {/* Dropdown Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      Notifications
                    </h3>
                    <p className="text-xs text-gray-500">
                      {unreadCount} unread notifications
                    </p>
                  </div>

                  <button
                    onClick={() => markAllAsRead()}
                    disabled={unreadCount === 0}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                  >
                    <CheckCheck className="w-4 h-4" />
                    Mark all read
                  </button>
                </div>

                {/* Notification List */}
                <div className="max-h-96 overflow-y-auto">

                  {notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">
                        No notifications yet.
                      </p>
                    </div>
                  ) : (
                    notifications.map((notification: any) => (
                      <button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-blue-50 transition-colors ${
                          !notification.read ? 'bg-blue-50' : 'bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${
                            !notification.read
                              ? 'bg-blue-600'
                              : 'bg-gray-300'
                          }`} />

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">
                              {notification.title}
                            </p>

                            <p className="text-sm text-gray-600 mt-1">
                              {notification.message}
                            </p>

                            {!notification.link && (
                              <p className="text-xs text-orange-600 mt-1">
                                No page link available
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  )}

                </div>
              </div>
            )}
          </div>

          {/* Admin */}
          <Link
            to="/admin"
            className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-md"
            title="Admin"
          >
            <Shield className="w-5 h-5" />
          </Link>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
          >
            <Settings className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="md:hidden p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-md"
        >
          {showMobileMenu ? (
            <X className="w-6 h-6" />
          ) : (
            <Menu className="w-6 h-6" />
          )}
        </button>
      </div>
    </div>

    {/* Mobile Menu */}
    {showMobileMenu && (
      <div className="md:hidden bg-white border-t border-gray-200">
        <div className="px-2 pt-2 pb-3 space-y-1">

          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setShowMobileMenu(false)}
              className={`flex items-center space-x-3 px-3 py-2 rounded-md text-base font-medium transition-colors ${
                location.pathname === item.path
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          ))}

          <button
            onClick={() => {
              setShowMobileMenu(false);
              setShowNotifications(true);
            }}
            className="flex items-center space-x-3 px-3 py-2 text-base font-medium text-gray-500 hover:text-gray-700 rounded-md w-full"
          >
            <Bell className="w-5 h-5" />
            <span>Notifications ({unreadCount})</span>
          </button>

          <Link
            to="/admin"
            onClick={() => setShowMobileMenu(false)}
            className="flex items-center space-x-3 px-3 py-2 text-base font-medium text-gray-500 hover:text-gray-700 rounded-md"
          >
            <Shield className="w-5 h-5" />
            <span>Admin</span>
          </Link>

          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 px-3 py-2 text-base font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md w-full"
          >
            <Settings className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    )}
  </header>

  {/* Main Content */}
  <main className="flex-1 pb-16 md:pb-0">
    {children}
  </main>

  {/* Mobile Bottom Navigation */}
  <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30">
    <div className="flex justify-around">
      {navItems.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={`flex flex-col items-center py-2 px-3 min-w-0 flex-1 transition-colors ${
            location.pathname === item.path
              ? 'text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <item.icon className={`w-5 h-5 ${item.primary ? 'text-blue-600' : ''}`} />
          <span className="text-xs mt-1 truncate">{item.label}</span>
        </Link>
      ))}
    </div>
  </nav>
</div>
);
};

export default Layout;
