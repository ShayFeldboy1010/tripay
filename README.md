# Trip Expense App

*Automatically synced with your [v0.app](https://v0.app) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/shays-projects-2f625896/v0-trip-expense-app)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/projects/QAYrHD7pyaM)

## Overview

This repository will stay in sync with your deployed chats on [v0.app](https://v0.app).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.app](https://v0.app).

## Deployment

Your project is live at:

**[https://vercel.com/shays-projects-2f625896/v0-trip-expense-app](https://vercel.com/shays-projects-2f625896/v0-trip-expense-app)**

## Build your app

Continue building your app on:

**[https://v0.app/chat/projects/QAYrHD7pyaM](https://v0.app/chat/projects/QAYrHD7pyaM)**

## How It Works

1. Create and modify your project using [v0.app](https://v0.app)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository

## Troubleshooting Supabase Writes

1. **Environment variables** – ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are configured locally in `.env.local` and in Vercel project settings.
2. **Schema** – run the SQL scripts in `scripts/` to keep the database in sync. Missing columns such as `is_shared_payment` will cause inserts to fail.
3. **Row Level Security** – confirm that policies allow your user to insert and update rows for the trip. RLS errors surface from Supabase with a detailed `code` and `message`.
4. **Client errors** – the app now logs Supabase error `code`, `message`, and `details` to the console. Use these logs to diagnose issues quickly.

5. **AI expenses view** – after seeding the database run `scripts/05-create-ai-expenses-view.sql` so the `ai_expenses` view exists. The AI chat feature reads from this view and will fail if it is missing. Make sure the server has a Postgres connection string configured (set `DATABASE_URL` or `SUPABASE_DB_URL`) so the AI chat can query the view.


## Configuring Groq AI

- Set `GROQ_API_KEY` in both `.env.local` and the Vercel project to enable Groq-powered parsing.
- The backend automatically selects Groq when an API key is present and defaults to the `llama-3.1-8b-instant` model. Override with `LLM_MODEL` if you prefer a different Groq deployment.
- You no longer need to set `LLM_PROVIDER`; the server falls back to Moonshot or a mock implementation only if no Groq key is available.
- Make sure the Supabase environment variables above are configured so the answers the API returns are grounded in your trip data.

## Locale & Direction

- Text inputs and dynamic text containers use `dir="auto"` so Hebrew/English content flows in the correct direction.
- The `<html>` element reads a `locale` cookie (`he` or `en`) and sets the page `dir` accordingly. Default is `en`.
- To test manually, set `document.cookie = "locale=he"` (or `en`) and reload.

## Trip Page Shortcuts

- Buttons above the expense list open participant and location management modals.
- Components added: `ManageParticipantsModal` and `ManageLocationsModal`.
