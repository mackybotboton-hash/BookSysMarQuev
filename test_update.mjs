import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const envFile = fs.readFileSync('.env', 'utf-8');
const env = Object.fromEntries(envFile.split('\n').filter(Boolean).map(line => line.split('=')));
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
async function main() {
  const rowId = "761f5888-f6df-4e30-986f-ed398fe600e0"; // The 9:30 AM row
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'pending', start_time: '14:00:00', cancellation_reason: null })
    .eq('id', rowId)
    .select();
  if (error) console.error("UPDATE ERROR:", error);
  console.log("UPDATED DATA:", JSON.stringify(data, null, 2));
}
main();
