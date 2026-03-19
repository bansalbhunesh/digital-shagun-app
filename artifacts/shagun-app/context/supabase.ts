import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zzwsiyfipngrgesusddd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6d3NpeWZpcG5ncmdlc3VzZGRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4OTgyNjksImV4cCI6MjA4OTQ3NDI2OX0.NNLykGbMrKkStL0cCXfonEoGC9SEv2p6gLbORGzZBUs';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
