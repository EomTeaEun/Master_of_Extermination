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
export async function saveScore({ userId, username, killCount, moneyEarned, waveReached, survivalTime, gameMode, endedWith }) {
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
    });
  return { data, error };
}

export async function getDailyRanking() {
  const { data, error } = await supabase
    .from('daily_ranking')
    .select('*')
    .limit(20);
  return { data, error };
}

export async function getAllTimeRanking() {
  const { data, error } = await supabase
    .from('all_time_ranking')
    .select('*')
    .limit(20);
  return { data, error };
}

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
