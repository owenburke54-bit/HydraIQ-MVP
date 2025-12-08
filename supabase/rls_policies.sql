-- Row Level Security policies for HydraIQ
-- Run AFTER supabase/schema.sql

-- profiles
alter table profiles enable row level security;
create policy "profiles_owner_select" on profiles for select using (auth.uid() = id);
create policy "profiles_owner_upsert" on profiles for insert with check (auth.uid() = id);
create policy "profiles_owner_update" on profiles for update using (auth.uid() = id);

-- hydration_days
alter table hydration_days enable row level security;
create policy "hydration_days_owner_rw" on hydration_days for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- intake_events
alter table intake_events enable row level security;
create policy "intake_events_owner_rw" on intake_events for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- workouts
alter table workouts enable row level security;
create policy "workouts_owner_rw" on workouts for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- insights
alter table insights enable row level security;
create policy "insights_owner_rw" on insights for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- supplement_events
alter table supplement_events enable row level security;
create policy "supplements_owner_rw" on supplement_events for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);


