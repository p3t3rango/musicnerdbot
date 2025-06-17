import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '../config';
import { SpotifyToken, UserProfile } from '../types';

// Initialize Supabase client
const supabase = createClient(CONFIG.supabase.url, CONFIG.supabase.key);

// Test the connection
export async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('user_profiles').select('count').limit(1);
    if (error) throw error;
    console.log('Supabase connection successful!');
    return true;
  } catch (error) {
    console.error('Error connecting to Supabase:', error);
    return false;
  }
}

// Store user's Spotify token
export async function storeSpotifyToken(userId: string, token: SpotifyToken) {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        id: userId,
        spotify_token: token,
        opt_in: true,
        last_activity: new Date().toISOString(),
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error storing Spotify token:', error);
    return false;
  }
}

// Get user's Spotify token
export async function getSpotifyToken(userId: string): Promise<SpotifyToken | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('spotify_token')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data?.spotify_token || null;
  } catch (error) {
    console.error('Error getting Spotify token:', error);
    return null;
  }
}

// Get user profile
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      // Don't log "no rows found" as an error - it's expected for users who haven't connected
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error getting user profile:', error);
      throw error;
    }
    return data;
  } catch (error: any) {
    // Only log unexpected errors
    if (error.code !== 'PGRST116') {
      console.error('Error getting user profile:', error);
    }
    return null;
  }
}

// Remove user profile
export async function removeUserProfile(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', userId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error removing user profile:', error);
    return false;
  }
}

// Store the last channel ID where the user interacted with the bot
export async function setUserLastChannel(userId: string, channelId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .upsert({ id: userId, last_channel: channelId }, { onConflict: 'id' });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error storing last channel ID:', error);
    return false;
  }
}

// Fetch the last channel ID where the user interacted with the bot
export async function getUserLastChannel(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('last_channel')
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    return data?.last_channel || null;
  } catch (error) {
    console.error('Error fetching last channel ID:', error);
    return null;
  }
} 