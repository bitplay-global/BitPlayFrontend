import { get_data_uri, getMobileSecurityHeaders } from '../config/api';

export const GAME_AD_REWARD_GH = 5;

export async function grantGameAdReward(userId: string): Promise<number> {
  const offset = new Date().getTimezoneOffset();
  const timezone =
    typeof Intl !== 'undefined' && Intl.DateTimeFormat?.().resolvedOptions?.()?.timeZone
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : undefined;

  const body: Record<string, unknown> = { user_id: userId, hashpower: GAME_AD_REWARD_GH, offset };
  if (timezone) body.timezone = timezone;

  try {
    const res = await fetch(get_data_uri('USERMININGDETAILS'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getMobileSecurityHeaders(),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success && data.mining_details) {
      return parseFloat(String(data.mining_details.effective_hashpower ?? data.mining_details.hashpower ?? '0')) || 0;
    }
  } catch {
    // non-blocking
  }
  return 0;
}
