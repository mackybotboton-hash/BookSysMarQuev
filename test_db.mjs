import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const envFile = fs.readFileSync('.env', 'utf-8');
const env = Object.fromEntries(envFile.split('\n').filter(Boolean).map(line => line.split('=')));
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
async function main() {
  const { data, error } = await supabase.from('bookings').select('*');
  if (error) console.error(error);
  console.log(JSON.stringify(data, null, 2));
}
main();
