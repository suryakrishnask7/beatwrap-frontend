import axios from 'axios';
import Constants from 'expo-constants';

const GROQ_API_KEY = Constants.expoConfig?.extra?.GROQ_API_KEY || 'YOUR_GROQ_API_KEY';
const GROQ_BASE = 'https://api.groq.com/openai/v1';

// ─────────────────────────────────────────────────────────────────────────────
// 50 Tamil Cinema Characters
// Each character has music_vibe — the kind of soundtrack/genre/mood they
// represent. Groq selects PURELY based on what the user listened to this week.
// ─────────────────────────────────────────────────────────────────────────────
export const TAMIL_CHARACTERS = [

  // ── Male Characters ──────────────────────────────────────────────────────

  { id: 1,
    name: 'Anbu',
    film: 'Virumaandi',
    music_vibe: 'Heavy percussion, raw folk-fusion, songs that feel like a fight — music that punches first and asks questions later.' },

  { id: 2,
    name: 'Pithamagan',
    film: 'Pithamagan',
    music_vibe: 'Dark ambient, sparse instrumentals, drone-like loops, music with no lyrics — soundscapes that feel empty and endless.' },

  { id: 3,
    name: 'Subramani',
    film: 'Paruthiveeran',
    music_vibe: 'Raw village folk, nadaswaram, unpolished recordings, music that smells like red soil — no studio shine.' },

  { id: 4,
    name: 'Boopathy',
    film: 'Thiruvilayadal Arasan',
    music_vibe: 'Mass masala beats, high-BPM dance tracks, loud bass, item numbers — fun music made for crowds not headphones.' },

  { id: 5,
    name: 'Velu Nayakan',
    film: 'Nayakan',
    music_vibe: 'Slow orchestral builds, Ilaiyaraaja-style emotional swell, music that carries the weight of an entire life story.' },

  { id: 6,
    name: 'Raghavan',
    film: 'Vikram Vedha',
    music_vibe: 'Noir jazz undertones, slow-burning hip-hop, music that plays while staring at a ceiling at 2am — calculated and cool.' },

  { id: 7,
    name: 'Vikram',
    film: 'Mahaan',
    music_vibe: 'Genre-blending playlists — classical one moment, trap the next. Music that cannot be pinned down to one decade or mood.' },

  { id: 8,
    name: 'Muthu',
    film: 'Muthu',
    music_vibe: 'Classic Rajinikanth-era hits, retro Tamil film songs, old-school dance numbers — pure nostalgic cinema music.' },

  { id: 9,
    name: 'Selvaraghavan',
    film: 'Kadhal Kondein',
    music_vibe: 'One artist played on repeat for days. Obsessive deep-dives into a single album. The same 3 songs again and again.' },

  { id: 10,
    name: 'Dhanush',
    film: 'Polladhavan',
    music_vibe: 'Street rap, gully beats, Tamil hip-hop, lo-fi underground — music that sounds like it was recorded in a garage at midnight.' },

  { id: 11,
    name: 'Aadhi',
    film: 'Aadhi',
    music_vibe: 'Back-to-back bangers, gym playlist energy, high-BPM tracks that never let you sit still — music as pure adrenaline.' },

  { id: 12,
    name: 'Surya',
    film: 'Kaakha Kaakha',
    music_vibe: 'Driving rock, AR Rahman action scores, music that sounds like running full speed — sharp, athletic, no filler.' },

  { id: 13,
    name: 'Arul',
    film: 'Arul',
    music_vibe: 'Comfortable mid-tempo pop, familiar Tamil film hits, nothing too intense — music for a regular Tuesday.' },

  { id: 14,
    name: 'Sanjay',
    film: 'Ghajini',
    music_vibe: 'Same playlist every single day. High-repeat tracks. Music treated like a ritual — the same songs in the same order.' },

  { id: 15,
    name: 'Sakthi',
    film: 'Roja',
    music_vibe: 'Soft romantic melodies, AR Rahman at his most tender, music that sounds like missing someone from far away.' },

  { id: 16,
    name: 'Krishnamurthy',
    film: 'Subramaniapuram',
    music_vibe: '90s Tamil film OSTs, slow ballads from a past decade, music that feels like a memory you can almost touch.' },

  { id: 17,
    name: 'Ram',
    film: '96',
    music_vibe: 'Ambient instrumentals, Govind Vasantha-style piano, soft indie — music you listen to alone with the lights off.' },

  { id: 18,
    name: 'Michael',
    film: 'Vikram',
    music_vibe: 'Layered electronic scores, dark orchestral pieces, music that sounds like it has a secret — complex and cinematic.' },

  { id: 19,
    name: 'Vedha',
    film: 'Vikram Vedha',
    music_vibe: 'Completely unpredictable playlist — hip-hop followed by classical followed by metal. No pattern. All instinct.' },

  { id: 20,
    name: 'Kaasi',
    film: 'Kaasi',
    music_vibe: 'Traditional instruments, temple beats, Carnatic-influenced film songs — music rooted deep in Tamil soil.' },

  { id: 21,
    name: 'Pandiya',
    film: 'Saamy',
    music_vibe: 'Bass-heavy action tracks, Vidyasagar-style punchy BGMs, music that sounds like walking into a room and owning it.' },

  { id: 22,
    name: 'Rolex',
    film: 'Vikram',
    music_vibe: 'Maximalist playlists — too many genres, too many moods, too many artists. Everything turned up. Nothing filtered out.' },

  { id: 23,
    name: 'Nelson',
    film: 'Dhruvangal Pathinaaru',
    music_vibe: 'Minimal thriller scores, silence used as music, ambient tension — soundtracks that never quite resolve.' },

  { id: 24,
    name: 'Karthik',
    film: 'Vinnaithaandi Varuvaayaa',
    music_vibe: 'AR Rahman at his most romantic, lush guitar melodies, music that sounds like falling in love slowly.' },

  { id: 25,
    name: 'Selvam',
    film: 'Asuran',
    music_vibe: 'Slow folk builds, G.V. Prakash raw compositions, music that starts quiet and becomes overwhelming by the end.' },

  // ── Female Characters ─────────────────────────────────────────────────────

  { id: 26,
    name: 'Jessie',
    film: 'Vinnaithaandi Varuvaayaa',
    music_vibe: 'Soft indie pop, acoustic guitar, songs that feel like standing at a window watching rain — beautiful but restrained.' },

  { id: 27,
    name: 'Jothi',
    film: 'Karuthamma',
    music_vibe: 'Sea-shanty folk, coastal Tamil songs, music that sounds like it was carried by the wind from a fishing village.' },

  { id: 28,
    name: 'Mayil',
    film: 'Mynaa',
    music_vibe: 'Cheerful indie, bright Tamil pop, music that sounds like running through a field — light, carefree, full of colour.' },

  { id: 29,
    name: 'Meera',
    film: 'Mouna Ragam',
    music_vibe: 'Layered emotional tracks, Ilaiyaraaja compositions, music that refuses to be simple — bittersweet and complex.' },

  { id: 30,
    name: 'Bhavani',
    film: 'Irudhi Suttru',
    music_vibe: 'Workout beats, driven Tamil hip-hop, music with no time for sentimentality — focused and punishing.' },

  { id: 31,
    name: 'Keerthi',
    film: 'Alaipayuthey',
    music_vibe: 'Youthful Tamil pop, upbeat AR Rahman, music that sounds like the first week of being in love — fizzy and bright.' },

  { id: 32,
    name: 'Yamuna',
    film: 'Roja',
    music_vibe: 'Longing melodies, slow violin strings, AR Rahman at his most aching — music that sounds like waiting.' },

  { id: 33,
    name: 'Kavitha',
    film: 'Minnale',
    music_vibe: 'Light romantic tracks, Harris Jayaraj melodies, fun duets — music for a sunny afternoon drive.' },

  { id: 34,
    name: 'Kokila',
    film: 'Kolamaavu Kokila',
    music_vibe: 'Dark-comedy funk, unexpected genre switches, music that is soft on the surface but unsettling underneath.' },

  { id: 35,
    name: 'Shenbagam',
    film: 'Pariyerum Perumal',
    music_vibe: 'Indie Tamil folk, Santhosh Narayanan rawness, music that carries quiet pain without saying it out loud.' },

  { id: 36,
    name: 'Divya',
    film: 'Indira',
    music_vibe: 'Bold street music, fast-talking Tamil rap, mass songs with female energy — music that does not wait for permission.' },

  { id: 37,
    name: 'Abitha',
    film: 'Autograph',
    music_vibe: 'Nostalgic Tamil melodies, slow-burning film songs from the early 2000s — music that feels like flipping through old photos.' },

  { id: 38,
    name: 'Soniya',
    film: 'Rhythm',
    music_vibe: 'Soft atmospheric ballads, gentle piano melodies, music that sounds like falling asleep peacefully.' },

  { id: 39,
    name: 'Panimalar',
    film: 'Kaadhal',
    music_vibe: 'Simple, tender love songs, acoustic simplicity — music that does not need production to feel enormous.' },

  { id: 40,
    name: 'Nila',
    film: 'Ennai Arindhal',
    music_vibe: 'Intense romantic scores, Harris Jayaraj tension builds, music that feels like it is about to confess something.' },

  { id: 41,
    name: 'Priya',
    film: 'Kaadhal Desam',
    music_vibe: 'Late 90s Tamil pop, AR Rahman youth albums, music that sounds like college corridors and first crushes.' },

  { id: 42,
    name: 'Hemamalini',
    film: 'Anniyan',
    music_vibe: 'Dramatic orchestral swells, Harris Jayaraj grandeur, music that feels like every song is a climax.' },

  { id: 43,
    name: 'Thulasi',
    film: 'Pooveli',
    music_vibe: 'Village festival music, nadhaswaram, traditional Tamil celebration songs — music tied to the land.' },

  { id: 44,
    name: 'Raathri',
    film: 'Inaindha Kaigal',
    music_vibe: 'Late-night dark ambient, unsettling silence, music that sounds like 3am when you cannot sleep.' },

  { id: 45,
    name: 'Seetha',
    film: 'Mudhalvan',
    music_vibe: 'Balanced, feel-good Tamil pop, AR Rahman accessibility — music everyone in the room can agree on.' },

  // ── Ensemble / Unique ─────────────────────────────────────────────────────

  { id: 46,
    name: 'Shiva',
    film: 'Nanban',
    music_vibe: 'Party playlists, Tamil-Hindi crossover hits, music made for group settings — songs everyone knows the words to.' },

  { id: 47,
    name: 'Aarav',
    film: 'Ko',
    music_vibe: 'Fresh indie discoveries, new Tamil artists, music that feels like finding something before everyone else does.' },

  { id: 48,
    name: 'Murugesan',
    film: 'Pariyerum Perumal',
    music_vibe: 'Quietly emotional folk, music that says everything without shouting — a single instrument carrying enormous feeling.' },

  { id: 49,
    name: 'Prabhu',
    film: 'Kabali',
    music_vibe: 'Santhosh Narayanan swagger beats, slow-walk BGMs, music that sounds like arriving somewhere important.' },

  { id: 50,
    name: 'Durai',
    film: 'Dhool',
    music_vibe: 'Rustic action folk, Yuvan Shankar Raja early style, music that is rough around the edges but undeniably cool.' },
];

