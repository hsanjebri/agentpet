# config

`supabase.json`: the Supabase project behind **Friends** (Settings › Friends).

- `url`: Project URL, e.g. `https://abcdefghijklm.supabase.co`
- `anonKey`: the **anon / publishable** key (safe to ship: Row Level Security protects the data)

Never put the `service_role` / secret key here or anywhere in the app.
Left empty, the app builds and runs normally and Friends shows "not set up in this build".
Setup steps: `supabase/README.md`.
