import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { removeUserProfile } from '../services/supabase';

export function registerUnlinkCommand() {
  return new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink your Spotify account from MusicNerdCarl');
}

export async function handleUnlinkCommand(interaction: CommandInteraction) {
  // Immediately acknowledge the interaction to prevent timeout
  await interaction.deferReply({ ephemeral: true });
  
  try {
    await removeUserProfile(interaction.user.id);
    await interaction.editReply({
      content: 'Your Spotify account has been unlinked from MusicNerdCarl. You can use `/link` to connect again anytime!'
    });
  } catch (error) {
    console.error('Error unlinking user:', error);
    await interaction.editReply({
      content: 'Sorry, there was a problem unlinking your Spotify account. Please try again later.'
    });
  }
} 