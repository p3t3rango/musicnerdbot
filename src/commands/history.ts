import { ChatInputCommandInteraction } from 'discord.js';
import { getRecentlyPlayed } from '../services/spotify';
import { getUserProfile } from '../services/supabase';

export async function handleHistoryCommand(interaction: ChatInputCommandInteraction) {
  try {
    // Check if user has authenticated with Spotify
    const userProfile = await getUserProfile(interaction.user.id);
    if (!userProfile?.spotify_token) {
      await interaction.reply({
        content: "I don't have access to your Spotify account yet. Use `/link` to connect your account!",
        ephemeral: true
      });
      return;
    }

    // Get user's recently played tracks
    const recentTracks = await getRecentlyPlayed(interaction.user.id);
    if (!recentTracks?.length) {
      await interaction.reply({
        content: "I couldn't find any recently played tracks. Make sure you've been listening to some music!",
        ephemeral: true
      });
      return;
    }

    // Format the response
    const mostRecent = recentTracks[0];
    const response = `🎵 Your recently played tracks:\n\n${recentTracks.map((track, index) => 
      `${index + 1}. ${track.name} by ${track.artist}${track.played_at ? ` (played at ${new Date(track.played_at).toLocaleString()})` : ''}`
    ).join('\n')}`;

    await interaction.reply(response);
  } catch (error) {
    console.error('Error handling history command:', error);
    await interaction.reply({
      content: 'Sorry, something went wrong while fetching your listening history.',
      ephemeral: true
    });
  }
} 