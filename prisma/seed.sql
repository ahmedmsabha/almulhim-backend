INSERT INTO users (
  id,
  clerk_id,
  email,
  full_name,
  phone_number,
  telegram_username,
  region,
  role,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  'user_3FraZVtFEfS2BPweebrTAWDRuxK',
  'almulhim.system2026@gmail.com',
  'Mulhim Admin',
  '0000000000',
  'mulhim_admin',
  'gaza',
  'admin',
  NOW(),
  NOW()
)
ON CONFLICT (clerk_id) DO UPDATE
SET
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  updated_at = NOW();
