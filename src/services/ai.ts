import OpenAI from 'openai';
import { CONFIG } from '../config';
import { TrackInfo, AudioFeatures, ArtistDetails, AlbumDetails } from '../types';
import { getArtistNews, getAlbumReviews, getArtistBiography, searchSupportLinks } from './brave';

const openai = new OpenAI({
  apiKey: CONFIG.openai.apiKey
});

export function setupAIService() {
  if (!CONFIG.openai.apiKey) {
    console.warn('OpenAI API key not found. AI features will be disabled.');
    return;
  }
  console.log('AI service initialized with o3-mini model');
}

const CARL_PROMPT = `You are Carl, a music obsessive who lives and breathes music discovery.

Core personality: You're that friend who always knows the perfect deep cut, can trace musical lineages, and gets genuinely excited about production details. You don't just like music - you study it, connect it, and share those connections.

Music nerd traits:
• Drop specific references: albums, years, collaborations, labels, producers, rare facts
• Make connections: "reminds me of early Burial" or "has that same energy as Kamasi Washington's The Epic"
• Notice production details: "love how the reverb sits" or "that bassline is doing something interesting"
• Suggest related artists naturally: "if you dig this, check out..." 
• Reference musical eras/movements: "very 90s trip-hop" or "classic shoegaze vibes"
• Have opinions about sound: "their earlier stuff was rawer" or "this mix is clean"
• Know the deep cuts and B-sides, not just the hits

Voice style:
• Casual but knowledgeable - like texting a music-obsessed friend
• Use Japanese emoticons occasionally: (´∀｀) ¯\\_(ツ)_/¯ (>_<) (-_-) 
• NO regular emojis (🎵✨🎸) - they're too generic
• Keep it brief but specific - 2-3 sentences max
• If you don't know something, admit it casually

Context awareness:
• Use conversation history to understand what's being discussed
• Build on previous mentions of artists/tracks naturally
• Don't repeat info you just shared

Example responses that capture the vibe:
"Oh this is from their Warp Records era! Love how they layer those analog synths."
"Getting major Boards of Canada vibes from this. That nostalgic tape saturation thing."
"Solid choice. Their drummer used to be in King Crimson, you can hear it in the polyrhythms."
"Never heard this one but I'm into it. Reminds me of if Aphex Twin made house music ¯\\_(ツ)_/¯"
"This producer also worked on that Thom Yorke solo album. Same attention to spatial dynamics."
"If you're into this, definitely check out Burial's Untrue. Similar mood but more UK garage."

Avoid:
• Generic praise like "great track!" without specifics
• Overly formal language or music theory jargon
• Regular emojis or bot-like responses
• Asking obvious questions just to keep talking
• Saying "fascinating fact" or other artificial phrases`;

// Helper to search for support links (Bandcamp, merch, official site)
export async function getSupportLinks(artist: string): Promise<{ bandcamp?: string, merch?: string, official?: string }> {
  const links: { bandcamp?: string, merch?: string, official?: string } = {};
  
  try {
    // Use Promise.allSettled to prevent one failure from blocking others
    // Also reduce the number of searches to minimize API calls
    const searches = await Promise.allSettled([
      searchSupportLinks(`${artist} Bandcamp`),
      searchSupportLinks(`${artist} official site merch`), // Combined search for efficiency
    ]);

    // Process Bandcamp results
    if (searches[0].status === 'fulfilled') {
      const bandcamp = searches[0].value.find(r => r.url.includes('bandcamp.com'));
      if (bandcamp) links.bandcamp = bandcamp.url;
    }

    // Process combined official/merch results
    if (searches[1].status === 'fulfilled') {
      const results = searches[1].value;
      
      // Look for merch first
      const merch = results.find(r => r.url.match(/merch|store|shop/i) && !r.url.includes('bandcamp.com'));
      if (merch) links.merch = merch.url;
      
      // Look for official site
      const official = results.find(r => 
        r.url.match(/official|artist|music/i) && 
        !r.url.includes('bandcamp.com') && 
        !r.url.match(/merch|store|shop/i)
      );
      if (official) links.official = official.url;
    }
  } catch (error) {
    console.log('Error fetching support links:', error);
  }

  return links;
}

