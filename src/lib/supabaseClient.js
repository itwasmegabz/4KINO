import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nxxbldvpxdkvpwdhybir.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54eGJsZHZweGRrdnB3ZGh5YmlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTkzOTgyMzUsImV4cCI6MjAzNDk3NDIzNX0.XfqZhp-eZFc5JnBF3MBEURf2i2LFLclUJLuiaPqqW2A';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);