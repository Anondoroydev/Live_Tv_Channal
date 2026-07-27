import { Channel, EPGProgram } from '../types';

export const INITIAL_CHANNELS: Channel[] = [
  {
    id: 'ch-1',
    name: 'Somoy News Live HD',
    category: 'Bangla',
    logo: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=200&auto=format&fit=crop&q=80',
    streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    channelNumber: 101,
    isPremium: false,
    isActive: true,
    tvgId: 'somoy-tv'
  },
  {
    id: 'ch-2',
    name: 'Sports HD World',
    category: 'Sports',
    logo: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=200&auto=format&fit=crop&q=80',
    streamUrl: 'https://playertest.longtailvideo.com/adaptive/bbbell/bbbell.m3u8',
    channelNumber: 102,
    isPremium: true,
    isActive: true,
    tvgId: 'sports-hd'
  },
  {
    id: 'ch-3',
    name: 'Action Movies 24/7',
    category: 'Movies',
    logo: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=200&auto=format&fit=crop&q=80',
    streamUrl: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
    channelNumber: 103,
    isPremium: false,
    isActive: true,
    tvgId: 'sintel-movies'
  },
  {
    id: 'ch-4',
    name: 'Cinema World Premiere',
    category: 'Entertainment',
    logo: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=200&auto=format&fit=crop&q=80',
    streamUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    channelNumber: 104,
    isPremium: true,
    isActive: true,
    tvgId: 'tears-of-steel'
  },
  {
    id: 'ch-5',
    name: 'Nature & Relaxing TV',
    category: 'Entertainment',
    logo: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200&auto=format&fit=crop&q=80',
    streamUrl: 'https://vjs.zencdn.net/v8.16.1/ocean.mp4',
    channelNumber: 105,
    isPremium: false,
    isActive: true,
    tvgId: 'ocean-tv'
  },
  {
    id: 'ch-6',
    name: 'Global News 24',
    category: 'News',
    logo: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=200&auto=format&fit=crop&q=80',
    streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    channelNumber: 106,
    isPremium: false,
    isActive: true,
    tvgId: 'global-news'
  }
];

export function generateSampleEPG(channelId: string): EPGProgram[] {
  const now = new Date();
  const startTime = new Date(now.getTime() - 15 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const endTime = new Date(now.getTime() + 45 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const nextStart = endTime;
  const nextEnd = new Date(now.getTime() + 105 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return [
    {
      id: `epg-now-${channelId}`,
      channelId,
      title: 'Live Stream Program',
      description: 'Current live broadcast on channel.',
      startTime,
      endTime,
      category: 'General'
    },
    {
      id: `epg-next-${channelId}`,
      channelId,
      title: 'Upcoming Broadcast',
      description: 'Next scheduled program.',
      startTime: nextStart,
      endTime: nextEnd,
      category: 'General'
    }
  ];
}

