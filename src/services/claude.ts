import Anthropic from '@anthropic-ai/sdk';
import { CONFIG } from '../config';

// Initialize Claude client
const claude = new Anthropic({
  apiKey: CONFIG.claude.apiKey,
});

// Claude 3.5 Sonnet client for general text generation (cheaper, more reliable)
async function callClaude35(prompt: string): Promise<string> {
  const maxRetries = 5;
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await claude.messages.create({
        model: 'claude-3-5-sonnet-20241022', // Claude 3.5 Sonnet
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const result = response.content[0]?.type === 'text' ? response.content[0].text : '';
      
      if (result.trim()) {
        console.log(`✅ Claude 3.5: Success on attempt ${attempt}`);
        return result;
      } else {
        console.log(`⚠️ Claude 3.5: Empty response on attempt ${attempt}`);
        lastError = new Error('Empty response');
      }
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Claude 3.5 API attempt ${attempt}/${maxRetries} failed:`, error.status || error.message);
      
      // Enhanced retry logic for different error types
      if ((error.status === 529 || error.status === 503 || error.status === 502) && attempt < maxRetries) {
        const waitTime = Math.min(attempt * 3000, 15000); // 3s, 6s, 9s, 12s, 15s max
        console.log(`🔄 Claude 3.5 overloaded/unavailable, waiting ${waitTime}ms before retry ${attempt + 1}...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // For rate limiting, wait longer
      if (error.status === 429 && attempt < maxRetries) {
        const waitTime = 30000; // 30 seconds for rate limits
        console.log(`⏳ Claude 3.5 rate limited, waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // For other errors, shorter wait
      if (attempt < maxRetries) {
        const waitTime = 2000;
        console.log(`🔄 Retrying Claude 3.5 in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
    }
  }
  
  console.error(`❌ Claude 3.5: All ${maxRetries} attempts failed. Last error:`, lastError?.message || 'Unknown error');
  return '';
}

// Claude 3.7 Sonnet client with web search capabilities (for expensive web search operations)
async function callClaude37WithWebSearch(prompt: string): Promise<string> {
  const maxRetries = 5;
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await claude.messages.create({
        model: 'claude-3-7-sonnet-20250219', // Claude 3.7 required for web search
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 3
          }
        ]
      });

      // Handle different response types (text vs tool use)
      console.log(`🔍 Claude 3.7 response structure:`, JSON.stringify(response.content.map(c => ({ type: c.type })), null, 2));
      
      // Collect ALL text content blocks (Claude puts final answer in later blocks after searches)
      const allTextBlocks = response.content
        .filter(content => content.type === 'text')
        .map(content => content.text)
        .filter(text => text && text.trim());
      
      console.log(`📄 Claude 3.7: Found ${allTextBlocks.length} text blocks`);
      
      // Try to find the final answer in the LAST text blocks (after searches complete)
      // Skip initial "I'll search..." blocks and look for actual content
      const meaningfulBlocks = allTextBlocks.filter(block => 
        !block.toLowerCase().includes("i'll search") && 
        !block.toLowerCase().includes("let me search") &&
        !block.toLowerCase().includes("let me do that search") &&
        block.length > 50
      );
      
      const result = meaningfulBlocks.length > 0 
        ? meaningfulBlocks.join('\n\n') 
        : allTextBlocks.join('\n\n');
      
      if (result.trim()) {
        console.log(`✅ Claude 3.7: Success on attempt ${attempt}`);
        return result;
      } else {
        console.log(`⚠️ Claude 3.7: Empty text response on attempt ${attempt}`);
        lastError = new Error('Empty response');
      }
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Claude 3.7 API attempt ${attempt}/${maxRetries} failed:`, error.status || error.message);
      
      // Enhanced retry logic for different error types
      if ((error.status === 529 || error.status === 503 || error.status === 502) && attempt < maxRetries) {
        const waitTime = Math.min(attempt * 3000, 15000);
        console.log(`🔄 Claude 3.7 overloaded/unavailable, waiting ${waitTime}ms before retry ${attempt + 1}...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // For rate limiting, wait longer
      if (error.status === 429 && attempt < maxRetries) {
        const waitTime = 30000;
        console.log(`⏳ Claude 3.7 rate limited, waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // For other errors, shorter wait
      if (attempt < maxRetries) {
        const waitTime = 2000;
        console.log(`🔄 Retrying Claude 3.7 in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
    }
  }
  
  console.error(`❌ Claude 3.7: All ${maxRetries} attempts failed. Last error:`, lastError?.message || 'Unknown error');
  return '';
}

