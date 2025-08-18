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
