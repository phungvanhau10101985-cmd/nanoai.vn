# Virtual Try-On Web App

This is a Next.js 14 project for a Virtual Try-On web application using Supabase for the backend and a placeholder for AI integration.

## 🚀 Getting Started

Follow these steps to get the project up and running on your local machine.

### 1. Prerequisites

- Node.js (v18 or later)
- npm (or pnpm/yarn)
- A Supabase account ([supabase.com](https://supabase.com))
- An AI service account (e.g., Google Cloud for Vertex AI or Replicate)

### 2. Supabase Setup

#### a. Create a New Project

1.  Go to your [Supabase Dashboard](https://app.supabase.com/) and click "New project".
2.  Choose an organization and give your project a name.
3.  Generate a secure database password and save it somewhere safe.
4.  Wait for your new project to be provisioned.

#### b. Get API Keys

1.  In your Supabase project dashboard, go to **Project Settings** (the gear icon).
2.  Click on **API**.
3.  Under **Project API keys**, you will find:
    *   `NEXT_PUBLIC_SUPABASE_URL` (the Project URL)
    *   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the `public` anon key)
4.  Copy these values. You will need them for the `.env.local` file.

#### c. Run the Database Migration

1.  Go to the **SQL Editor** in your Supabase dashboard.
2.  Click on **+ New query**.
3.  Open the file `supabase/migrations/20240101000000_init.sql` in this project.
4.  Copy the entire content of the file.
5.  Paste the SQL content into the Supabase SQL Editor.
6.  Click **RUN**. This will create all the necessary tables (`profiles`, `credits`, `transactions`, `try_on_history`) and set up the required policies and triggers.

#### d. Set up Authentication Providers

1.  Go to **Authentication** -> **Providers**.
2.  Enable **Google**. You will need to provide a Client ID and Client Secret from the Google Cloud Console.
3.  **Important:** In the Google Cloud Console, make sure to add `YOUR_SUPABASE_URL/auth/v1/callback` to the "Authorized redirect URIs".
4.  Make sure **Email** is also enabled.

#### e. Create Storage Bucket

1.  Go to **Storage** in your Supabase dashboard.
2.  Click **Create a new bucket**.
3.  Name the bucket `try-on-images` and make it a **public bucket**.
4.  After creating the bucket, go to its policies and create a new policy that allows `INSERT` access for authenticated users. This is crucial for the image upload to work.

### 3. Project Configuration

#### a. Install Dependencies

Open your terminal in the project root and run:

```bash
npm install
```

#### b. Set Up Environment Variables

1.  Copy `.env.example` to `.env.local` (e.g. `cp .env.example .env.local`).
2.  For a **full checklist** (Supabase, AI, cron secrets, Vision Warehouse, VPS vs local), see **`docs/ENV_LOCAL_REFERENCE.md`**.
3.  Open `.env.local` and fill in the values you copied from your Supabase dashboard (and other services):

    ```env
    # Supabase Configuration
    NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL_HERE
    NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY_HERE

    # Base URL
    NEXT_PUBLIC_BASE_URL=http://localhost:3000

    # AI Service API Key (fill in the one you plan to use)
    GOOGLE_AI_API_KEY=
    REPLICATE_API_TOKEN=
    ```

### 4. Run the Development Server

Now you are ready to start the application:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the result.

### 5. Reset dữ liệu AI test

Để xóa toàn bộ dữ liệu do AI tạo ra (giáo trình, bài thi, phiếu bài tập, v.v.) và test lại từ đầu, **giữ nguyên** tài khoản, credit và câu hỏi đã up:

1. Mở `supabase/scripts/reset-ai-test-data.sql`
2. Chạy trong Supabase Dashboard → SQL Editor

Chi tiết: `docs/reset-ai-test-data.md`

### 6. Integrating the Real AI Model

The current AI logic is a placeholder. To make it work, you need to:

1.  Go to the file: `src/app/dashboard/try-on/actions.ts`.
2.  Find the comment `// 4. Placeholder for AI API call`.
3.  Remove the placeholder code (the `setTimeout` and mock URL).
4.  Replace it with the actual API call to your chosen AI service (Google Vertex AI or Replicate) using the API key from your `.env.local` file. You will need to install their respective SDKs (e.g., `@google-cloud/aiplatform` or `replicate`).
