'use client';

import { useState, useEffect } from 'react';
import { Package, DollarSign, Bell, Edit, Trash2, Activity } from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'add' | 'sale' | 'price_update' | 'alert' | 'edit' | 'delete';
  sku: string | null;
  item_name: string | null;
  message: string;
  metadata: any;
  created_at: string;
}

export function PortfolioActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivity() {
      try {
        setLoading(true);
        const response = await fetch('/api/portfolio/activity?limit=10');

        if (!response.ok) {
          throw new Error('Failed to fetch activity');
        }

        const data = await response.json();
        setActivities(data.activities || []);
      } catch (err) {
        console.error('Failed to load activity feed:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchActivity();
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'add':
        return <Package className="w-4 h-4" />;
      case 'sale':
        return <DollarSign className="w-4 h-4" />;
      case 'alert':
        return <Bell className="w-4 h-4" />;
      case 'edit':
        return <Edit className="w-4 h-4" />;
      case 'delete':
        return <Trash2 className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'add':
        return 'text-blue-400';
      case 'sale':
        return 'text-[#00FF94]';
      case 'alert':
        return 'text-amber-400';
      case 'edit':
        return 'text-purple-400';
      case 'delete':
        return 'text-red-400';
      default:
        return 'text-white/50';
    }
  };

  const formatRelativeTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  if (loading) {
    return (
      <div className="bg-black/40 border border-white/10 rounded-lg p-4">
        <h3 className="text-sm font-medium text-white mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-white/10 rounded w-3/4 animate-pulse" />
                <div className="h-3 bg-white/5 rounded w-1/4 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="bg-black/40 border border-white/10 rounded-lg p-4">
        <h3 className="text-sm font-medium text-white mb-4">Recent Activity</h3>
        <div className="text-center py-8">
          <Activity className="w-10 h-10 mx-auto mb-3 text-white/20" />
          <p className="text-white/40 text-sm">No recent activity</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/40 border border-white/10 rounded-lg p-4">
      <h3 className="text-sm font-medium text-white mb-4">Recent Activity</h3>
      <div className="space-y-3">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-3 group"
          >
            <div className={`w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 ${getIconColor(activity.type)}`}>
              {getIcon(activity.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/80 group-hover:text-white transition-colors">
                {activity.message}
              </p>
              <p className="text-xs text-white/40 mt-1">
                {formatRelativeTime(activity.created_at)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
