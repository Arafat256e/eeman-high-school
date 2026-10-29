/* Public browser configuration only. Replace these two values with your existing Supabase URL and publishable/anon key. Never put a service_role or secret key here. */
window.SUPABASE_URL = 'https://bevwmgdqavggrtsbsndk.supabase.co';
window.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_F1wPhELMEYd4tJS-aptSRw_43NfnDrj';
window.schoolSupabase = null;
window.supabaseReady = false;
(function(){
  const url = window.SUPABASE_URL;
  const key = window.SUPABASE_PUBLISHABLE_KEY;
  if (!window.supabase || !url || !key || url.includes('PASTE_') || key.includes('PASTE_')) return;
  try { window.schoolSupabase = window.supabase.createClient(url, key); window.supabaseReady = true; }
  catch (e) { console.error('Supabase client initialization failed:', e); }
})();
