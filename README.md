# City Care Clinic — AI Front Desk

An AI receptionist for City Care Clinic. It answers questions about the clinic
and books appointments through a WhatsApp-style chat interface.

- **Next.js** (App Router) + **Tailwind CSS v4**
- **Google Gemini** (`gemini-2.5-flash`) called from a server-side route at
  `app/api/chat` — the API key never reaches the browser
- **Supabase** stores confirmed bookings in an `appointments` table

## What the receptionist does

- Answers questions about opening hours, departments, the address, and
  walk-ins vs. online bookings.
- Books appointments: it collects full name, phone number, department and
  preferred date & time, saves the booking to Supabase, and replies with a
  confirmation and a short booking ID (for example `CCC-7K2M9P`).
- Refuses to give medical diagnoses or advice. If a visitor describes symptoms
  it politely declines and offers to book an appointment with a doctor instead.

## Clinic details used as its knowledge

| | |
|---|---|
| Name | City Care Clinic |
| Hours | Mon-Sat, 9:00 am - 7:00 pm, closed Sunday |
| Departments | General Physician, Pediatrics, Dermatology, Dentistry, Orthopedics |
| Address | 12 MG Road, Bhubaneswar |
| Bookings | Walk-ins and online bookings |

## Running it locally

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

### Environment variables

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key. Server-side only. |
| `GEMINI_MODEL` | Optional. Defaults to `gemini-2.5-flash`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key. Server-side only - bookings are written with it. |

### Database

`supabase/schema.sql` creates the `appointments` table:

| Column | Type |
|---|---|
| `id` | `uuid` primary key |
| `booking_id` | `text` unique - the short ID given to the visitor |
| `full_name` | `text` |
| `phone` | `text` |
| `department` | `text` |
| `preferred_datetime` | `text` |
| `created_at` | `timestamptz` |

Row level security is enabled and no anonymous policies are granted, so the
table is only writable by the server using the service role key.

## Project layout

```
app/
  api/chat/route.ts     Gemini call, booking function-call handling, Supabase insert
  components/Chat.tsx   The chat interface
  page.tsx              Page shell
  globals.css           Chat styling
lib/
  clinic.ts             Clinic knowledge + the receptionist's instructions
  supabase.ts           Server-side Supabase client
supabase/schema.sql     appointments table
```
