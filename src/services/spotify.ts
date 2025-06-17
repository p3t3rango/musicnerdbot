import SpotifyWebApi from 'spotify-web-api-node';
import { CONFIG } from '../config';
import { storeSpotifyToken, getSpotifyToken } from './supabase';
import { SpotifyTrack, SpotifyToken, TrackInfo, AudioFeatures, AlbumDetails, ArtistDetails } from '../types';

const spotifyApi = new SpotifyWebApi({
  clientId: CONFIG.spotify.clientId,
  clientSecret: CONFIG.spotify.clientSecret,
  redirectUri: CONFIG.spotify.redirectUri,
});

export function setupSpotifyAuth() {
  // Initialize Spotify API
  console.log('Spotify API initialized');
}

export function generateSpotifyAuthUrl(userId: string): string {
  const scopes = [
    'user-read-currently-playing',
    'user-read-recently-played',
    'user-top-read',
    'user-read-private',
    'user-read-email',
    'user-read-playback-state',
    'user-modify-playback-state',
  ];

  return spotifyApi.createAuthorizeURL(scopes, userId);
}

export async function handleSpotifyCallback(code: string, userId: string): Promise<void> {
  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    const token: SpotifyToken = {
      access_token: data.body.access_token,
      refresh_token: data.body.refresh_token,
      expires_in: data.body.expires_in,
      token_type: data.body.token_type,
      scope: data.body.scope,
      expires_at: Date.now() + (data.body.expires_in * 1000)
    };
    await storeSpotifyToken(userId, token);
  } catch (error) {
    console.error('Error handling Spotify callback:', error);
    throw error;
  }
}

export async function refreshToken(userId: string): Promise<void> {
  try {
    const token = await getSpotifyToken(userId);
    if (!token) {
      throw new Error('No token found for user');
    }

    spotifyApi.setRefreshToken(token.refresh_token);
    const data = await spotifyApi.refreshAccessToken();
    
    const newToken: SpotifyToken = {
      ...token,
      access_token: data.body.access_token,
      expires_in: data.body.expires_in,
      expires_at: Date.now() + (data.body.expires_in * 1000)
    };

    await storeSpotifyToken(userId, newToken);
    spotifyApi.setAccessToken(newToken.access_token);
  } catch (error) {
    console.error('Error refreshing token:', error);
    throw error;
  }
}

export async function getCurrentTrack(userId: string): Promise<SpotifyTrack | null> {
  try {
    const token = await getSpotifyToken(userId);
    if (!token) {
      throw new Error('No token found for user');
    }

    // Check if token is expired and refresh if needed
    if (Date.now() >= token.expires_at) {
      await refreshToken(userId);
    }

    spotifyApi.setAccessToken(token.access_token);
    const response = await spotifyApi.getMyCurrentPlaybackState();
    
    if (!response.body.is_playing || !response.body.item) {
      return null;
    }

    const item = response.body.item;
    if (item.type !== 'track') {
      return null;
    }

    const track = item;
    const trackId = track.id;
    
    // Get additional track details - make these optional due to Spotify's recent API restrictions
    let audioFeatures = null;
    let albumDetails: AlbumDetails | undefined = undefined;
    let artistDetails: ArtistDetails | undefined = undefined;
    
    try {
      const results = await Promise.allSettled([
        spotifyApi.getAudioFeaturesForTrack(trackId),
        spotifyApi.getAlbum(track.album.id),
        spotifyApi.getArtist(track.artists[0].id)
      ]);
      
      if (results[0].status === 'fulfilled') {
        audioFeatures = results[0].value.body;
      }
      
      if (results[1].status === 'fulfilled') {
        albumDetails = {
          name: results[1].value.body.name,
          album_type: results[1].value.body.album_type,
          total_tracks: results[1].value.body.tracks.total,
          release_date: results[1].value.body.release_date,
          images: results[1].value.body.images
        };
      }
      
      if (results[2].status === 'fulfilled') {
        artistDetails = {
          name: results[2].value.body.name,
          genres: results[2].value.body.genres,
          popularity: results[2].value.body.popularity,
          images: results[2].value.body.images
        };
      }
    } catch (error: any) {
      console.log('Note: Some additional track details unavailable due to Spotify API restrictions');
    }

    const trackInfo: SpotifyTrack = {
      item: {
        name: track.name,
        artists: track.artists.map(artist => ({
          name: artist.name,
          external_urls: artist.external_urls
        })),
        album: {
          name: track.album.name,
          external_urls: track.album.external_urls
        },
        external_urls: track.external_urls
      },
      audio_features: audioFeatures as AudioFeatures,
      album_details: albumDetails,
      artist_details: artistDetails
    };

    return trackInfo;
  } catch (error: any) {
    console.error('Error getting current track:', error);
    return null;
  }
}

export async function getRecentlyPlayed(userId: string): Promise<TrackInfo[]> {
  try {
    const token = await getSpotifyToken(userId);
    if (!token) {
      throw new Error('No token found for user');
    }

    if (Date.now() >= token.expires_at) {
      await refreshToken(userId);
    }

    spotifyApi.setAccessToken(token.access_token);
    const response = await spotifyApi.getMyRecentlyPlayedTracks({ limit: 5 });
    
    return response.body.items.map(item => ({
      name: item.track.name,
      artist: item.track.artists.map(a => a.name).join(', '),
      album: item.track.album.name,
      spotify_url: item.track.external_urls.spotify,
      played_at: item.played_at
    }));
  } catch (error) {
    console.error('Error getting recently played:', error);
    return [];
  }
}

export async function getUserTopArtists(userId: string): Promise<ArtistDetails[]> {
  try {
    const token = await getSpotifyToken(userId);
    if (!token) {
      throw new Error('No token found for user');
    }

    if (Date.now() >= token.expires_at) {
      await refreshToken(userId);
    }

    spotifyApi.setAccessToken(token.access_token);
    const response = await spotifyApi.getMyTopArtists({ limit: 5 });
    
    return response.body.items.map(artist => ({
      name: artist.name,
      genres: artist.genres,
      popularity: artist.popularity,
      images: artist.images
    }));
  } catch (error) {
    console.error('Error getting top artists:', error);
    return [];
  }
} 