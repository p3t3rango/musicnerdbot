import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getCurrentTrack } from '../services/spotify';
import { SpotifyTrack } from '../types';

const MAX_CALLS_PER_USER_PER_DAY = 10;

interface NerdoutSession {
  userId: string;
  channelId: string;
  lastTrackId: string;
  intervalId: NodeJS.Timeout;
  callsToday: number; // Track API calls per user per day
  lastResetDate: string; // Track when we last reset the counter
  currentStorySnippets: string[];
  snippetIndex: number;
  lastSnippetTime: number;
}

// Cache for artist information
const ARTIST_CACHE = new Map<string, { info: string[], timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Active sessions
const activeNerdoutSessions = new Map<string, NerdoutSession>();

export const nerdoutCommand = {
  data: new SlashCommandBuilder()
    .setName('nerdout')
    .setDescription('Start a nerdout session - I\'ll share fascinating facts about your music as tracks change')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('What to do')
        .setRequired(false)
        .addChoices(
          { name: 'Start session', value: 'start' },
          { name: 'Stop session', value: 'stop' }
        ))
    .addBooleanOption(option =>
      option.setName('simple')
        .setDescription('Use simple mode (no web search, unlimited use)')
        .setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction) {
    const action = interaction.options.getString('action') || 'start';
    const simpleMode = interaction.options.getBoolean('simple') || false;
    const userId = interaction.user.id;
    const channelId = interaction.channel?.id;
    
    if (!channelId) {
      await interaction.reply({ content: 'This command must be used in a text channel!', ephemeral: true });
      return;
    }

    if (action === 'stop') {
      const session = activeNerdoutSessions.get(userId);
      if (session) {
        clearInterval(session.intervalId);
        activeNerdoutSessions.delete(userId);
        
        const embed = new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('Nerdout Session Ended')
          .setDescription('Session ended. Use `/nerdout` again anytime to start a new session.')
          .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
      } else {
        await interaction.reply({ content: 'You don\'t have an active nerdout session!', ephemeral: true });
      }
      return;
    }

    // Check if user already has an active session
    if (activeNerdoutSessions.has(userId)) {
      await interaction.reply({ 
        content: 'You already have an active nerdout session! Use `/nerdout stop` to end it first.', 
        ephemeral: true 
      });
      return;
    }

    // Immediately acknowledge the interaction to prevent timeout
    if (simpleMode) {
      await interaction.reply({ 
        content: 'Starting your session in **simple mode** (no web search). I\'ll share knowledge-based facts about your music as tracks change.', 
        ephemeral: true 
      });
    } else {
      await interaction.reply({ 
        content: `Starting your session with **web search enabled**. You have ${MAX_CALLS_PER_USER_PER_DAY} searches available today. I\'ll share current facts about your music as tracks change.`, 
        ephemeral: true 
      });
    }

    try {
      // Get current track (this might take time, so we do it after replying)
      const currentTrack = await getCurrentTrack(userId);
      if (!currentTrack) {
        await interaction.followUp({ 
          content: 'I can\'t see what you\'re listening to! Make sure your Spotify is playing and you\'re linked with `/link`.' 
        });
        return;
      }

      // Initialize session with cost tracking
      const today = new Date().toDateString();
      const callsToday = 0; // Will be incremented as we make calls

      // Send initial facts
      await sendMusicFacts(interaction, currentTrack, true, simpleMode, callsToday, today);

      // Set up monitoring for track changes AND snippet delivery
      const intervalId = setInterval(async () => {
        try {
          const newTrack = await getCurrentTrack(userId);
          const session = activeNerdoutSessions.get(userId);
          
          if (!newTrack || !session) {
            // Stop session if no track or session was removed
            clearInterval(intervalId);
            activeNerdoutSessions.delete(userId);
            return;
          }

          // Check if track changed
          if (newTrack.id !== session.lastTrackId) {
            console.log(`Track changed for ${userId}: ${newTrack.item.name} by ${newTrack.item.artists[0].name}`);
            session.lastTrackId = newTrack.id;
            
            // Reset daily counter if it's a new day
            if (session.lastResetDate !== today) {
              session.callsToday = 0;
              session.lastResetDate = today;
            }
            
            await sendMusicFacts(interaction, newTrack, false, simpleMode, session.callsToday, session.lastResetDate);
          } else {
            // SNIPPET DELIVERY: Check if we should send the next snippet for the current track
            const now = Date.now();
            const timeSinceLastSnippet = now - session.lastSnippetTime;
            const hasMoreSnippets = session.snippetIndex < session.currentStorySnippets.length;
            
            // Send next snippet every 20-40 seconds (random interval to feel natural)
            const snippetInterval = 20000 + (Math.random() * 20000); // 20-40 seconds
            
            if (hasMoreSnippets && timeSinceLastSnippet > snippetInterval) {
              const nextSnippet = session.currentStorySnippets[session.snippetIndex];
              
              try {
                await interaction.followUp({
                  content: nextSnippet
                });
                
                console.log(`📤 Sent snippet ${session.snippetIndex + 1}/${session.currentStorySnippets.length}: "${nextSnippet.substring(0, 60)}..."`);
                
                session.snippetIndex++;
                session.lastSnippetTime = now;
                
                // If we've sent all snippets, log completion
                if (session.snippetIndex >= session.currentStorySnippets.length) {
                  console.log(`✅ All ${session.currentStorySnippets.length} snippets delivered for current track`);
                }
              } catch (error) {
                console.error('❌ Error sending snippet:', error);
              }
            }
          }
        } catch (error) {
          console.error('Error in nerdout monitoring:', error);
        }
      }, 5000); // Check every 5 seconds

      // Store session
      activeNerdoutSessions.set(userId, {
        userId,
        channelId,
        lastTrackId: currentTrack.id,
        intervalId,
        callsToday,
        lastResetDate: today,
        currentStorySnippets: [],
        snippetIndex: 0,
        lastSnippetTime: 0
      });

      // Auto-stop after 2 hours
      setTimeout(() => {
        const session = activeNerdoutSessions.get(userId);
        if (session) {
          clearInterval(session.intervalId);
          activeNerdoutSessions.delete(userId);
          
          interaction.followUp({ 
            content: 'Your nerdout session has ended after 2 hours. Use `/nerdout` to start a new one!' 
          }).catch(() => {}); // Ignore errors if channel is unavailable
        }
      }, 2 * 60 * 60 * 1000); // 2 hours
      
    } catch (error) {
      console.error('Error setting up nerdout session:', error);
      await interaction.followUp({ 
        content: 'Sorry, there was a problem setting up your nerdout session. Please try again later.' 
      });
    }
  }
};

