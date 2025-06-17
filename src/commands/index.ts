import { REST, Routes, SlashCommandBuilder, Client } from 'discord.js';
import { registerLinkCommand } from './link';
import { registerTrackCommand } from './track';
import { registerTasteCommand } from './taste';
import { registerHelpCommand } from './help';
import { registerUnlinkCommand } from './unlink';

export async function registerCommands(client: Client) {
  const commands = [
    registerLinkCommand(),
    registerTrackCommand(),
    registerTasteCommand(),
    registerHelpCommand(),
    registerUnlinkCommand(),
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
  try {
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
      { body: commands }
    );
    console.log('Commands registered successfully.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
} 