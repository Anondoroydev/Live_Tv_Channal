import type { Channel, EPGProgram } from "../types";

// Empty initial channels - all channels load dynamically from Firestore M3U database
export const INITIAL_CHANNELS: Channel[] = [];

export function generateSampleEPG(channelId: string): EPGProgram[] {
  const now = new Date();
  const startTime = new Date(now.getTime() - 15 * 60 * 1000).toLocaleTimeString(
    [],
    { hour: "2-digit", minute: "2-digit" },
  );
  const endTime = new Date(now.getTime() + 45 * 60 * 1000).toLocaleTimeString(
    [],
    { hour: "2-digit", minute: "2-digit" },
  );
  const nextStart = endTime;
  const nextEnd = new Date(now.getTime() + 105 * 60 * 1000).toLocaleTimeString(
    [],
    { hour: "2-digit", minute: "2-digit" },
  );

  return [
    {
      id: `epg-now-${channelId}`,
      channelId,
      title: "Live Stream Program",
      description: "Current live broadcast on channel.",
      startTime,
      endTime,
      category: "General",
    },
    {
      id: `epg-next-${channelId}`,
      channelId,
      title: "Upcoming Broadcast",
      description: "Next scheduled program.",
      startTime: nextStart,
      endTime: nextEnd,
      category: "General",
    },
  ];
}
