import { SlashCommandBuilder, CommandInteraction } from 'discord.js';

export function registerHelpCommand() {
  return new SlashCommandBuilder()
    .setName('help')
    .setDescription('Get help with using the bot');
}

export async function handleHelpCommand(interaction: CommandInteraction) {
  const helpMessage = `🎵 **MusicNerdCarl Help** 🎵

Here's how to use my features:

**Commands:**
• \`/link\` - Connect your Spotify account
• \`/track\` - Get commentary on your current track
• \`/history\` - Get commentary on your recently played tracks
• \`/taste\` - Get an analysis of your music taste
• \`/help\` - Show this help message

**Mentions:**
You can also mention me (@MusicNerdCarl) in any message to get commentary on your current track!

**Tips:**
• Make sure you're playing music on Spotify when using commands
• Use \`/link\` first to connect your Spotify account
• Ask "worth it?" after any response to get my rating

Need more help? Join our support server!`;

  await interaction.reply({
    content: helpMessage,
    ephemeral: true
  });
} 