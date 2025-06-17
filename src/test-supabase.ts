import { testSupabaseConnection, storeSpotifyToken, getSpotifyToken } from './services/supabase';

async function runTests() {
  console.log('Testing Supabase connection...');
  
  // Test 1: Connection
  const connectionTest = await testSupabaseConnection();
  console.log('Connection test:', connectionTest ? 'PASSED' : 'FAILED');
  
  if (!connectionTest) {
    console.error('Failed to connect to Supabase. Please check your credentials and try again.');
    process.exit(1);
  }
  
  // Test 2: Store token
  const testToken = {
    access_token: 'test_access_token',
    refresh_token: 'test_refresh_token',
    expires_in: 3600,
    token_type: 'Bearer',
    scope: 'user-read-currently-playing user-read-playback-state',
    expires_at: Date.now() + (3600 * 1000)
  };
  
  console.log('\nTesting token storage...');
  const storeTest = await storeSpotifyToken('test_user', testToken);
  console.log('Token storage test:', storeTest ? 'PASSED' : 'FAILED');
  
  // Test 3: Retrieve token
  console.log('\nTesting token retrieval...');
  const retrievedToken = await getSpotifyToken('test_user');
  console.log('Token retrieval test:', retrievedToken ? 'PASSED' : 'FAILED');
  
  if (retrievedToken) {
    console.log('Retrieved token:', {
      access_token: retrievedToken.access_token.substring(0, 10) + '...',
      refresh_token: retrievedToken.refresh_token.substring(0, 10) + '...',
      expires_in: retrievedToken.expires_in,
      token_type: retrievedToken.token_type
    });
  }
}

runTests().catch(console.error); 