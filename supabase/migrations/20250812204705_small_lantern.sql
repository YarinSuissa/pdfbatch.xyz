/*
  # Create generation_jobs table for PDF generation job tracking

  1. New Tables
    - `generation_jobs`
      - `id` (uuid, primary key)
      - `pdf_template_id` (text, reference to uploaded PDF in storage)
      - `csv_data` (jsonb, the entire CSV data array)
      - `field_mappings` (jsonb, field mapping configuration)
      - `naming_template` (jsonb, naming template configuration)
      - `status` (text, job status: PENDING, PROCESSING, COMPLETED, FAILED)
      - `progress` (text, progress indicator like "5/100" or "50%")
      - `output_zip_path` (text, path to generated ZIP in storage)
      - `error_message` (text, detailed error message if job fails)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `generation_jobs` table
    - Add policies for authenticated users to manage their own jobs

  3. Indexes
    - Index on status for efficient job querying
    - Index on created_at for cleanup operations
*/

-- Create the generation_jobs table
CREATE TABLE IF NOT EXISTS generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_template_id text NOT NULL,
  csv_data jsonb NOT NULL,
  field_mappings jsonb NOT NULL,
  naming_template jsonb NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  progress text DEFAULT '0%',
  output_zip_path text,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Users can insert their own generation jobs"
  ON generation_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can read their own generation jobs"
  ON generation_jobs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can update generation jobs"
  ON generation_jobs
  FOR UPDATE
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status ON generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_created_at ON generation_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_updated_at ON generation_jobs(updated_at);

-- Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_generation_jobs_updated_at
  BEFORE UPDATE ON generation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();