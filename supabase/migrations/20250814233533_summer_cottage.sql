/*
  # Secure Storage Policies

  1. Database Security
    - Make files table accessible only to service role
    - Remove public access to downloads table
    - Add restrictive RLS policies

  2. Changes Made
    - Updated RLS policies to deny all public access
    - Only service role can manage file records
    - Downloads table is for server-side token management only
*/

-- Remove existing permissive policies
DROP POLICY IF EXISTS "Allow public file operations" ON public.files;
DROP POLICY IF EXISTS "Allow public download operations" ON public.downloads;

-- Create restrictive policies for files table
-- Only service role can access files (bypasses RLS)
CREATE POLICY "Deny all public access to files"
  ON public.files
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Create restrictive policies for downloads table  
-- Only service role can access downloads (bypasses RLS)
CREATE POLICY "Deny all public access to downloads"
  ON public.downloads
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Add generation_jobs restrictions
DROP POLICY IF EXISTS "Users can insert their own generation jobs" ON public.generation_jobs;
DROP POLICY IF EXISTS "Users can read their own generation jobs" ON public.generation_jobs;
DROP POLICY IF EXISTS "System can update generation jobs" ON public.generation_jobs;

CREATE POLICY "Deny all public access to generation_jobs"
  ON public.generation_jobs
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);