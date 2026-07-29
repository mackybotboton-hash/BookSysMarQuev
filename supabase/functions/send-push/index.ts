import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webPush from 'npm:web-push'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const { title, message, targetRole = 'admin', targetUserId, url = '/' } = body

    // 1. Configure web-push with VAPID keys
    webPush.setVapidDetails(
      'mailto:admin@marquevedohairstudio.com',
      Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
      Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
    )

    // 2. Fetch subscriptions from the database based on targetRole or targetUserId
    let query = supabase.from('push_subscriptions').select('*')
    
    if (targetUserId) {
      query = query.eq('user_id', targetUserId)
    } else if (targetRole) {
      query = query.eq('role', targetRole)
    }

    const { data: subscriptions, error } = await query

    if (error) throw error

    // 3. Send notifications to all matched subscriptions
    const pushPromises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      }

      const payload = JSON.stringify({
        title,
        body: message,
        url,
        icon: '/logo-192x192.png',
        badge: '/logo-192x192.png',
      })

      try {
        await webPush.sendNotification(pushSubscription, payload)
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log('Subscription has expired or is no longer valid: ', err)
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        } else {
          console.error('Error sending push: ', err)
        }
      }
    })

    await Promise.all(pushPromises)

    return new Response(
      JSON.stringify({ success: true, count: pushPromises.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
