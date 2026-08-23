-- 管理者はセッションリセットのために位置データを削除できる。
-- (参加者の登録情報 participants は削除対象に含めない)
create policy "location_points_delete_admin" on public.location_points
  for delete using (exists (select 1 from public.admins where user_id = auth.uid()));
