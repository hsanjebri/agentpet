# Friends server (Supabase)

AgentPet's **Friends** feature uses a free Supabase project. No server of our own: the database
rules (Row Level Security) and a few SQL functions do all the work. The app only ever holds the
public **anon** key.

What's stored per user: an anonymous account (no email, no password), the pet's name, skin,
level and friend code, and who is friends with whom. Nothing else.

## One-time setup (about 10 minutes)

1. **Create the project**
   - Go to [supabase.com](https://supabase.com) › sign in › **New project**.
   - Name it `agentpet`, pick a strong database password (you won't need it in the app), pick
     the region closest to most users, Free plan. Wait until it's ready.

2. **Allow anonymous sign-ins**
   - **Authentication** › **Sign In / Providers** (or **Providers**, depending on the dashboard
     version) › turn on **Allow anonymous sign-ins** › Save.
   - Recommended: **Authentication** › **Attack Protection** › turn on CAPTCHA later if abuse
     ever shows up (anonymous sign-ins can be scripted).

3. **Create the tables, rules and functions**
   - **SQL Editor** › **New query** › paste the whole of
     [`migrations/001_friends.sql`](migrations/001_friends.sql) › **Run**.
   - It should finish with "Success. No rows returned". It's safe to run again.

4. **Make Realtime channels private only**
   - **Realtime** › **Settings** › turn **off** "Allow public access" (so only signed-in users
     who pass the rules in step 3 can join a pet's channel) › Save.

5. **Put the project in the app**
   - **Project Settings** › **API** (or **Data API** / **API Keys**): copy the **Project URL** and
     the **anon / publishable** key.
   - Paste them into [`config/supabase.json`](../config/supabase.json):

     ```json
     {
       "url": "https://YOUR-PROJECT.supabase.co",
       "anonKey": "eyJhbGciOi…"
     }
     ```

   - **Never** paste the `service_role` / secret key anywhere in the app or the repo.

6. **Build and try it**
   - `npm run dev` › Settings › Friends › switch it on: you get a code like `NOODLE-48K2`.
   - On a second install (another PC, a VM, a friend): switch Friends on, add the first code,
     accept on the first, and the green dot shows when both apps are running.

## Checking it from the dashboard

- **Table Editor** › `pets`: one row per user who turned Friends on.
- **Table Editor** › `friendships`: `pending` / `accepted` / `blocked` rows.
- **Authentication** › **Users**: anonymous users (no email).

## Limits and safety

- Friend requests: max **20 a day** per user (enforced in the database, however they're sent).
- People who blocked you look like "no pet with that code": nothing is revealed.
- A user can only change their own pet row, and see their friends' name, skin and level.
- Free plan: 50,000 monthly active users and 200 concurrent Realtime connections; plenty to start.
