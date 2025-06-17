import { SlashCommandBuilder, CommandInteraction, ChatInputCommandInteraction } from 'discord.js';
import { getCurrentTrack } from '../services/spotify';
import { getUserProfile } from '../services/supabase';
import { generateTrackResponse } from '../services/ai';
import { TrackInfo } from '../types';

export function registerTrackCommand() {
  return new SlashCommandBuilder()
    .setName('track')
    .setDescription('Get commentary on your current Spotify track');
}

export async function handleTrackCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }

  try {
    // Check if interaction is still valid before deferring
    if (interaction.deferred || interaction.replied) {
      console.log('Interaction already handled, skipping...');
      return;
    }

    await interaction.deferReply();

    const userProfile = await getUserProfile(interaction.user.id);
    
    if (!userProfile?.spotify_token) {
      await interaction.editReply("You need to connect your Spotify account first! Use `/link` to get started.");
      return;
    }

    const currentTrack = await getCurrentTrack(interaction.user.id);
    
    if (!currentTrack?.item) {
      await interaction.editReply("I can't see you listening to anything on Spotify right now. Make sure you're playing something and try again!");
      return;
    }

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
    
    await interaction.editReply(response);
  } catch (error) {
    console.error('Error in track command:', error);
    
    // Only try to respond if the interaction hasn't been handled yet
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'Sorry, I had trouble getting your current track. Make sure you\'re playing something on Spotify and try again!', 
          ephemeral: true 
        });
      } else if (interaction.deferred) {
        await interaction.editReply('Sorry, I had trouble getting your current track. Make sure you\'re playing something on Spotify and try again!');
      }
    } catch (replyError) {
      console.error('Failed to send error response:', replyError);
    }
  }
} 