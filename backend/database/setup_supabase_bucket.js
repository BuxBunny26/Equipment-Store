// Script to create Supabase storage bucket for certificates
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://widwzjnfxhsxzhqrzthy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpZHd6am5meGhzeHpocXJ6dGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2ODI5MzcsImV4cCI6MjA4NTI1ODkzN30.e3leUBqvZeo_gPMj75mlzgP7uQg-iWTZvcLwQx1_Hpo';
const BUCKET_NAME = 'certificates';

async function setupBucket() {
    console.log('Connecting to Supabase...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // List existing buckets
    console.log('Listing buckets...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
        console.error('Error listing buckets:', listError.message);
        console.log('\nNote: Creating buckets requires the service_role key, not the anon key.');
        console.log('Please create the bucket manually in Supabase Dashboard:');
        console.log('1. Go to https://supabase.com/dashboard/project/widwzjnfxhsxzhqrzthy/storage');
        console.log('2. Click "New bucket"');
        console.log('3. Name it "certificates"');
        console.log('4. Check "Public bucket" to allow public access');
        console.log('5. Click "Create bucket"');
        return;
    }

    console.log('Current buckets:', buckets?.map(b => b.name) || []);

    // Check if certificates bucket exists
    const certificatesBucket = buckets?.find(b => b.name === BUCKET_NAME);
    
    if (certificatesBucket) {
        console.log(`\n✅ Bucket "${BUCKET_NAME}" already exists!`);
        return;
    }

    console.log(`\nBucket "${BUCKET_NAME}" not found. Attempting to create...`);
    
    // Try to create bucket (may fail with anon key)
    const { data, error } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 10485760 // 10MB
    });

    if (error) {
        console.error('Error creating bucket:', error.message);
        console.log('\nPlease create the bucket manually in Supabase Dashboard:');
        console.log('1. Go to https://supabase.com/dashboard/project/widwzjnfxhsxzhqrzthy/storage');
        console.log('2. Click "New bucket"');
        console.log('3. Name it "certificates"');
        console.log('4. Check "Public bucket" to allow public access');
        console.log('5. Click "Create bucket"');
    } else {
        console.log(`✅ Successfully created bucket "${BUCKET_NAME}"!`);
    }
}

setupBucket().catch(console.error);
