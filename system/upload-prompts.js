const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://nhttyppkcajodocrnqhi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5odHR5cHBrY2Fqb2RvY3JucWhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzOTA5ODIsImV4cCI6MjA3OTk2Njk4Mn0.XbeUEF567uamBuqG8BlE_90p5zLQWlDd_L4WsmPfA7M';

const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadPrompts() {
  const promptsDir = path.join(__dirname, 'prompts');
  const files = fs.readdirSync(promptsDir);

  for (const file of files) {
    const filePath = path.join(promptsDir, file);
    const content = fs.readFileSync(filePath);
    const fileName = file.replace('.md', '');

    const { data, error } = await supabase.storage
      .from('system_prompts')
      .upload(fileName, content, {
        contentType: 'text/markdown',
        upsert: true
      });

    if (error) {
      console.error(`Failed to upload ${file}:`, error.message);
    } else {
      console.log(`Uploaded ${file} as ${fileName}`);
    }
  }
}

uploadPrompts();
