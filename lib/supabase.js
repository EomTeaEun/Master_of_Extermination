import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Check if Supabase is actually configured
export const isSupabaseConfigured = () =>
  !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// ─── Auth helpers ───────────────────────────────────────────────
export async function signUp(email, password, username) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  return { data, error };
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  return await supabase.auth.signOut();
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// ─── Score helpers ───────────────────────────────────────────────
export async function saveScore({ userId, username, killCount, moneyEarned, waveReached, survivalTime, gameMode, endedWith, score }) {
  const { data, error } = await supabase
    .from('scores')
    .insert({
      user_id: userId,
      username,
      kill_count: killCount,
      money_earned: moneyEarned,
      wave_reached: waveReached,
      survival_time: survivalTime,
      game_mode: gameMode,
      ended_with: endedWith,
      score: score ?? 0,
    });
  return { data, error };
}

// ── 모드별 오늘의 랭킹 ──────────────────────────────────────────
export async function getDailyRankingByMode(mode) {
  if (mode === 'daysurvival') {
    // 하루살이: 500마리 잡은 기록만, 시간 오름차순
    const { data, error } = await supabase
      .from('scores')
      .select('username, kill_count, survival_time, game_mode, created_at, score')
      .eq('game_mode', 'daysurvival')
      .gte('kill_count', 500)
      .gte('created_at', new Date(new Date().setHours(0,0,0,0)).toISOString())
      .order('survival_time', { ascending: true })
      .limit(20);
    return { data, error };
  }
  // 3min / infinite: kill*150 + money/10 점수 내림차순
  const { data, error } = await supabase
    .from('scores')
    .select('username, kill_count, money_earned, wave_reached, game_mode, created_at, score')
    .eq('game_mode', mode)
    .gte('created_at', new Date(new Date().setHours(0,0,0,0)).toISOString())
    .order('score', { ascending: false })
    .limit(20);
  return { data, error };
}

// ── 모드별 역대 랭킹 ────────────────────────────────────────────
export async function getAllTimeRankingByMode(mode) {
  if (mode === 'daysurvival') {
    const { data, error } = await supabase
      .from('scores')
      .select('username, kill_count, survival_time, game_mode, score')
      .eq('game_mode', 'daysurvival')
      .gte('kill_count', 500)
      .order('survival_time', { ascending: true })
      .limit(20);
    return { data, error };
  }
  const { data, error } = await supabase
    .from('scores')
    .select('username, kill_count, money_earned, wave_reached, game_mode, score')
    .eq('game_mode', mode)
    .order('score', { ascending: false })
    .limit(20);
  return { data, error };
}

// 하위 호환 유지
export async function getDailyRanking() { return getDailyRankingByMode('3min'); }
export async function getAllTimeRanking() { return getAllTimeRankingByMode('3min'); }

export async function getUserBestScore(userId) {
  const { data, error } = await supabase
    .from('scores')
    .select('*')
    .eq('user_id', userId)
    .order('kill_count', { ascending: false })
    .limit(1)
    .single();
  return { data, error };
}

// ─── Achievement helpers ─────────────────────────────────────────
export async function unlockAchievement(userId, achievementKey) {
  const { data, error } = await supabase
    .from('achievements')
    .upsert({ user_id: userId, achievement_key: achievementKey }, { onConflict: 'user_id,achievement_key' });
  return { data, error };
}

export async function getUserAchievements(userId) {
  const { data, error } = await supabase
    .from('achievements')
    .select('achievement_key, unlocked_at')
    .eq('user_id', userId);
  return { data, error };
}
