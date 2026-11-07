-- City Care Clinic — AI Front Desk
-- Table that stores appointments taken by the AI receptionist.

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  booking_id text not null unique,
  full_name text not null,
  phone text not null,
  department text not null,
  preferred_datetime text not null,
  created_at timestamptz not null default now()
);

create index if not exists appointments_created_at_idx
  on public.appointments (created_at desc);

-- Bookings are written by the server with the service role key, so no
-- anonymous access is granted.
alter table public.appointments enable row level security;
