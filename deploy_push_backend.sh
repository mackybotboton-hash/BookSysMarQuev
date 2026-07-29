# 1. First, deploy the Edge Function to your Supabase project
# You will be prompted to login to your Supabase account if you haven't already.
npx supabase login

# 2. Link your local project to your live Supabase project
# Replace [YOUR_PROJECT_REF] with your actual Supabase project reference ID
# (You can find it in your Supabase Dashboard URL: https://supabase.com/dashboard/project/[YOUR_PROJECT_REF])
npx supabase link --project-ref [YOUR_PROJECT_REF]

# 3. Set the VAPID secrets in your Supabase project
npx supabase secrets set VAPID_PUBLIC_KEY=BLt92sHxS8LM3tyCRgdTVy8U_RflljZ5fyjkNQyB0S3zd9-8JNOiW9F9-n6wkT6K41OBmx101geNaaoUEUrei2o VAPID_PRIVATE_KEY=ues7BQc4r2lx5zLVnSMHOw5W5oP90mbM3zXo9avsMNE

# 4. Deploy the Edge Function
npx supabase functions deploy send-push
