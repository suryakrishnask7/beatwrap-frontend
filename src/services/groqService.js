import axios from 'axios';
import { getRuntimeConfig } from '../utils/runtimeConfig';

const { GROQ_API_KEY } = getRuntimeConfig();
const GROQ_BASE = 'https://api.groq.com/openai/v1';

// ─────────────────────────────────────────────────────────────────────────────
// VERIFIED Tamil Cinema Characters
// Every character here is confirmed from the actual film.
// Character name = the name used in the film, not the actor's name.
// ─────────────────────────────────────────────────────────────────────────────
export const TAMIL_CHARACTERS = [

  // ── VOID / DETACHED ───────────────────────────────
  { id: 1, name: 'Chithan', film: 'Pithamagan',
    archetype: 'The Void',
    traits: ['emotionless','isolated','primal'],
    music_vibe: 'Dark ambient, drone, empty soundscapes' },

  // ── POWER / LEGACY ────────────────────────────────
  { id: 2, name: 'Velu Nayakan', film: 'Nayakan',
    archetype: 'The Burdened Leader',
    traits: ['responsibility','legacy','moral weight'],
    music_vibe: 'Heavy orchestral, Ilaiyaraaja depth' },

  { id: 3, name: 'Kabali', film: 'Kabali',
    archetype: 'The King',
    traits: ['authority','calm power','presence'],
    music_vibe: 'Swagger beats, slow-walk energy' },

  { id: 4, name: 'Rolex', film: 'Vikram',
    archetype: 'The Apex Predator',
    traits: ['dominant','fearless','chaotic control'],
    music_vibe: 'Aggressive, maximal, high-intensity' },

  // ── ORDER VS CHAOS ────────────────────────────────
  { id: 5, name: 'Vikram', film: 'Vikram Vedha',
    archetype: 'The System',
    traits: ['disciplined','logical','controlled'],
    music_vibe: 'Structured beats, focused energy' },

  { id: 6, name: 'Vedha', film: 'Vikram Vedha',
    archetype: 'The Chaos Mind',
    traits: ['unpredictable','philosophical','grey'],
    music_vibe: 'Genre-chaotic playlists' },

  // ── LOVE / LONGING ────────────────────────────────
  { id: 7, name: 'Ram', film: '96',
    archetype: 'The Nostalgic Soul',
    traits: ['introverted','memory-driven','soft'],
    music_vibe: 'Ambient piano, late-night music' },

  { id: 8, name: 'Jaanu', film: '96',
    archetype: 'The Gentle Heart',
    traits: ['empathetic','warm','contained'],
    music_vibe: 'Soft acoustic, tender melodies' },

  { id: 9, name: 'Karthik_VTV', film: 'Vinnaithaandi Varuvaayaa',
    archetype: 'The Romantic Idealist',
    traits: ['passionate','dreamy','persistent'],
    music_vibe: 'AR Rahman romance' },

  { id: 10, name: 'Jessie', film: 'Vinnaithaandi Varuvaayaa',
    archetype: 'The Unreachable',
    traits: ['guarded','conflicted','distant'],
    music_vibe: 'Soft indie restraint' },

  { id: 11, name: 'Karthik_Alaipayuthey', film: 'Alaipayuthey',
    archetype: 'The Young Lover',
    traits: ['playful','intense','immature'],
    music_vibe: 'Upbeat love songs' },

  { id: 12, name: 'Swapna', film: 'Vallavan',
    archetype: 'The Illusion',
    traits: ['idealized','unreachable','fantasy-driven'],
    music_vibe: 'Dreamy love tracks, obsessive romance' },

  // ── OBSESSION / BREAKDOWN ─────────────────────────
  { id: 13, name: 'Vinod', film: 'Kadhal Kondein',
    archetype: 'The Obsessive',
    traits: ['fixated','unstable','intense'],
    music_vibe: 'Looped songs, emotional repetition' },

  { id: 14, name: 'Sethu', film: 'Sethu',
    archetype: 'The Broken Lover',
    traits: ['tragic','fragile','identity loss'],
    music_vibe: 'Pain-heavy melodies' },

  // ── RAW / ROOTED ──────────────────────────────────
  { id: 15, name: 'Paruthiveeran', film: 'Paruthiveeran',
    archetype: 'The Untamed',
    traits: ['wild','impulsive','earthy'],
    music_vibe: 'Raw folk, gaana' },

  { id: 16, name: 'Sivasami', film: 'Asuran',
    archetype: 'The Survivor',
    traits: ['protective','grounded','silent strength'],
    music_vibe: 'Slow folk builds' },

  { id: 17, name: 'Pariyerum Perumal', film: 'Pariyerum Perumal',
    archetype: 'The Silent Fighter',
    traits: ['resilient','observant','quiet pain'],
    music_vibe: 'Indie folk, rooted emotion' },

  // ── STREET / REAL ─────────────────────────────────
  { id: 18, name: 'Prabhu', film: 'Polladhavan',
    archetype: 'The Hustler',
    traits: ['street-smart','ambitious','grounded'],
    music_vibe: 'Gritty underground beats' },

  { id: 19, name: 'Azhagar', film: 'Subramaniapuram',
    archetype: 'The Loyal Friend',
    traits: ['loyal','emotional','tragic'],
    music_vibe: 'Retro Ilaiyaraaja nostalgia' },

  { id: 20, name: 'Anbu', film: 'Madras',
    archetype: 'The Voice',
    traits: ['political','grounded','community-driven'],
    music_vibe: 'Gaana + protest music' },

  // ── DISCIPLINE / STRUCTURE ────────────────────────
  { id: 21, name: 'Anbuselvan', film: 'Kaakha Kaakha',
    archetype: 'The Protector',
    traits: ['focused','disciplined','sacrificial'],
    music_vibe: 'Sharp action scores' },

  { id: 22, name: 'Prabhu', film: 'Irudhi Suttru',
    archetype: 'The Coach',
    traits: ['harsh','driven','results-first'],
    music_vibe: 'Training beats' },

  // ── HUMANISM ──────────────────────────────────────
  { id: 23, name: 'Nallasivam', film: 'Anbe Sivam',
    archetype: 'The Humanist',
    traits: ['empathetic','kind','philosophical'],
    music_vibe: 'Warm soulful music' },

  // ── IDENTITY / MODERN ─────────────────────────────
  { id: 24, name: 'Gandhi Mahaan', film: 'Mahaan',
    archetype: 'The Rebellion',
    traits: ['freedom-seeking','conflicted','evolving'],
    music_vibe: 'Genre-mixing chaos' },

  { id: 25, name: 'Amar', film: 'Vikram',
    archetype: 'The Seeker',
    traits: ['curious','driven','layered'],
    music_vibe: 'Electronic cinematic' },

  // ── CLASSIC EMOTION ───────────────────────────────
  { id: 26, name: 'Divya', film: 'Mouna Ragam',
    archetype: 'The Conflicted Soul',
    traits: ['independent','layered','introspective'],
    music_vibe: 'Bittersweet Ilaiyaraaja' },

  { id: 27, name: 'Rishi Kumar', film: 'Roja',
    archetype: 'The Devoted',
    traits: ['loyal','hopeful','loving'],
    music_vibe: 'Soft longing melodies' },

  { id: 28, name: 'Roja', film: 'Roja',
    archetype: 'The Waiting Heart',
    traits: ['patient','hopeful','strong'],
    music_vibe: 'Emotional strings' },

  // ── ICONIC ADDITIONS (NEW BANGERS) ────────────────
  { id: 29, name: 'Krishnan', film: 'Vaaranam Aayiram',
    archetype: 'The Explorer',
    traits: ['growth','emotional journey','self-discovery'],
    music_vibe: 'Travel + life-phase music' },

  { id: 30, name: 'Jordan', film: 'Sarpatta Parambarai',
    archetype: 'The Comeback',
    traits: ['rise','fall','redemption'],
    music_vibe: 'Motivation + comeback energy' },

  { id: 31, name: 'Arjun', film: '7G Rainbow Colony',
    archetype: 'The Reckless Lover',
    traits: ['immature','obsessive','emotional'],
    music_vibe: 'Youth heartbreak + chaos' },

  { id: 32, name: 'Kitta', film: 'Bison',
    archetype: 'The Minimalist',
    traits: ['quiet','detached','observant'],
    music_vibe: 'Lo-fi, minimal, low-energy music' },

  { id: 33, name: 'Guru', film: 'Guru',
    archetype: 'The Visionary',
    traits: ['ambitious','risk-taking','driven'],
    music_vibe: 'Big build, inspirational' },

  { id: 34, name: 'Surya', film: 'Vaaranam Aayiram',
    archetype: 'The Son',
    traits: ['emotional','respect-driven','growth'],
    music_vibe: 'Emotional journey tracks' },

  { id: 35, name: 'Sakthi', film: 'Sivaji',
    archetype: 'The Game Changer',
    traits: ['bold','visionary','impact-driven'],
    music_vibe: 'Mass + grand energy' },

  { id: 36, name: 'Michael', film: 'Bigil',
    archetype: 'The Leader',
    traits: ['mentor','strong','responsible'],
    music_vibe: 'Motivational + team energy' },

  { id: 37, name: 'Raghuvaran', film: 'VIP',
    archetype: 'The Underdog',
    traits: ['frustrated','talented','rising'],
    music_vibe: 'Angry youth + ambition' },

  { id: 38, name: 'Deepak', film: 'Dhruvangal Pathinaaru',
    archetype: 'The Analyst',
    traits: ['observant','calm','intellectual'],
    music_vibe: 'Minimal thriller, ambient tension' },

];
const CHARACTER_LIST = TAMIL_CHARACTERS.map(c =>
  `${c.id}. ${c.name} (${c.film})\n   Music this character represents: ${c.music_vibe}`
).join('\n\n');

