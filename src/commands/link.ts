import { SlashCommandBuilder, CommandInteraction, ChatInputCommandInteraction } from 'discord.js';
import { generateSpotifyAuthUrl } from '../services/spotify';
import { setUserLastChannel, getUserProfile } from '../services/supabase';

export function registerLinkCommand() {
  return new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Spotify account to get personalized music commentary');
}

export async function handleLinkCommand(interaction: ChatInputCommandInteraction) {
  // Immediately acknowledge the interaction to prevent timeout
  await interaction.deferReply({ ephemeral: true });
  
  const userId = interaction.user.id;
  const userProfile = await getUserProfile(userId);
  
  if (userProfile?.spotify_token) {
    await interaction.editReply({
      content: "You're already connected to Spotify! Use /track to get your current track info."
    });
    return;
  }
  
  // Store the channel ID for later use
  await setUserLastChannel(userId, interaction.channelId);
  
  const authUrl = generateSpotifyAuthUrl(userId);
  await interaction.editReply({
    content: `Click [here](${authUrl}) to connect your Spotify account.`
  });
} 