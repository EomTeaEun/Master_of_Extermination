-- =============================================
-- 박멸의 달인 - Supabase Schema
-- =============================================

-- 프로필 테이블 (auth.users 연동)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 스코어 테이블
CREATE TABLE IF NOT EXISTS scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  username TEXT NOT NULL,
  kill_count INTEGER NOT NULL DEFAULT 0,
  money_earned INTEGER NOT NULL DEFAULT 0,
  wave_reached INTEGER NOT NULL DEFAULT 1,
  survival_time INTEGER NOT NULL DEFAULT 0, -- seconds
  game_mode TEXT NOT NULL DEFAULT '3min', -- '3min' | 'infinite' | 'daysurvival'
  ended_with TEXT NOT NULL DEFAULT 'timeout', -- 'timeout' | 'death' | 'win'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 업적 테이블
CREATE TABLE IF NOT EXISTS achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  achievement_key TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_key)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_scores_kill_count ON scores(kill_count DESC);
CREATE INDEX IF NOT EXISTS idx_scores_game_mode ON scores(game_mode);
CREATE INDEX IF NOT EXISTS idx_scores_created_at ON scores(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scores_user_id ON scores(user_id);

-- RLS 정책
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

-- profiles: 본인만 수정, 전체 읽기
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- scores: 본인만 삽입, 전체 읽기
CREATE POLICY "scores_select_all" ON scores FOR SELECT USING (true);
CREATE POLICY "scores_insert_own" ON scores FOR INSERT WITH CHECK (auth.uid() = user_id);

-- achievements: 본인 것만 읽기/쓰기
CREATE POLICY "achievements_own" ON achievements FOR ALL USING (auth.uid() = user_id);

-- 새 유저 가입 시 프로필 자동 생성 트리거
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 오늘의 방역왕 뷰 (최고 킬수)
CREATE OR REPLACE VIEW daily_ranking AS
SELECT
  s.username,
  s.kill_count,
  s.wave_reached,
  s.game_mode,
  s.created_at
FROM scores s
WHERE s.created_at >= CURRENT_DATE
ORDER BY s.kill_count DESC
LIMIT 100;

-- 전체 랭킹 뷰
CREATE OR REPLACE VIEW all_time_ranking AS
SELECT
  p.username,
  MAX(s.kill_count) as best_kill_count,
  MAX(s.wave_reached) as best_wave,
  COUNT(s.id) as total_games
FROM scores s
JOIN profiles p ON p.id = s.user_id
GROUP BY p.username
ORDER BY best_kill_count DESC
LIMIT 100;