// Build the character list string injected into the prompt
const CHARACTER_LIST = TAMIL_CHARACTERS.map(c =>
  `${c.id}. ${c.name} (${c.film})\n   Music this character represents: ${c.music_vibe}`
).join('\n\n');

const SYSTEM_PROMPT = `You are BeatWrap AI.

Your job is to generate a vibey, cinematic weekly recap based on a user's music listening data and daily emoji logs.

IMPORTANT RULES:
- Do NOT perform psychological diagnosis.
- Do NOT suggest emotional disorders or deep internal conflict.
- Avoid therapy-style language.
- Avoid words like suppression, trauma, identity crisis, turmoil.
- Do NOT assume hidden pain or mental struggle.
- Frame everything as vibe observation, not psychological analysis.

STYLE:
- Cinematic
- Smooth
- Aesthetic
- Observational
- Short paragraphs
- Modern tone
- Shareable

TONE REQUIREMENTS:
- Calm and smooth
- Aesthetic and cinematic
- Minimal, not dramatic
- No hype words like "thrilling", "explosive", "intense ride"
- No psychological assumptions
- No emotional diagnosis
- No exaggeration

Avoid generic summaries like "a blend of X and Y".
Describe how the week felt as a soundtrack, not a genre report.
Do not explain the genres — describe the flow and atmosphere.
Write in short flowing paragraphs.
Make it feel like a late-night reflection.
Avoid listing artists individually.
Focus on how the week sounded overall.
Keep it between 120–160 words.

═══════════════════════════════════════════════════════
TAMIL CHARACTER OF THE WEEK — HOW TO CHOOSE
═══════════════════════════════════════════════════════

You MUST choose the Tamil Character of the Week from ONLY the list of 50 characters below.
Do NOT invent any character. Do NOT use any character not on this list.

HOW TO PICK:
- Read the user's top genres, top artists, and top tracks.
- Read each character's "Music this character represents" description.
- Find the character whose music description most closely matches what the user actually listened to this week.
- The match is purely about the SOUND and FEEL of the music — genres, mood, texture, tempo, vibe.
- Do NOT consider metrics like exploration score or replay count.
- Do NOT default to the same popular characters. Every character on the list is equally valid.
- Vary your picks — do not repeat obvious choices across similar weeks.
- If the user's top artists or genres sound like what a character's music description says, that is your match.

EXAMPLES OF HOW TO MATCH:
- User listened to lots of AR Rahman soft romantic songs → pick Karthik (VTV) or Yamuna (Roja) or Jessie (VTV)
- User listened to Tamil hip-hop and street rap → pick Dhanush (Polladhavan) or Divya (Indira)
- User listened to ambient piano and indie instrumentals → pick Ram (96) or Soniya (Rhythm) or Pithamagan
- User listened to loud action BGMs and mass songs → pick Aadhi, Pandiya, or Prabhu (Kabali)
- User listened to 90s Tamil film classics → pick Krishnamurthy (Subramaniapuram) or Abitha (Autograph)
- User listened to folk and village-style music → pick Subramani, Kaasi, Jothi, or Murugesan
- User listened to one artist on repeat → pick Selvaraghavan (Kadhal Kondein) or Sanjay (Ghajini)
- User listened to a chaotic mix of everything → pick Vedha (Vikram Vedha) or Rolex (Vikram) or Vikram (Mahaan)
- User listened to dark atmospheric music → pick Nelson (Dhruvangal Pathinaaru) or Raathri or Michael (Vikram)
- User listened to party/social music → pick Shiva (Nanban) or Boopathy (Thiruvilayadal Arasan)

THE 50 CHARACTERS (choose ONLY from this list):
${CHARACTER_LIST}

Use this exact structure:
"tamil_character": {
    "name": "...",
    "film": "...",
    "why_this_character": "One sentence — describe how the user's music this week sounds like this character's world."
}

Also assign a tamil_protagonist archetype:
- A short cinematic title like "The Midnight Wanderer", "The Soft Fire", "The Street Poet"
- Optionally echo a Tamil cinema style
- Keep it light, one line

Return ONLY valid JSON — no markdown, no preamble, no explanation outside the JSON:

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

      // Validate — if Groq hallucinated a character not on the list, swap in a random valid one
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
        tamil_protagonist: {
          archetype: 'The Silent Storm',
          inspired_by: 'Dhanush-style understated intensity',
        },
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
};