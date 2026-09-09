begin;

-- Phase 7: allow WAREHOUSE users to open the existing read-only shipping queue.
-- Shipping mutation permissions remain restricted to the existing administrator roles.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'WAREHOUSE'
  and p.code = 'shipping.view'
on conflict (role_id, permission_id) do nothing;

commit;