// NEW: Two-stage approach - Claude 3.7 gathers info, Claude 3.5 tells the story
export async function generateCompleteStoryWithClaude(artistName: string, trackName: string): Promise<string[]> {
  console.log(`🎯 Two-stage Claude: Gathering info about "${trackName}" by ${artistName}`);
  
  try {
    // STAGE 1: Claude 3.7 with web search gathers raw information
    const researchPrompt = `Search for information about the song "${trackName}" by ${artistName}. Provide raw facts and details including:
- Background story or inspiration behind the song
- Chart performance and commercial success
- Cultural impact or interesting trivia  
- Musical analysis or notable production elements
- Any unique or fascinating details about this specific track

Return factual information only, no conversational formatting.`;

    console.log(`🔍 Stage 1: Claude 3.7 gathering raw information...`);
    const rawInfo = await callClaude37WithWebSearch(researchPrompt);
    
    // ENHANCED LOGGING: Show full Claude 3.7 response
    console.log(`\n=== CLAUDE 3.7 FULL RESPONSE ===`);
    console.log(rawInfo);
    console.log(`=== END CLAUDE 3.7 RESPONSE ===\n`);
    
    if (!rawInfo || rawInfo.trim().length < 100) {
      console.log('❌ Stage 1: Insufficient information gathered, using fallback');
      return createFallbackNarrative(trackName, artistName, []);
    }

    console.log(`✅ Stage 1: Gathered ${rawInfo.length} characters of information`);

    // STAGE 2: Claude 3.5 creates detailed story content that can be broken into snippets
    const storyPrompt = `You're a knowledgeable music friend sharing fascinating details about "${trackName}" by ${artistName}. 

Here's the information I found:
${rawInfo}

Create a detailed, engaging story about this track that can be delivered in small pieces throughout the song. Write 6-8 short, conversational insights that build on each other. Each should:
- Be under 140 characters
- Feel natural and engaging
- Focus on different aspects (musical, cultural, personal, technical)
- Make me appreciate what I'm hearing right now

Format each insight starting with "SNIPPET:" on separate lines.

Example:
SNIPPET: "Aloha!" was composed specifically to contrast the dark themes of White Lotus
SNIPPET: Tapia De Veer used unconventional high-pitched vocals to create unease
SNIPPET: The danceable beat ironically masks the show's exploration of privilege
SNIPPET: The track became a viral sensation on TikTok despite its dark context
SNIPPET: Critics praised how it subverts expectations of tropical music
SNIPPET: The composer drew inspiration from 1960s lounge music
SNIPPET: Each listen reveals new layers of musical irony and social commentary`;

    console.log(`✍️ Stage 2: Claude 3.5 creating detailed story content...`);
    const storyResponse = await callClaude35(storyPrompt);
    
    // ENHANCED LOGGING: Show full Claude 3.5 response
    console.log(`\n=== CLAUDE 3.5 FULL RESPONSE ===`);
    console.log(storyResponse);
    console.log(`=== END CLAUDE 3.5 RESPONSE ===\n`);
    
    if (!storyResponse) {
      console.log('❌ Stage 2: No story response, using fallback');
      return createFallbackNarrative(trackName, artistName, []);
    }

    // Extract SNIPPET messages from Claude 3.5's response
    const snippets = storyResponse
      .split('\n')
      .filter(line => line.trim().startsWith('SNIPPET:'))
      .map(line => line.replace('SNIPPET:', '').trim())
      .filter(msg => msg.length > 15 && msg.length < 160);

    if (snippets.length > 0) {
      console.log(`✅ Two-stage success: Generated ${snippets.length} story snippets for gradual delivery`);
      return snippets; // Return all snippets, not just first 3
    } else {
      // Extract meaningful sentences if SNIPPET format didn't work
      const sentences = storyResponse
        .split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 25 && s.length < 160 && 
                     !s.toLowerCase().includes("here are") &&
                     !s.toLowerCase().includes("based on"))
        .slice(0, 8); // Get up to 8 sentences for snippet delivery
      
      if (sentences.length > 0) {
        console.log(`✅ Two-stage: Extracted ${sentences.length} meaningful sentences for gradual delivery`);
        return sentences;
      }
      
      console.log('❌ Two-stage: Could not extract usable content, using fallback');
      return createFallbackNarrative(trackName, artistName, []);
    }
    
  } catch (error) {
    console.error('❌ Two-stage Claude error:', error);
    return createFallbackNarrative(trackName, artistName, []);
  }
}

