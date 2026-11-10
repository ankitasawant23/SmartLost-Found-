import React from 'react';
import { format } from 'date-fns';
import { MapPin, Calendar, Tag, Eye, ExternalLink } from 'lucide-react';
import { Item } from '../types';
import { Link } from 'react-router-dom';

interface ItemCardProps {
  item: Item;
  showClaimButton?: boolean;
  isAdmin?: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

const ItemCard: React.FC<ItemCardProps> = ({ 
  item, 
  showClaimButton = false,
  isAdmin = false,
  onApprove,
  onReject
}) => {
  const statusColors = {
    unclaimed: 'bg-green-100 text-green-800',
    claimed: 'bg-gray-100 text-gray-800',
    pending: 'bg-yellow-100 text-yellow-800'
  };

  const typeColors = {
    found: 'bg-blue-100 text-blue-800',
    lost: 'bg-red-100 text-red-800'
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Image */}
      {item.imageUrl && (
        <div className="aspect-w-16 aspect-h-12 bg-gray-100">
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-48 object-cover"
          />
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
            {item.title}
          </h3>
          <div className="flex space-x-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColors[item.type]}`}>
              {item.type}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[item.status]}`}>
              {item.status}
            </span>
          </div>
        </div>

        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
          {item.description}
        </p>

        {/* Location and Date */}
        <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
          <div className="flex items-center">
            <MapPin className="w-4 h-4 mr-1" />
            <span>{item.location}</span>
          </div>
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-1" />
            <span>{format(item.createdAt, 'MMM d, yyyy')}</span>
          </div>
        </div>

        {/* AI Labels */}
        {item.imageLabels && item.imageLabels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {item.imageLabels.slice(0, 3).map((label, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
              >
                <Tag className="w-3 h-3 mr-1" />
                {label}
              </span>
            ))}
            {item.imageLabels.length > 3 && (
              <span className="text-xs text-gray-500">+{item.imageLabels.length - 3} more</span>
            )}
          </div>
        )}

        {/* Match Score */}
        {item.matchScore && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Match Score</span>
              <span className="font-medium text-green-600">{item.matchScore}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full"
                style={{ width: `${item.matchScore}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-2">
          {showClaimButton && item.status === 'unclaimed' && (
            <Link
              to={`/claim/${item.id}`}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors text-center"
            >
              Claim This Item
            </Link>
          )}
          
          <button className="flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Eye className="w-4 h-4 mr-1" />
            View Details
          </button>

          {isAdmin && (
            <div className="flex space-x-2">
              {onApprove && (
                <button
                  onClick={() => onApprove(item.id)}
                  className="px-3 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  Approve
                </button>
              )}
              {onReject && (
                <button
                  onClick={() => onReject(item.id)}
                  className="px-3 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  Reject
                </button>
              )}
            </div>
          )}
        </div>

        {/* Admin Info */}
        {isAdmin && (
          <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
            <p>Submitted by: {item.userEmail}</p>
            {item.claimantEmail && (
              <p>Claimed by: {item.claimantEmail}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ItemCard;