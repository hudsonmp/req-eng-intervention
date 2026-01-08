import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://nhttyppkcajodocrnqhi.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5odHR5cHBrY2Fqb2RvY3JucWhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzOTA5ODIsImV4cCI6MjA3OTk2Njk4Mn0.XbeUEF567uamBuqG8BlE_90p5zLQWlDd_L4WsmPfA7M';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
