import { SlashCommandBuilder, CommandInteraction, ChatInputCommandInteraction } from 'discord.js';
import { generateSpotifyAuthUrl } from '../services/spotify';
import { setUserLastChannel, getUserProfile } from '../services/supabase';

export function registerLinkCommand() {
  return new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Spotify account to get personalized music commentary');
}

export async function handleLinkCommand(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const userProfile = await getUserProfile(userId);
  
  if (userProfile?.spotify_token) {
    await interaction.reply({
      content: "You're already connected to Spotify! Use /track to get your current track info.",
      ephemeral: true
    });
    return;
  }
  
  // Store the channel ID for later use
  await setUserLastChannel(userId, interaction.channelId);
  
  const authUrl = generateSpotifyAuthUrl(userId);
  await interaction.reply({
    content: `Click [here](${authUrl}) to connect your Spotify account.`,
    ephemeral: true
  });
} 