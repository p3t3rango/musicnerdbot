import express from 'express';
import { handleSpotifyCallback } from './services/spotify';
import { CONFIG } from './config';
import { discordClient } from './index';
import { getUserLastChannel } from './services/supabase';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// OAuth callback endpoint
app.get('/spotify/callback', async (req, res) => {
  const { code, state } = req.query;
  
  console.log('\n=== Spotify Callback Received ===');
  console.log('Code:', code);
  console.log('State:', state);
  console.log('Server running on port:', PORT);
  
  if (!code || !state) {
    console.error('Missing parameters:', { code, state });
    return res.status(400).send('Missing code or state parameter');
  }

  try {
    // Handle the Spotify callback
    await handleSpotifyCallback(code as string, state as string);
    console.log('Successfully processed callback for user:', state);
    
    // After updating the user profile in Supabase, fetch the last channel ID
    const userId = state as string;
    const lastChannelId = await getUserLastChannel(userId);
    if (lastChannelId) {
      const channel = await discordClient.channels.fetch(lastChannelId);
      if (channel && 'send' in channel) {
        await channel.send({
          content: `🎵 Successfully linked your Spotify account! You can now use /track to get your current track info.`,
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 2,
                  label: 'Dismiss',
                  custom_id: 'dismiss'
                }
              ]
            }
          ]
        });
      } else {
        console.error(`Channel ${lastChannelId} not found or not text-based.`);
      }
    }
    
    // Send success response
    res.send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #1DB954;">Successfully connected to Spotify! 🎵</h1>
          <p>You can close this window and return to Discord.</p>
          <p>Try mentioning me to get commentary on your current track!</p>
          <script>
            // Notify Discord that auth is complete
            window.close();
          </script>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error('Error handling Spotify callback:', error);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #FF4136;">Error connecting to Spotify</h1>
          <p>Please try the /link command again in Discord.</p>
          <p>Error details: ${error.message || 'Unknown error'}</p>
        </body>
      </html>
    `);
  }
  console.log('=== Spotify Callback Handled ===\n');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.send('OK');
});

export function startServer() {
  app.listen(PORT, () => {
    console.log(`OAuth server running on port ${PORT}`);
  });
} 