async function sendMusicFacts(
  interaction: ChatInputCommandInteraction, 
  trackInfo: SpotifyTrack, 
  isInitial: boolean, 
  simpleMode: boolean,
  callsToday: number,
  lastResetDate: string
) {
  try {
    const artistName = trackInfo.item.artists[0].name;
    const trackName = trackInfo.item.name;
    
    // Send initial track message (natural, no emojis)
    if (isInitial) {
      await interaction.followUp({ 
        content: `Now playing "${trackName}" by ${artistName}` 
      });
    } else {
      await interaction.followUp({ 
        content: `Oh, "${trackName}" by ${artistName}` 
      });
    }

    // Check if we should use simple mode or if we've hit daily limits
    const shouldUseWebSearch = !simpleMode && callsToday < MAX_CALLS_PER_USER_PER_DAY;
    
    if (!shouldUseWebSearch && !simpleMode) {
      await interaction.followUp({
        content: `You've reached your daily limit of ${MAX_CALLS_PER_USER_PER_DAY} web searches. Using simple mode for the rest of today.`
      });
    }

    // Generate story snippets and store them in the session for gradual delivery
    let storySnippets: string[] = [];
    
    if (shouldUseWebSearch) {
      // Use Claude with web search (expensive)
      console.log(`\n🔍 CLAUDE WEB SEARCH: Processing "${trackName}" by ${artistName} (Call ${callsToday + 1}/${MAX_CALLS_PER_USER_PER_DAY})`);
      storySnippets = await getClaudeBasedSnippets(artistName, trackName);
      
      // Increment the call counter
      const session = activeNerdoutSessions.get(interaction.user.id);
      if (session) {
        session.callsToday++;
      }
    } else {
      // Use simple mode with Claude 3.5 (cheaper, no web search)
      console.log(`\n🎯 SIMPLE MODE: Processing "${trackName}" by ${artistName}`);
      storySnippets = await getClaudeSimpleSnippets(artistName, trackName);
    }

    // Store snippets in the session for gradual delivery
    const session = activeNerdoutSessions.get(interaction.user.id);
    if (session && storySnippets.length > 0) {
      session.currentStorySnippets = storySnippets;
      session.snippetIndex = 0;
      session.lastSnippetTime = Date.now();
      
      console.log(`📦 Stored ${storySnippets.length} snippets for gradual delivery throughout the song`);
      
      // Send the first snippet immediately
      if (storySnippets[0]) {
        await interaction.followUp({
          content: storySnippets[0]
        });
        console.log(`📤 Sent snippet 1/${storySnippets.length}: "${storySnippets[0].substring(0, 60)}..."`);
        session.snippetIndex = 1;
        session.lastSnippetTime = Date.now();
      }
    }

  } catch (error) {
    console.error('Error sending music facts:', error);
    await interaction.followUp({ 
      content: 'Having trouble getting facts about this track, but I\'ll keep trying.' 
    }).catch(() => {}); // Ignore errors if channel is unavailable
  }
}

async function getClaudeSimpleSnippets(
  artistName: string,
  trackName: string
): Promise<string[]> {
  try {
    // Import Claude 3.5 service for simple story generation (no web search)
    const { generateSimpleStoryWithClaude35 } = await import('../services/claude');
    
    // Get story snippets using Claude 3.5 (cheaper, no web search)
    const snippets = await generateSimpleStoryWithClaude35(artistName, trackName);

    console.log(`🎯 CLAUDE 3.5: Generated ${snippets.length} story snippets for gradual delivery`);
    return snippets;

  } catch (error) {
    console.error('❌ Error in Claude 3.5 simple mode:', error);
    return ["Having trouble pulling together the story about this track right now."];
  }
}

async function getClaudeBasedSnippets(
  artistName: string,
  trackName: string
): Promise<string[]> {
  try {
    // Import Claude service - now using single consolidated function
    const { generateCompleteStoryWithClaude } = await import('../services/claude');
    
    // Get story snippets in one API call instead of three separate calls
    const snippets = await generateCompleteStoryWithClaude(artistName, trackName);

    console.log(`🎯 CLAUDE: Generated ${snippets.length} story snippets for gradual delivery`);
    return snippets;

  } catch (error) {
    console.error('❌ Error in Claude orchestrator:', error);
    return ["Having trouble pulling together the story about this track right now."];
  }
}

// Export function to clean up sessions on bot shutdown
export function cleanupNerdoutSessions() {
  activeNerdoutSessions.forEach(session => {
    clearInterval(session.intervalId);
  });
  activeNerdoutSessions.clear();
} 