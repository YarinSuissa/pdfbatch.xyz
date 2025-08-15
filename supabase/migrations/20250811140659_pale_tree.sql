/*
  # PDF-CSV Application Database Schema

  1. New Tables
    - `files`
      - `id` (uuid, primary key)
      - `filename` (text)
      - `file_type` (enum: pdf, csv)
      - `storage_path` (text)
      - `metadata` (jsonb)
      - `created_at` (timestamp)
    - `downloads`
      - `id` (uuid, primary key)
      - `hash` (text, unique)
      - `file_path` (text)
      - `expires_at` (timestamp)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for public access (since this is a public tool)
    - Add storage policies for file uploads and downloads

  3. Storage
    - Create buckets for uploads and outputs
    - Set appropriate policies for file access
*/

-- Create enum for file types
CREATE TYPE file_type_enum AS ENUM ('pdf', 'csv', 'zip');

-- Create files table
CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  file_type file_type_enum NOT NULL,
  storage_path text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create downloads table
CREATE TABLE IF NOT EXISTS downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hash text UNIQUE NOT NULL,
  file_path text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE downloads ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (this is a public tool)
CREATE POLICY "Allow public file operations"
  ON files
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public download operations"
  ON downloads
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('uploads', 'uploads', false),
  ('outputs', 'outputs', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Allow public uploads"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'uploads');

CREATE POLICY "Allow public upload access"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'uploads');

CREATE POLICY "Allow public output uploads"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'outputs');

CREATE POLICY "Allow public output access"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'outputs');

CREATE POLICY "Allow public file deletion"
  ON storage.objects
  FOR DELETE
  TO anon, authenticated
  USING (bucket_id IN ('uploads', 'outputs'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_downloads_hash ON downloads(hash);
CREATE INDEX IF NOT EXISTS idx_downloads_expires_at ON downloads(expires_at);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);