import { config } from 'dotenv';
import path from 'path';

// Load environment variables from local.env
config({ path: path.resolve(__dirname, '../local.env') });

export const CONFIG = {
  // Bot configuration
  botName: process.env.BOT_NAME || 'Music Nerd',
  botToken: process.env.DISCORD_BOT_TOKEN!,
  clientId: process.env.DISCORD_CLIENT_ID!,
  clientSecret: process.env.DISCORD_CLIENT_SECRET!,
  redirectUri: process.env.REDIRECT_URI!,
  
  // Spotify configuration
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID!,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI!,
  },
  
  // OpenAI configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
  },
  
  // Claude configuration
  claude: {
    apiKey: process.env.CLAUDE_API_KEY!,
  },
  
  // Supabase configuration
  supabase: {
    url: process.env.SUPABASE_URL!,
    key: process.env.SUPABASE_KEY!,
  },
  
  // Google Custom Search API configuration
  google: {
    apiKey: process.env.GOOGLE_API_KEY!,
    customSearchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID!,
  },
  
  // Brave API configuration
  brave: {
    apiKey: process.env.BRAVE_API_KEY!,
  },
  
  // Rate limiting
  rateLimits: {
    messageThrottleMs: 180000, // 3 minutes
    spotifyApiThrottleMs: 1000, // 1 second
    braveApiThrottleMs: 1000, // 1 second
  },
  
  // AI Persona settings
  persona: {
    maxResponseLength: 3, // Maximum number of sentences
    emojiRatingScale: ['🧀', '🧀🧀', '🧀🧀🧀', '🧀🧀🧀🧀', '��🧀🧀🧀'],
  },
}; 