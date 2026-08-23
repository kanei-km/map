-- 参加者ごとの最新位置。security_invoker により、
-- 参照するユーザー自身の権限(RLS)でlocation_pointsが評価される。
create view public.latest_location_points
with (security_invoker = true) as
select distinct on (participant_id)
  id,
  participant_id,
  latitude,
  longitude,
  accuracy,
  altitude,
  recorded_at,
  received_at
from public.location_points
order by participant_id, recorded_at desc;
