import { createContext, useContext } from 'react';

export const PlayerContext = createContext({ playerRef: null, playerY: 0 });

export function usePlayerContext() {
  return useContext(PlayerContext);
}

export function isPlayerBody(other) {
  const body = other?.rigidBody?.();
  if (!body) return false;
  return body.userData?.type === 'player';
}

export function getPlayerY(other) {
  try {
    return other.rigidBody().translation().y;
  } catch {
    return 0;
  }
}