// NEW: Alternative function using Claude 3.5 for simple narrative generation (no web search)
export async function generateSimpleStoryWithClaude35(artistName: string, trackName: string): Promise<string[]> {
  console.log(`🎯 Claude 3.5: Generating simple story (no web search) for "${trackName}" by ${artistName}`);
  
  const prompt = `Create 6-8 short, conversational insights about "${trackName}" by ${artistName} that can be delivered throughout the song duration.

Each insight should:
- Be under 140 characters
- Build understanding of the music
- Feel natural and engaging
- Cover different aspects (musical, cultural, emotional)

Format each insight starting with "SNIPPET:" on separate lines.

Example:
SNIPPET: "Madre Sol" translates to "Mother Sun" - this is music that honors the life-giving force
SNIPPET: You can feel the warmth and reverence in how the melody unfolds
SNIPPET: The rhythms carry stories passed down through generations
SNIPPET: Notice how the percussion creates a heartbeat-like foundation
SNIPPET: The vocals soar like morning light breaking over the horizon
SNIPPET: This style connects to Colombia's Caribbean coastal traditions

Now create flowing insights for "${trackName}" by ${artistName}:`;

  try {
    const response = await callClaude35(prompt);
    
    // ENHANCED LOGGING: Show full Claude 3.5 simple response
    console.log(`\n=== CLAUDE 3.5 SIMPLE MODE FULL RESPONSE ===`);
    console.log(response);
    console.log(`=== END CLAUDE 3.5 SIMPLE RESPONSE ===\n`);
    
    if (!response) {
      console.log('❌ Claude 3.5: No response received, using fallback');
      return createFallbackNarrative(trackName, artistName, []);
    }

    // Extract snippet messages from Claude's response
    const snippets = response
      .split('\n')
      .filter(line => line.trim().startsWith('SNIPPET:'))
      .map(line => line.replace('SNIPPET:', '').trim())
      .filter(msg => msg.length > 15 && msg.length < 160);

    if (snippets.length > 0) {
      console.log(`✅ Claude 3.5: Generated ${snippets.length} story snippets for gradual delivery`);
      return snippets; // Return all snippets for gradual delivery
    } else {
      // Extract meaningful sentences if SNIPPET format didn't work
      const sentences = response
        .split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 25 && s.length < 160)
        .slice(0, 8); // Get up to 8 sentences
      
      if (sentences.length > 0) {
        console.log(`✅ Claude 3.5: Extracted ${sentences.length} simple story snippets for gradual delivery`);
        return sentences;
      }
      
      console.log('❌ Claude 3.5: No valid snippets extracted, using fallback');
      return createFallbackNarrative(trackName, artistName, []);
    }
    
  } catch (error) {
    console.error('❌ Claude 3.5: Error generating simple story:', error);
    return createFallbackNarrative(trackName, artistName, []);
  }
}

// Enhanced fallback narrative when Claude is unavailable
function createFallbackNarrative(trackName: string, artistName: string, insights: string[]): string[] {
  const narrative: string[] = [];
  
  // Use available insights if any
  if (insights.length > 0) {
    // Transform insights into flowing narrative
    const firstInsight = insights[0];
    narrative.push(firstInsight);
    
    if (insights.length > 1) {
      const secondInsight = insights[1];
      narrative.push(`You can feel this in ${secondInsight.toLowerCase()}`);
    }
    
    if (insights.length > 2) {
      const thirdInsight = insights[2];
      narrative.push(`Notice how ${thirdInsight.toLowerCase()}`);
    }
  } else {
    // Create contextual narrative based on track and artist names
    const trackLower = trackName.toLowerCase();
    const artistLower = artistName.toLowerCase();
    
    if (trackLower.includes('colombia') || trackLower.includes('panamá')) {
      narrative.push(`"${trackName}" is a musical journey through Colombian heritage`);
      narrative.push(`The rhythms carry stories of the Caribbean coast`);
      narrative.push(`Each beat connects to generations of musical tradition`);
    } else if (trackLower.includes('antonio') || trackLower.includes('santo')) {
      narrative.push(`"${trackName}" invokes the spiritual heart of Colombian folk music`);
      narrative.push(`You can hear the reverence in every note`);
      narrative.push(`This is music that bridges the sacred and the everyday`);
    } else if (artistLower.includes('bulla')) {
      narrative.push(`"${trackName}" showcases the authentic bullerengue tradition`);
      narrative.push(`The drums speak the language of Colombia's Caribbean coast`);
      narrative.push(`Each rhythm tells a story passed down through generations`);
    } else {
      narrative.push(`"${trackName}" reveals ${artistName}'s unique musical vision`);
      narrative.push(`The composition unfolds like a carefully crafted story`);
      narrative.push(`Every element serves the deeper emotional journey`);
    }
  }
  
  console.log(`🔄 Created ${narrative.length} fallback narrative messages`);
  return narrative.slice(0, 6); // Return up to 6 fallback snippets
} 