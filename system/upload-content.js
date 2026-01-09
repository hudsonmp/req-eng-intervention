#!/usr/bin/env node
/**
 * Upload prompts and bugs to Supabase storage buckets
 * 
 * Usage: node upload-content.js
 * 
 * Requires SUPABASE_URL and SUPABASE_SERVICE_KEY env vars
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Files to upload
const UPLOADS = [
  // Prompts bucket
  {
    bucket: 'intervention_prompts',
    files: [
      { localPath: 'prompts/simulated_student.md', storageName: 'simulated_student' },
      { localPath: 'prompts/scaffolded_tests.md', storageName: 'scaffolded_tests' }
    ]
  },
  // Bugs bucket
  {
    bucket: 'intervention_bugs',
    files: [
      { localPath: 'bugs/bugs.json', storageName: 'bugs' }
    ]
  }
];

async function ensureBucketExists(bucketName) {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some(b => b.name === bucketName);
  
  if (!exists) {
    console.log(`Creating bucket: ${bucketName}`);
    const { error } = await supabase.storage.createBucket(bucketName, { public: false });
    if (error) {
      console.error(`Failed to create bucket ${bucketName}:`, error.message);
      return false;
    }
  }
  return true;
}

async function uploadFile(bucket, localPath, storageName) {
  const fullPath = path.join(__dirname, localPath);
  
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    return false;
  }
  
  const content = fs.readFileSync(fullPath);
  const contentType = localPath.endsWith('.json') ? 'application/json' : 'text/markdown';
  
  // Try to delete existing file first (upsert)
  await supabase.storage.from(bucket).remove([storageName]);
  
  const { error } = await supabase.storage.from(bucket).upload(storageName, content, {
    contentType,
    upsert: true
  });
  
  if (error) {
    console.error(`Failed to upload ${storageName} to ${bucket}:`, error.message);
    return false;
  }
  
  console.log(`✓ Uploaded ${localPath} → ${bucket}/${storageName}`);
  return true;
}

async function main() {
  console.log('Uploading intervention content to Supabase...\n');
  
  let success = true;
  
  for (const upload of UPLOADS) {
    // Ensure bucket exists
    const bucketReady = await ensureBucketExists(upload.bucket);
    if (!bucketReady) {
      success = false;
      continue;
    }
    
    // Upload files
    for (const file of upload.files) {
      const result = await uploadFile(upload.bucket, file.localPath, file.storageName);
      if (!result) success = false;
    }
  }
  
  console.log('\n' + (success ? '✓ All uploads complete!' : '✗ Some uploads failed'));
  process.exit(success ? 0 : 1);
}

main();
