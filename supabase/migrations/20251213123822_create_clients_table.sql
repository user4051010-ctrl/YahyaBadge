/*
  # Create clients table

  1. New Tables
    - `clients`
      - `id` (uuid, primary key)
      - `fullName` (text)
      - `passportNumber` (text)
      - `visaNumber` (text)
      - `birthDate` (text)
      - `email` (text)
      - `medinaHotel` (text)
      - `meccaHotel` (text)
      - `roomType` (text)
      - `clientPhoto` (text, base64 encoded image)
      - `createdAt` (timestamp)

  2. Security
    - Enable RLS on `clients` table
*/

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fullName text NOT NULL,
  passportNumber text,
  visaNumber text,
  birthDate text,
  email text,
  medinaHotel text,
  meccaHotel text,
  roomType text,
  clientPhoto text,
  createdAt timestamptz DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert clients"
  ON clients
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read clients"
  ON clients
  FOR SELECT
  TO anon, authenticated
  USING (true);
