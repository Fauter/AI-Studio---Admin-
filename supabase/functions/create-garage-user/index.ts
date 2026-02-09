
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// @ts-ignore
Deno.serve(async (req) => {
  // 1. CRITICAL: Handle CORS Preflight immediately
  // Browser sends OPTIONS before POST. It has no Auth headers usually.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Initialize Environment & Admin Client
    // We need SERVICE_ROLE_KEY to bypass RLS and create users in Auth system
    
    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    // @ts-ignore
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    // @ts-ignore
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Server misconfiguration: Missing SUPABASE_URL or SERVICE_ROLE_KEY')
    }

    // 3. Verify Caller (Security)
    // We use the Anon key + The User's Auth Header to create a restricted client
    // This allows us to check if the person calling this function is actually logged in.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing Authorization header')
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey!, {
      global: { headers: { Authorization: authHeader } }
    })

    // Check if the token is valid
    const { data: { user: caller }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Parse & Validate Input
    let body
    try {
      body = await req.json()
    } catch {
      throw new Error('Invalid JSON body')
    }

    const { garageId, firstName, lastName, email, password, role } = body

    if (!garageId || !email || !password || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: garageId, email, password, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Admin Operations (Transaction Simulation)
    // Create a powerful client to perform the actual writes
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Step A: Create Auth User
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm for immediate login
      user_metadata: { full_name: `${firstName} ${lastName}` }
    })

    if (createError) {
      // Return the specific Auth error (e.g. "Email already registered")
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const newUserId = userData.user?.id
    if (!newUserId) throw new Error('Failed to retrieve new user ID')

    // Step B: Create Profile (Public Table)
    // ROLLBACK STRATEGY: If this fails, we must delete the Auth User created in Step A
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: newUserId,
        email: email,
        full_name: `${firstName} ${lastName}`,
        role: role
      })

    if (profileError) {
      console.error('Profile creation failed:', profileError)
      // ROLLBACK Step A
      await supabaseAdmin.auth.admin.deleteUser(newUserId)
      
      return new Response(
        JSON.stringify({ error: `Profile creation failed: ${profileError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step C: Link to Garage
    // ROLLBACK STRATEGY: If this fails, delete Profile AND Auth User
    const { error: linkError } = await supabaseAdmin
      .from('garage_managers')
      .insert({
        garage_id: garageId,
        user_id: newUserId
      })

    if (linkError) {
      console.error('Garage linking failed:', linkError)
      // ROLLBACK Step B & A
      // Note: Deleting the User from Auth usually cascades to Profile if configured in DB, 
      // but we do it explicitly or delete the Auth user which is the root.
      // Deleting Auth user is the safest way to clean everything if ON DELETE CASCADE is set on public.profiles.id -> auth.users.id
      await supabaseAdmin.auth.admin.deleteUser(newUserId)

      return new Response(
        JSON.stringify({ error: `Garage linking failed: ${linkError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. Success
    return new Response(
      JSON.stringify({ success: true, userId: newUserId, message: 'User created and linked successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    // 7. Global Error Handler (CORS Safe)
    // Captures any unhandled exception (like missing env vars) and returns a JSON response
    // ensuring the browser receives the CORS headers.
    console.error('Unhandled Function Error:', err)
    
    return new Response(
      JSON.stringify({ error: err.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