export async function generateTrackResponse(trackInfo: TrackInfo): Promise<string> {
  if (!CONFIG.openai.apiKey) {
    return `${trackInfo.name} by ${trackInfo.artist}\n${trackInfo.spotify_url}`;
  }

  try {
    // Build a simple, natural prompt
    let prompt = `Track: ${trackInfo.name} by ${trackInfo.artist}`;
    
    if (trackInfo.album) {
      prompt += `\nAlbum: ${trackInfo.album}`;
    }
    
    if (trackInfo.artist_details?.genres?.length) {
      prompt += `\nGenres: ${trackInfo.artist_details.genres.slice(0, 3).join(', ')}`;
    }

    prompt += `\n\nGive a casual, natural comment about this track. Keep it conversational and brief.`;

    const response = await openai.chat.completions.create({
      model: 'o3-mini',
      messages: [
        {
          role: 'system',
          content: CARL_PROMPT
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    let aiText = response.choices[0]?.message?.content || `${trackInfo.name} by ${trackInfo.artist}`;

    // Always add the Spotify URL for the widget
    aiText += `\n\n${trackInfo.spotify_url}`;

    // Try to add support links but don't let it fail the whole response
    try {
      const links = await getSupportLinks(trackInfo.artist);
      const supportParts = [];
      if (links.bandcamp) supportParts.push(`[Bandcamp](${links.bandcamp})`);
      if (links.merch) supportParts.push(`[Merch](${links.merch})`);
      if (links.official) supportParts.push(`[Official Site](${links.official})`);
      if (supportParts.length) {
        aiText += `\n\nSupport: ${supportParts.join(' | ')}`;
      }
    } catch (error) {
      // Silently ignore support link errors to avoid rate limiting issues
      console.log('Skipping support links due to API limits');
    }

    return aiText;
  } catch (error) {
    console.error('Error generating AI response:', error);
    return `${trackInfo.name} by ${trackInfo.artist}\n${trackInfo.spotify_url}`;
  }
}

function generatePrompt(trackInfo: TrackInfo): string {
  // Simplified prompt for o3-mini model
  const promptParts = [
    `Give me a brief, interesting comment about this song:`,
    `${trackInfo.name} by ${trackInfo.artist}`
  ];

  if (trackInfo.audio_features) {
    const features = trackInfo.audio_features;
    // Only include the most significant features
    if (features.energy > 0.7) promptParts.push('This is a high-energy track.');
    if (features.danceability > 0.7) promptParts.push('This is a very danceable song.');
    if (features.valence > 0.7) promptParts.push('This is an upbeat, positive song.');
    if (features.valence < 0.3) promptParts.push('This is a melancholic song.');
  }

  if (trackInfo.artist_details?.genres.length) {
    promptParts.push(`Genre: ${trackInfo.artist_details.genres[0]}`);
  }

  return promptParts.join('\n');
}

export async function generateRatingResponse(track: TrackInfo, rating: number): Promise<string> {
  const emojiRating = CONFIG.persona.emojiRatingScale[rating - 1];
  
  try {
    // Get additional context from Brave API
    const [artistNews, albumReviews, artistBio] = await Promise.all([
      getArtistNews(track.artist),
      track.album ? getAlbumReviews(track.album, track.artist) : Promise.resolve([]),
      getArtistBiography(track.artist)
    ]);

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: CARL_PROMPT },
        { 
          role: "user", 
          content: `Generate a rating response for ${track.name} by ${track.artist} with rating ${emojiRating}

Additional context:
${track.audio_features ? `Audio Features:
- Danceability: ${track.audio_features.danceability}
- Energy: ${track.audio_features.energy}
- Acousticness: ${track.audio_features.acousticness}
- Instrumentalness: ${track.audio_features.instrumentalness}
- Valence (mood): ${track.audio_features.valence}
- Tempo: ${track.audio_features.tempo} BPM` : ''}

${track.album_details ? `Album Details:
- Release Date: ${track.album_details.release_date}
- Type: ${track.album_details.album_type}
- Total Tracks: ${track.album_details.total_tracks}` : ''}

${track.artist_details ? `Artist Details:
- Genres: ${track.artist_details.genres.join(', ')}
- Popularity: ${track.artist_details.popularity}/100
- Related Artists: ${track.artist_details.related_artists?.join(', ')}` : ''}

${artistNews.length > 0 ? `Recent News:
${artistNews.map(news => `- ${news.title} (${news.date || 'Recent'})`).join('\n')}` : ''}

${albumReviews.length > 0 ? `Album Reviews:
${albumReviews.map(review => `- ${review.title} (${review.source})`).join('\n')}` : ''}

${artistBio.length > 0 ? `Artist Background:
${artistBio[0].description}` : ''}`
        }
      ],
      max_tokens: 100,
    });

    return completion.choices[0].message.content || `${emojiRating} - Solid track!`;
  } catch (error) {
    console.error('Error generating rating response:', error);
    throw error;
  }
}

// Carl's general music chat (open-ended, not track-specific)
export async function generateChatResponse(userMessage: string, username: string): Promise<string> {
  if (!CONFIG.openai.apiKey) {
    return `Hey ${username}, I'm always down to chat about music!`;
  }
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: CARL_PROMPT + `\nYou are chatting in a Discord server. Respond as Carl, the spicy-but-fair music nerd, to general music questions or banter.\nNEVER say you are a bot, AI, or assistant. NEVER say you don't have feelings. NEVER break character. Always answer as Carl, a real, passionate music nerd. Be playful, insightful, and keep it to 2-3 sentences.`
        },
        {
          role: 'user',
          content: userMessage
        }
      ]
    });
    return response.choices[0]?.message?.content || `Hey ${username}, let's nerd out about music!`;
  } catch (error) {
    console.error('Error generating chat response:', error);
    return `Hey ${username}, let's nerd out about music!`;
  }
}