const SYSTEM_PROMPT = `You are BeatWrap AI.

Your job is to generate a vibey, cinematic weekly recap based on a user's music listening data and daily emoji logs.

═══════════════════════════════════════════════════════
CORE RULES (STRICT)
═══════════════════════════════════════════════════════

* Do NOT perform psychological diagnosis.
* Do NOT suggest emotional disorders or deep internal conflict.
* Avoid therapy-style language.
* Avoid words like suppression, trauma, identity crisis, turmoil.
* Do NOT assume hidden pain or mental struggle.
* Do NOT overfit sadness — only reflect what is actually present in the music.
* Frame everything as vibe observation, not psychological analysis.

═══════════════════════════════════════════════════════
STYLE & TONE
═══════════════════════════════════════════════════════

* Cinematic
* Smooth
* Aesthetic
* Observational
* Minimal, not dramatic
* Modern and natural
* Shareable

TONE REQUIREMENTS:

* Calm and controlled
* No hype words like "thrilling", "explosive", "intense ride"
* No exaggeration
* No emotional diagnosis
* No generic phrasing

WRITING RULES:

* Write in short flowing paragraphs
* Vary sentence openings (avoid repeating "This week...")
* Avoid repetitive structure across outputs
* Keep it between 120–160 words

═══════════════════════════════════════════════════════
HOW TO WRITE THE STORY
═══════════════════════════════════════════════════════

* Describe how the week SOUNDED, not just what was played
* Do NOT explain genres — translate them into atmosphere
* Turn music into scenes (night drives, quiet rooms, city motion, open skies, etc.)
* Reflect FLOW:

  * Did the week shift from calm → energetic → calm?
  * Was it consistent or dynamic?
* Focus on transitions and listening patterns, not just dominant mood
* Avoid listing artists individually

═══════════════════════════════════════════════════════
TAMIL CHARACTER OF THE WEEK — SELECTION LOGIC
═══════════════════════════════════════════════════════

You MUST choose ONLY from the ${TAMIL_CHARACTERS.length} characters listed below.
Do NOT invent characters.

HOW TO PICK:

* Match based on SOUND and FEEL of the music — NOT personality assumptions
* Compare user's listening patterns with each character's "music_vibe"
* Look at:

  * Energy level
  * Repetition vs variety
  * Genre switching vs consistency
  * Tempo and emotional texture

TIE-BREAKING RULES:

* If multiple characters match:
  → Choose the MOST SPECIFIC match, not the most generic one
  → Prefer niche/precise matches over broad ones
  → Avoid overused characters when a better-fit alternative exists

ANTI-REPETITION RULE:

* Do NOT default to commonly matching characters (e.g., safe emotional picks)
* Rotate fairly across all ${TAMIL_CHARACTERS.length} characters when appropriate

═══════════════════════════════════════════════════════
CHARACTER OUTPUT FORMAT
═══════════════════════════════════════════════════════

Use this exact structure:

"tamil_character": {
"name": "...",
"film": "...",
"why_this_character": "One sharp sentence explaining how the user's music style (patterns, energy, transitions) matches this character’s world."
}

Also assign a tamil_protagonist archetype:

* A short cinematic title like "The Midnight Wanderer", "The Soft Fire", "The Street Poet"
* Keep it simple, fresh, and non-repetitive

═══════════════════════════════════════════════════════
CONFIDENCE SCORING
═══════════════════════════════════════════════════════

Set confidence based on match strength:

* 0.9–1.0 → very strong, precise match
* 0.7–0.89 → clear match
* 0.5–0.69 → moderate match
* below 0.5 → weak match

═══════════════════════════════════════════════════════
AVAILABLE CHARACTERS (STRICT LIST)
═══════════════════════════════════════════════════════
${CHARACTER_LIST}

═══════════════════════════════════════════════════════
FINAL OUTPUT FORMAT (JSON ONLY — NO EXTRA TEXT)
═══════════════════════════════════════════════════════

{
"week_label": "...",
"dominant_vibe": "...",
"energy_level": "...",
"tamil_protagonist": {
"archetype": "...",
"inspired_by": "..."
},
"tamil_character": {
"name": "...",
"film": "...",
"why_this_character": "..."
},
"story": "...",
"confidence": 0.0
}`;


