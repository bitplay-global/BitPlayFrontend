import { get_data_uri } from '../config/api';

export interface GameSessionPayload {
  userId: string;
  gameName: string;
  score: number;
  result: 'win' | 'lose' | 'complete';
  durationSeconds: number;
  roundNumber?: number;
  metadata?: Record<string, unknown>;
}

export async function submitGameSession(payload: GameSessionPayload): Promise<void> {
  try {
    const url = get_data_uri('CREATE_FCM').replace('/firebase_tokens/create', '/game-sessions');
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mobile-client': 'true',
        'x-app-id': 'bitplay-mobile',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // analytics failure must never crash the app
  }
}
