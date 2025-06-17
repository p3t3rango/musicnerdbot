import { Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { CONFIG } from './config';
import { registerCommands } from './commands';
import { setupSpotifyAuth, getCurrentTrack } from './services/spotify';
import { startServer } from './server';
import { TrackInfo, SpotifyTrack } from './types';
import { handleLinkCommand } from './commands/link';
import { handleTrackCommand } from './commands/track';
import { handleHistoryCommand } from './commands/history';
import { handleTasteCommand } from './commands/taste';
import { handleHelpCommand } from './commands/help';
import { getUserProfile } from './services/supabase';
import { setupAIService, generateTrackResponse, generateChatResponse } from './services/ai';
import { handleUnlinkCommand } from './commands/unlink';

// Create Discord client with required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Initialize services
setupSpotifyAuth();
setupAIService();

// Start OAuth server
startServer();

// Bot ready event
client.once(Events.ClientReady, async (readyClient) => {
  console.log('=== Bot Startup ===');
  console.log(`${CONFIG.botName} is ready! Logged in as ${readyClient.user.tag}`);
  console.log(`Bot ID: ${readyClient.user.id}`);
  console.log(`Guilds: ${readyClient.guilds.cache.map(g => g.name).join(', ')}`);
  
  try {
    console.log('\n=== Registering Commands ===');
    console.log('Started refreshing application (/) commands.');
    await registerCommands(readyClient);
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
  console.log('=== Bot Ready ===\n');
});

// Handle slash commands
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  console.log(`\n=== Command Received ===`);
  console.log(`Command: ${interaction.commandName}`);
  console.log(`User: ${interaction.user.tag}`);
  console.log(`Guild: ${interaction.guild?.name}`);

  try {
    switch (interaction.commandName) {
      case 'link':
        await handleLinkCommand(interaction);
        break;
      case 'track':
        await handleTrackCommand(interaction);
        break;
      case 'history':
        await handleHistoryCommand(interaction);
        break;
      case 'taste':
        await handleTasteCommand(interaction);
        break;
      case 'help':
        await handleHelpCommand(interaction);
        break;
      case 'unlink':
        await handleUnlinkCommand(interaction);
        break;
      default:
        console.log(`Unknown command: ${interaction.commandName}`);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'Unknown command. Use /help to see available commands.',
            ephemeral: true
          });
        }
    }
  } catch (error) {
    console.error('Error handling command:', error);
    
    // Only try to respond if we haven't already responded and the interaction is still valid
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'Sorry, something went wrong while processing your command.',
          ephemeral: true 
        });
      } else if (interaction.deferred && !interaction.replied) {
        await interaction.editReply('Sorry, something went wrong while processing your command.');
      }
    } catch (replyError) {
      console.error('Failed to send error response:', replyError);
    }
  }
  console.log('=== Command Handled ===\n');
});

// Handle messages
client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;
  const isMentioned = message.mentions.has(client.user!);
  if (!isMentioned) return;

  console.log(`\n=== Mention Received ===`);
  console.log(`From: ${message.author.tag}`);
  console.log(`Channel: ${message.channel.id}`);
  console.log(`Content: ${message.content}`);

  try {
    // Remove the bot mention from the message for cleaner processing
    const cleanMessage = message.content.replace(/<@!?\d+>/g, '').trim();
    const lowerMsg = cleanMessage.toLowerCase();

    // Keywords for Spotify-specific requests
    const spotifyKeywords = [
      // Explicit current track questions
      'what am i listening',
      'my current track',
      'my current song',
      'my now playing',
      'what song am i',
      'what track am i',
      'currently playing',
      'now playing',
      
      // References to "this" track/song
      'this track',
      'this song',
      'this music',
      'what i\'m listening to',
      'what im listening to',
      'listening to now',
      'playing now',
      'track i\'m listening',
      'track im listening',
      'song i\'m listening',
      'song im listening',
      'what do you think of this',
      'thoughts on this track',
      'thoughts on this song',
      
      // Profile/stats requests
      'my top',
      'analyze my taste',
      'my spotify',
      'my stats',
      'my music data',
      'my listening history',
      'my favorite artist',
      'my favorite song',
      'my favorite album',
      'my most played',
      'my recently played',
      'my playlist',
      'my profile',
      'my recommendations'
    ];
    const isSpotifyRequest = spotifyKeywords.some(keyword => lowerMsg.includes(keyword));

    // Check if user has authenticated with Spotify
    const userProfile = await getUserProfile(message.author.id);

    if (isSpotifyRequest && !userProfile?.spotify_token) {
      await message.reply("I'd love to check, but you need to connect your Spotify account first! Use /link to get started.");
      return;
    }

    // If user is connected and it's a Spotify request, try to answer with Spotify data
    if (isSpotifyRequest && userProfile?.spotify_token) {
      const currentTrack = await getCurrentTrack(message.author.id);
      if (currentTrack?.item) {
        const trackInfo: TrackInfo = {
          name: currentTrack.item.name,
          artist: currentTrack.item.artists[0].name,
          album: currentTrack.item.album.name,
          spotify_url: currentTrack.item.external_urls.spotify,
          audio_features: currentTrack.audio_features,
          album_details: currentTrack.album_details,
          artist_details: currentTrack.artist_details
        };
        
        const response = await generateTrackResponse(trackInfo);
        await message.reply(response);
        return;
      } else {
        await message.reply("I can't see you listening to anything on Spotify right now. Try using `/track` while playing something on Spotify!");
        return;
      }
    }

    // For all messages, provide conversation context to help Carl understand what's being discussed
    try {
      // Fetch recent conversation history
      const recentMessages = await message.channel.messages.fetch({ limit: 5 });
      const conversationHistory = recentMessages
        .filter(msg => msg.createdTimestamp > Date.now() - 10 * 60 * 1000) // Last 10 minutes
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp) // Chronological order
        .map(msg => {
          const author = msg.author.bot ? 'Carl' : msg.author.username;
          const content = msg.content.replace(/<@!?\d+>/g, '').trim(); // Remove mentions
          return `${author}: ${content}`;
        })
        .slice(-4) // Keep last 4 messages for context
        .join('\n');

      // Build the prompt with conversation context
      let promptWithContext = cleanMessage;
      if (conversationHistory) {
        promptWithContext = `Recent conversation:\n${conversationHistory}\n\nCurrent message: ${cleanMessage}`;
      }

      const aiResponse = await generateChatResponse(promptWithContext, message.author.username);
      await message.reply(aiResponse);
    } catch (error: any) {
      console.error('Error handling message:', error);
      await message.reply("Sorry, I'm having trouble processing that right now. Try again in a moment!");
    }
  } catch (error: any) {
    console.error('Error handling message:', error);
    await message.reply("Sorry, I'm having trouble processing that right now. Try again in a moment!");
  }
  console.log('=== Mention Handled ===\n');
});

// Login to Discord
client.login(CONFIG.botToken);

// Export the Discord client for use in the server callback
export const discordClient = client; 