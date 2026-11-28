import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.2';

const SUPABASE_URL = 'https://uzgrbgnxrseozpyxvgty.supabase.co'
const SUPABASE_KEY = 'sb_publishable_TWxy0TOlpMQLohU4Z9zSKQ_SzqHZfEN'

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_KEY
)