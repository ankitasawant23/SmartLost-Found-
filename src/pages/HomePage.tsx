import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Item } from '../types';
import ItemCard from '../components/ItemCard';
import { 
  Search, 
  Plus, 
  TrendingUp, 
  Clock, 
  MapPin, 
  Users,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

const HomePage: React.FC = () => {
  const [recentItems, setRecentItems] = useState<Item[]>([]);
  const [stats, setStats] = useState({
    totalItems: 0,
    foundItems: 0,
    claimedItems: 0,
    activeUsers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load recent items
        const itemsQuery = query(
          collection(db, 'items'),
          orderBy('createdAt', 'desc'),
          limit(6)
        );
        const itemsSnapshot = await getDocs(itemsQuery);
        const items = itemsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate(),
          updatedAt: doc.data().updatedAt.toDate(),
        })) as Item[];

        setRecentItems(items);

        // Load stats
        const totalQuery = query(collection(db, 'items'));
        const totalSnapshot = await getDocs(totalQuery);
        
        const foundQuery = query(collection(db, 'items'), where('type', '==', 'found'));
        const foundSnapshot = await getDocs(foundQuery);
        
        const claimedQuery = query(collection(db, 'items'), where('status', '==', 'claimed'));
        const claimedSnapshot = await getDocs(claimedQuery);

        setStats({
          totalItems: totalSnapshot.size,
          foundItems: foundSnapshot.size,
          claimedItems: claimedSnapshot.size,
          activeUsers: 150, // Mock data
        });

      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const quickActions = [
    {
      title: 'Report Found Item',
      description: 'Found something? Help others find their belongings',
      icon: Plus,
      link: '/found',
      color: 'bg-green-500',
    },
    {
      title: 'Report Lost Item',
      description: 'Lost something? Get help from the community',
      icon: AlertCircle,
      link: '/lost',
      color: 'bg-red-500',
    },
    {
      title: 'Search Items',
      description: 'Browse through found items',
      icon: Search,
      link: '/search',
      color: 'bg-blue-500',
    },
  ];

  const statCards = [
    { 
      title: 'Total Items', 
      value: stats.totalItems, 
      icon: TrendingUp, 
      color: 'text-blue-600 bg-blue-100' 
    },
    { 
      title: 'Found Items', 
      value: stats.foundItems, 
      icon: CheckCircle, 
      color: 'text-green-600 bg-green-100' 
    },
    { 
      title: 'Claimed Items', 
      value: stats.claimedItems, 
      icon: Clock, 
      color: 'text-orange-600 bg-orange-100' 
    },
    { 
      title: 'Active Users', 
      value: stats.activeUsers, 
      icon: Users, 
      color: 'text-purple-600 bg-purple-100' 
    },
  ];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow-sm">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome to Lost & Found
        </h1>
        <p className="text-gray-600">
          Help reunite lost items with their owners and find your missing belongings
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className={`p-3 rounded-full ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickActions.map((action, index) => (
            <Link
              key={index}
              to={action.link}
              className="group bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center mb-4">
                <div className={`p-3 rounded-full ${action.color} text-white`}>
                  <action.icon className="w-6 h-6" />
                </div>
                <h3 className="ml-4 text-lg font-medium text-gray-900 group-hover:text-blue-600">
                  {action.title}
                </h3>
              </div>
              <p className="text-gray-600">{action.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Items */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Recent Items</h2>
          <Link
            to="/search"
            className="text-blue-600 hover:text-blue-500 text-sm font-medium"
          >
            View All →
          </Link>
        </div>
        
        {recentItems.length === 0 ? (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No items found yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Be the first to report a found or lost item
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentItems.map((item) => (
              <ItemCard key={item.id} item={item} showClaimButton={item.type === 'found'} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;