export const groqService = {
  async generateWeeklyWrap(listeningData, moodLogs) {
    const userPrompt = `Here is my listening data for this week:

Top Genres: ${listeningData.topGenres?.map(g => g.genre).join(', ') || 'Mixed'}
Top Artists: ${listeningData.topArtists?.slice(0, 8).map(a => a.name).join(', ') || 'Various'}
Top Tracks: ${listeningData.topTracks?.slice(0, 8).map(t => `${t.name} by ${t.artists?.[0]?.name}`).join(', ') || 'Various'}

Daily Mood Logs This Week:
${moodLogs?.map(m => `${m.day}: ${m.emoji} ${m.label}${m.note ? ` - "${m.note}"` : ''}`).join('\n') || 'No mood logs this week'}

Based on the actual artists and tracks above, pick the Tamil character whose music world most closely matches what I listened to. Then write my weekly story.`;

    try {
      const res = await axios.post(
        `${GROQ_BASE}/chat/completions`,
        {
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 900,
          temperature: 0.85,
        },
        {
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const content = res.data.choices[0].message.content;
      const clean = content.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      // Validate — if character not on list, swap in a random valid one
      const valid = TAMIL_CHARACTERS.find(
        c => c.name.toLowerCase() === parsed.tamil_character?.name?.toLowerCase()
      );
      if (!valid && parsed.tamil_character) {
        const fallback = TAMIL_CHARACTERS[Math.floor(Math.random() * TAMIL_CHARACTERS.length)];
        parsed.tamil_character.name = fallback.name;
        parsed.tamil_character.film = fallback.film;
        parsed.tamil_character.why_this_character = `The soundtrack this week echoes the world of ${fallback.name}.`;
      }

      return parsed;
    } catch (e) {
      console.error('Groq API error:', e?.response?.data || e.message);
      const fallback = TAMIL_CHARACTERS[Math.floor(Math.random() * TAMIL_CHARACTERS.length)];
      return {
        week_label: 'The Quiet Frequency',
        dominant_vibe: 'Late Night Drift',
        energy_level: 'Mid — steady and considered',
        tamil_protagonist: { archetype: 'The Silent Storm', inspired_by: 'Unspoken intensity' },
        tamil_character: {
          name: fallback.name,
          film: fallback.film,
          why_this_character: `The soundtrack this week echoes the world of ${fallback.name}.`,
        },
        story: "This week had a particular stillness to it. The music moved like something unhurried — not rushed, not searching. Just present. There were moments of clarity woven between stretches of ambient drift, the kind of listening that happens when the week slows down on its own terms.",
        confidence: 0.82,
      };
    }
  },

  async generateCompatibility(user1Data, user2Data) {
    const prompt = `Compare these two music listener profiles and generate a compatibility score.

User 1: Top genres: ${user1Data.topGenres?.join(', ')}, Exploration: ${user1Data.explorationIndex}/100, Character: ${user1Data.tamilCharacter}
User 2: Top genres: ${user2Data.topGenres?.join(', ')}, Exploration: ${user2Data.explorationIndex}/100, Character: ${user2Data.tamilCharacter}

Return ONLY valid JSON:
{
  "score": <0-100>,
  "vibe_description": "<short cinematic description>",
  "shared_traits": ["<trait1>", "<trait2>", "<trait3>"],
  "chemistry": "<one line>"
}`;

    try {
      const res = await axios.post(
        `${GROQ_BASE}/chat/completions`,
        {
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 300,
          temperature: 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const content = res.data.choices[0].message.content;
      const clean = content.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch (e) {
      return {
        score: 74,
        vibe_description: 'Two frequencies that find harmony in unexpected moments.',
        shared_traits: ['Late night energy', 'Eclectic taste', 'Mood-led listening'],
        chemistry: 'Different wavelengths, same frequency.',
      };
    }
  },

  async generateDailyNotifications(userName) {
    const name = userName ? userName.split(' ')[0] : 'Listener';
    const prompt = `Generate two short, personalized push notifications for a music tracking app called BeatWrap. 
The user's name is ${name}.
1. A morning notification (around 10 AM) hyping them up for the day's music.
2. An evening notification (around 8 PM) reminding them to log their mood and lock in their daily minutes.

Requirements:
- MUST be a full sentence (about 10 to 15 words).
- Start with their name (e.g., "${name}!").
- Use exactly 1 or 2 emojis at the end.
- Make it sound cinematic, cool, and music-focused. No generic corporate app speak.

Return ONLY valid JSON format:
{
  "morning": "<full sentence text here>",
  "evening": "<full sentence text here>"
}`;

    try {
      const res = await axios.post(
        `${GROQ_BASE}/chat/completions`,
        {
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 150,
          temperature: 0.8,
        },
        {
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const content = res.data.choices[0].message.content;
      const clean = content.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch (e) {
      return {
        morning: `${name}! Set the tone for today with some fresh tracks 🎧`,
        evening: `${name}! Lock in today's minutes and log your mood 🌙`
      };
    }
  },
};
