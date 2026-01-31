/**
 * Document Ingestion Script
 *
 * Usage:
 *   npx tsx scripts/ingest-docs.ts
 */

// Load environment variables from .env.local
import { loadEnvConfig } from '@next/env';
const projectDir = process.cwd();
loadEnvConfig(projectDir);

async function main() {
  console.log('📚 Starting document ingestion...\n');

  // Setup admin client BEFORE importing services (dynamic import to ensure order)
  const { createAdminClient } = await import('../src/lib/supabase/admin');
  const { setGlobalClient } = await import('../src/lib/rag/store/vector-store.service');

  // Set up global client for script mode
  const adminClient = createAdminClient();
  setGlobalClient(adminClient);

  // Clean existing data first
  console.log('🧹 Cleaning existing data...');
  const { error: chunkError } = await adminClient
    .from('document_chunks')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (chunkError) console.error('Chunk delete error:', chunkError);

  const { error: docError } = await adminClient
    .from('documents')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (docError) console.error('Doc delete error:', docError);
  console.log('✅ Database cleaned\n');

  // Now import the ingest service (after client is set)
  const { ingestService } = await import('../src/lib/rag/ingest/ingest.service');

  const result = await ingestService.ingestAll();

  console.log('\n📊 Ingestion Results:');
  console.log(`   Total files: ${result.total}`);
  console.log(`   Success: ${result.success}`);
  console.log(`   Failed: ${result.failed}`);

  if (result.failed > 0) {
    console.log('\n❌ Failed files:');
    result.results
      .filter((r) => r.errors.length > 0)
      .forEach((r) => {
        console.log(`   - ${r.documentId || 'Unknown'}: ${r.errors.join(', ')}`);
      });
  }

  console.log('\n✅ Documents:');
  result.results
    .filter((r) => r.errors.length === 0)
    .forEach((r) => {
      console.log(`   - ${r.documentId}: ${r.chunksCreated} chunks`);
    });

  // Verify KEC code extraction
  console.log('\n🔍 Verifying KEC code extraction...');
  const { data: docs } = await adminClient.from('documents').select('id');
  const { data: chunks } = await adminClient.from('document_chunks').select('id');
  const { data: chunksWithKec } = await adminClient
    .from('document_chunks')
    .select('id, kec_codes')
    .not('kec_codes', 'is', null)
    .filter('kec_codes', 'neq', '{}');

  console.log(`   📄 Documents: ${docs?.length || 0}`);
  console.log(`   📦 Total chunks: ${chunks?.length || 0}`);
  console.log(`   🔖 Chunks with KEC codes: ${chunksWithKec?.length || 0}`);

  // Sample KEC codes
  if (chunksWithKec && chunksWithKec.length > 0) {
    const allCodes = chunksWithKec.flatMap((c) => (c as { kec_codes?: string[] }).kec_codes || []);
    const uniqueCodes = [...new Set(allCodes)].slice(0, 30);
    console.log(`   📋 Sample KEC codes (first 30): ${uniqueCodes.join(', ')}`);
  }

  // Check for specific codes
  const { data: specific232 } = await adminClient
    .from('document_chunks')
    .select('id')
    .contains('kec_codes', ['232.3.9']);
  console.log(`   🔍 Chunks with 232.3.9: ${specific232?.length || 0}`);

  const { data: specific142 } = await adminClient
    .from('document_chunks')
    .select('id')
    .contains('kec_codes', ['142.3']);
  console.log(`   🔍 Chunks with 142.3: ${specific142?.length || 0}`);

  console.log('\n🎉 Ingestion complete!');
}

main().catch((error) => {
  console.error('❌ Ingestion failed:', error);
  process.exit(1);
});
