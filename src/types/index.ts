export interface SpotifyToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  expires_at: number;
}

export interface UserProfile {
  id: string;
  spotify_token?: SpotifyToken;
  created_at: string;
  updated_at: string;
  opt_in: boolean;
  last_activity: Date;
  display_name?: string;
  country?: string;
  profile_image?: string;
  followers_count?: number;
}

export interface TrackInfo {
  name: string;
  artist: string;
  album: string;
  spotify_url: string;
  played_at?: string;
  audio_features?: AudioFeatures;
  album_details?: AlbumDetails;
  artist_details?: ArtistDetails;
}

export interface AudioFeatures {
  danceability: number;
  energy: number;
  key: number;
  loudness: number;
  mode: number;
  speechiness: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  valence: number;
  tempo: number;
  type: string;
  id: string;
  uri: string;
  track_href: string;
  analysis_url: string;
  duration_ms: number;
  time_signature: number;
}

export interface AlbumDetails {
  name: string;
  album_type: string;
  total_tracks: number;
  release_date: string;
  images: SpotifyImage[];
}

export interface ArtistDetails {
  name: string;
  genres: string[];
  popularity: number;
  images: SpotifyImage[];
  related_artists?: string[];
}

export interface SpotifyImage {
  url: string;
  height?: number;
  width?: number;
}

export interface PlaylistInfo {
  id: string;
  name: string;
  description: string;
  owner: string;
  tracks_count: number;
  images: SpotifyImage[];
  tracks: TrackInfo[];
}

export interface TopItems {
  short_term: {
    tracks: TrackInfo[];
    artists: ArtistDetails[];
  };
  medium_term: {
    tracks: TrackInfo[];
    artists: ArtistDetails[];
  };
  long_term: {
    tracks: TrackInfo[];
    artists: ArtistDetails[];
  };
}

export interface SpotifyTrack {
  item: {
    name: string;
    artists: Array<{
      name: string;
      external_urls: {
        spotify: string;
      };
    }>;
    album: {
      name: string;
      external_urls: {
        spotify: string;
      };
    };
    external_urls: {
      spotify: string;
    };
  };
  audio_features?: AudioFeatures;
  album_details?: AlbumDetails;
  artist_details?: ArtistDetails;
} 