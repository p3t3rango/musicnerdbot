import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { getUserTopArtists } from '../services/spotify';
import { generateChatResponse } from '../services/ai';
import { ArtistDetails } from '../types';

export function registerTasteCommand() {
  return new SlashCommandBuilder()
    .setName('taste')
    .setDescription('Get an analysis of your music taste based on your top artists');
}

export async function handleTasteCommand(interaction: CommandInteraction) {
  try {
    await interaction.deferReply();

    const topArtists = await getUserTopArtists(interaction.user.id);
    if (!topArtists?.length) {
      await interaction.editReply("I don't have enough data to analyze your music taste yet. Keep listening to music and try again later!");
      return;
    }

    // Gather top artist names and genres
    const artistNames = topArtists.map(a => a.name);
    const allGenres = topArtists.flatMap(a => a.genres);
    const uniqueGenres = Array.from(new Set(allGenres)).slice(0, 5); // up to 5 genres

    // Build a custom prompt for the music nerd bot
    const tastePrompt = `Analyze this user's top artists: ${artistNames.join(', ')}.\nTheir top genres are: ${uniqueGenres.join(', ')}.\nGive a spicy, 2-3 sentence summary of their music taste, referencing trends, fun facts, and any bold opinions. Respond as a passionate music nerd.`;

    const response = await generateChatResponse(tastePrompt, interaction.user.username);
    await interaction.editReply(response);
  } catch (error: any) {
    console.error('Error handling taste command:', error);
    if (error.message === 'No Spotify token found for user') {
      await interaction.editReply("I don't have access to your Spotify account yet. Use `/link` to connect your account!");
    } else {
      await interaction.editReply("Sorry, I'm having trouble analyzing your music taste right now. Try again in a moment!");
    }
  }
} 