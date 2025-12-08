-- Profiles
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  sex text check (sex in ('male', 'female', 'other')) default 'other',
  dob date,
  height_cm numeric,
  weight_kg numeric,
  units text check (units in ('metric', 'imperial')) default 'imperial',
  created_at timestamptz default now()
);

-- Hydration days
create table if not exists hydration_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  target_ml integer not null,
  actual_ml integer not null default 0,
  hydration_score integer not null default 0,
  base_need_ml integer not null,
  workout_adjustment_ml integer not null default 0,
  heat_adjustment_ml integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, date)
);

-- Intake events
create table if not exists intake_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  hydration_day_id uuid references hydration_days(id) on delete cascade,
  timestamp timestamptz not null,
  volume_ml integer not null,
  type text check (type in ('water', 'electrolyte', 'other')) default 'water',
  created_at timestamptz default now()
);

-- Workouts
create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz,
  duration_min integer,
  type text,
  intensity integer check (intensity between 1 and 10),
  avg_hr integer,
  calories integer,
  created_at timestamptz default now()
);

-- Insights
create table if not exists insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  hydration_day_id uuid references hydration_days(id),
  title text,
  body text,
  severity text check (severity in ('info', 'warning', 'critical')) default 'info',
  created_at timestamptz default now()
);

-- Supplements (simple log of types taken)
create table if not exists supplement_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  hydration_day_id uuid references hydration_days(id) on delete cascade,
  timestamp timestamptz not null,
  type text check (type in ('creatine','protein','multivitamin','fish_oil','electrolyte_tablet','basketball','other')) not null,
  created_at timestamptz default now()
);


