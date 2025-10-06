#!/usr/bin/env node

/**
 * Firestore Connectivity Verification Script
 * Verifies that Firestore is properly configured and accessible
 */

const { Firestore } = require('@google-cloud/firestore');

async function verifyFirestore() {
  console.log('🔍 Verifying Firestore connectivity...');

  try {
    // Initialize Firestore
    const firestore = new Firestore({
      projectId: process.env.GCP_PROJECT_ID || 'hyperush-dev-250930115246',
    });

    console.log('✅ Firestore client initialized');

    // Test basic connectivity by getting app metadata
    const testDoc = firestore.collection('_verification').doc('test');

    // Try to write a test document
    const testData = {
      timestamp: new Date().toISOString(),
      verification: 'firestore-connectivity-test',
      environment: process.env.NODE_ENV || 'development',
      service: 'verification-script',
    };

    await testDoc.set(testData);
    console.log('✅ Test document written successfully');

    // Try to read the test document
    const doc = await testDoc.get();
    if (doc.exists) {
      const data = doc.data();
      console.log('✅ Test document read successfully:', data);
    } else {
      throw new Error('Test document not found after write');
    }

    // Clean up test document
    await testDoc.delete();
    console.log('✅ Test document cleaned up');

    // Test collection listing (requires special permissions)
    try {
      const collections = await firestore.listCollections();
      console.log(
        `✅ Collection listing successful (${collections.length} collections)`
      );
    } catch (error) {
      console.log(
        '⚠️  Collection listing requires additional permissions:',
        error.message
      );
    }

    console.log('\n🎉 Firestore verification completed successfully!');

    return {
      status: 'success',
      projectId: firestore.projectId,
      databaseId: firestore.databaseId,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ Firestore verification failed:', error.message);
    console.error('Stack trace:', error.stack);

    return {
      status: 'failed',
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

// Run verification if script is executed directly
if (require.main === module) {
  verifyFirestore()
    .then((result) => {
      console.log('\nVerification result:', JSON.stringify(result, null, 2));
      process.exit(result.status === 'success' ? 0 : 1);
    })
    .catch((error) => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { verifyFirestore };
