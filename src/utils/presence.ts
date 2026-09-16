import { UserAccount } from '../types';

export interface PresenceSession {
  sessionId: string;
  userId: string;
  username: string;
  avatar?: string;
  lastSeen: number;
}

const PRESENCE_STORAGE_KEY = 'nlbc_active_presence_sessions_v1';
const PRESENCE_TIMEOUT_MS = 30000; // 30 seconds threshold to be considered active

// Unique ID for this browser tab session
const tabSessionId = `tab_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

let presenceBroadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    presenceBroadcastChannel = new BroadcastChannel('nlbc_presence_channel_v1');
  }
} catch {
  // Graceful fallback for older environments
}

function getStoredSessions(): PresenceSession[] {
  try {
    const raw = localStorage.getItem(PRESENCE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const now = Date.now();
      // Only keep non-expired sessions
      return parsed.filter((s) => s && typeof s.lastSeen === 'number' && now - s.lastSeen < PRESENCE_TIMEOUT_MS);
    }
    return [];
  } catch {
    return [];
  }
}

function saveStoredSessions(sessions: PresenceSession[]): void {
  try {
    localStorage.setItem(PRESENCE_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // ignore storage quota error
  }
}

/**
 * Send heartbeat for current user
 */
export function sendPresenceHeartbeat(user: UserAccount | null): void {
  if (!user) {
    removePresenceSession();
    return;
  }

  const now = Date.now();
  const currentSessions = getStoredSessions().filter((s) => s.sessionId !== tabSessionId);
  
  const mySession: PresenceSession = {
    sessionId: tabSessionId,
    userId: user.id,
    username: user.username,
    avatar: user.avatar,
    lastSeen: now,
  };

  currentSessions.push(mySession);
  saveStoredSessions(currentSessions);

  if (presenceBroadcastChannel) {
    try {
      presenceBroadcastChannel.postMessage({ type: 'heartbeat', session: mySession });
    } catch {
      // ignore
    }
  }
}

/**
 * Remove session on signout or window close
 */
export function removePresenceSession(): void {
  const currentSessions = getStoredSessions().filter((s) => s.sessionId !== tabSessionId);
  saveStoredSessions(currentSessions);

  if (presenceBroadcastChannel) {
    try {
      presenceBroadcastChannel.postMessage({ type: 'leave', sessionId: tabSessionId });
    } catch {
      // ignore
    }
  }
}

/**
 * Get distinct active online users currently using the webapp
 */
export function getActiveOnlineUsers(currentUser: UserAccount | null, allUsers: UserAccount[]): UserAccount[] {
  if (!currentUser) return [];

  const storedSessions = getStoredSessions();
  const activeUserMap = new Map<string, { username: string; avatar?: string }>();

  // Always register current user in the active map
  activeUserMap.set(currentUser.id, {
    username: currentUser.username,
    avatar: currentUser.avatar,
  });

  // Add all other active sessions from storage
  for (const s of storedSessions) {
    if (s.userId && s.userId !== currentUser.id) {
      // If user exists in allUsers, prefer latest data
      const matched = allUsers.find((u) => u.id === s.userId);
      activeUserMap.set(s.userId, {
        username: matched?.username || s.username,
        avatar: matched?.avatar || s.avatar,
      });
    }
  }

  // Convert to ordered UserAccount array with current user first
  const result: UserAccount[] = [currentUser];

  activeUserMap.forEach((info, uId) => {
    if (uId !== currentUser.id) {
      const existing = allUsers.find((u) => u.id === uId);
      result.push(
        existing || {
          id: uId,
          username: info.username,
          passwordHash: '',
          role: 'user',
          avatar: info.avatar,
          createdAt: new Date().toISOString(),
        }
      );
    }
  });

  return result;
}

/**
 * Subscribe to presence changes
 */
export function subscribeToPresence(
  currentUser: UserAccount | null,
  allUsers: UserAccount[],
  onUpdate: (activeUsers: UserAccount[]) => void
): () => void {
  // Send immediate initial heartbeat
  sendPresenceHeartbeat(currentUser);
  onUpdate(getActiveOnlineUsers(currentUser, allUsers));

  // Periodic heartbeat interval
  const intervalId = setInterval(() => {
    sendPresenceHeartbeat(currentUser);
    onUpdate(getActiveOnlineUsers(currentUser, allUsers));
  }, 15000);

  // Storage event listener for cross-tab updates
  const handleStorage = (e: StorageEvent) => {
    if (e.key === PRESENCE_STORAGE_KEY) {
      onUpdate(getActiveOnlineUsers(currentUser, allUsers));
    }
  };
  window.addEventListener('storage', handleStorage);

  // BroadcastChannel message listener
  const handleBroadcast = () => {
    onUpdate(getActiveOnlineUsers(currentUser, allUsers));
  };
  if (presenceBroadcastChannel) {
    presenceBroadcastChannel.addEventListener('message', handleBroadcast);
  }

  // Unload listener
  const handleUnload = () => {
    removePresenceSession();
  };
  window.addEventListener('beforeunload', handleUnload);
  window.addEventListener('pagehide', handleUnload);

  return () => {
    clearInterval(intervalId);
    window.removeEventListener('storage', handleStorage);
    if (presenceBroadcastChannel) {
      presenceBroadcastChannel.removeEventListener('message', handleBroadcast);
    }
    window.removeEventListener('beforeunload', handleUnload);
    window.removeEventListener('pagehide', handleUnload);
    removePresenceSession();
  };
}
