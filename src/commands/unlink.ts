import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { removeUserProfile } from '../services/supabase';

export function registerUnlinkCommand() {
  return new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink your Spotify account from MusicNerdCarl');
}

export async function handleUnlinkCommand(interaction: CommandInteraction) {
  try {
    await removeUserProfile(interaction.user.id);
    await interaction.reply({
      content: 'Your Spotify account has been unlinked from MusicNerdCarl. You can use `/link` to connect again anytime!',
      ephemeral: true
    });
  } catch (error) {
    console.error('Error unlinking user:', error);
    await interaction.reply({
      content: 'Sorry, there was a problem unlinking your Spotify account. Please try again later.',
      ephemeral: true
    });
  }
} 