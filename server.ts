import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy initialization of Gemini client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Fallback list of classic Christian hymn titles and keywords
const KNOWN_HYMN_KEYWORDS = [
  'amazing grace',
  'how great thou art',
  'great is thy faithfulness',
  'his way is perfect',
  'blessed assurance',
  'holy, holy, holy',
  'what a friend we have in jesus',
  'a mighty fortress is our god',
  'it is well with my soul',
  'when we all get to heaven',
  'victory in jesus',
  'standing on the promises',
  'to god be the glory',
  'because he lives',
  'the old rugged cross',
  'i need thee every hour',
  'crown him with many crowns',
  'all hail the power of jesus name',
  'be thou my vision',
  'in the garden',
  'leaping and walking',
  'count your blessings',
  'rock of ages',
  'fairest lord jesus',
  'nearer, my god, to thee',
  'pass me not',
  'sweet hour of prayer',
  'tis so sweet to trust in jesus',
  'trust and obey',
  'turn your eyes upon jesus',
  'jesus loves me',
  'he hideth my soul',
  'he lives',
  'my hope is built on nothing less',
  'solid rock',
  'cornerstone',
  'love lifted me',
  'i have decided to follow jesus',
  'softly and tenderly',
  'just as i am',
  'have thine own way',
  'take my life and let it be',
  'lead me to calvary',
  'at calvary',
  'there is power in the blood',
  'nothing but the blood',
  'are you washed in the blood',
  'down at the cross',
  'glory to his name',
  'peace like a river',
  'give me oil in my lamp',
  'this is the day',
  'praise him, praise him',
  'joyful, joyful we adore thee',
  'christ the lord is risen today',
  'silent night',
  'hark! the herald angels sing',
  'o come all ye faithful',
  'away in a manger',
  'o holy night',
  'joy to the world',
  'god will take care of you',
  'tell it to jesus',
  'jesus paid it all',
  'shall we gather at the river',
  'revive us again',
  'cleanse me',
  'search me, o god',
  'fill my cup, lord',
  'day by day',
  'higher ground',
  'i will sing of my redeemer',
  'redeemed how i love to proclaim it',
  'burdens are lifted at calvary',
  'room at the cross for you',
  'only trust him',
  'whosoever will',
  'almost persuaded',
  'lord, i’m coming home',
  'lord, i\'m coming home',
  'i surrender all',
  'where he leads me i will follow',
  'he leadeth me',
  'savior, like a shepherd lead us',
  'jesus is all the world to me',
  'my tribute',
  'to god be the glory',
  'majesty',
  'give thanks',
  'as the deer',
  'shine, jesus, shine',
  'ancient of days',
  'el shaddai',
  'surely the presence of the lord',
  'we have come into his house',
  'seek ye first',
  'bind us together',
  'in his time',
  'change my heart o god',
  'i love you lord',
  'hallelujah',
];

function fallbackHymnClassifier(songs: Array<{ id: string; title: string; artist?: string; lyrics?: string }>): string[] {
  const hymnIds: string[] = [];
  for (const s of songs) {
    const titleLower = (s.title || '').toLowerCase().trim();
    const artistLower = (s.artist || '').toLowerCase().trim();
    const lyricsLower = (s.lyrics || '').toLowerCase().trim();

    // Check known keywords
    const isKeywordMatch = KNOWN_HYMN_KEYWORDS.some((kw) => titleLower.includes(kw) || kw.includes(titleLower));
    // Check traditional hymn authors or indicators
    const isAuthorMatch = ['fanny crosby', 'charles wesley', 'isaac watts', 'john newton', 'horatio spafford', 'philip bliss', 'ira sankey', 'martin luther', 'hymn'].some(
      (author) => artistLower.includes(author)
    );
    // Check stanzas/thee/thou archaic patterns typical of classic hymns
    const hasArchaicLyrics = /\b(thou|thee|thine|thy|doth|hath|o lord|savior)\b/i.test(lyricsLower) && /\b(stanza|verse 1|verse 2|hymn)\b/i.test(lyricsLower);

    if (isKeywordMatch || isAuthorMatch || (hasArchaicLyrics && lyricsLower.length > 50)) {
      hymnIds.push(s.id);
    }
  }
  return hymnIds;
}

// API endpoint to identify hymns among existing songs using Gemini AI
app.post('/api/identify-hymns', async (req, res) => {
  try {
    const { songs } = req.body;
    if (!Array.isArray(songs) || songs.length === 0) {
      return res.json({ hymnIds: [], source: 'empty' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      // Fallback heuristic if API key is not configured
      const hymnIds = fallbackHymnClassifier(songs);
      return res.json({ hymnIds, source: 'fallback_heuristic', notice: 'Identified via church hymnography database.' });
    }

    // Prepare concise metadata for Gemini
    const songSummaries = songs.map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist || '',
      lyricsSnippet: (s.lyrics || '').slice(0, 200),
    }));

    const prompt = `You are a church musicologist and hymnologist.
Review the following list of church songs. Identify which of these are traditional, classic Christian HYMNS (e.g. songs found in traditional church hymnals like The Baptist Hymnal, Great Hymns of the Faith, or classic hymnody from authors like Isaac Watts, Charles Wesley, Fanny Crosby, John Newton, etc.).

Do NOT categorize modern contemporary praise and worship music (e.g., Hillsong, Bethel, Elevation, Maverick City, Planetshakers, modern CCM), solo special performance pieces, or recent choruses as Hymns. Only categorize classic or traditional hymns as 'Hymn'.

Song list:
${JSON.stringify(songSummaries, null, 2)}

Return a JSON array of the string IDs for songs that are classic hymns.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hymnIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Array of song IDs that are traditional or classic hymns.',
            },
          },
          required: ['hymnIds'],
        },
      },
    });

    const responseText = response.text?.trim() || '{}';
    const parsed = JSON.parse(responseText);
    const hymnIds: string[] = Array.isArray(parsed.hymnIds) ? parsed.hymnIds : [];

    // Combine with known matches to ensure no classic hymn is missed
    const fallbackIds = fallbackHymnClassifier(songs);
    const combinedSet = new Set([...hymnIds, ...fallbackIds]);

    return res.json({
      hymnIds: Array.from(combinedSet),
      source: 'gemini-3.8-flash',
    });
  } catch (error: any) {
    console.error('Error in /api/identify-hymns:', error);
    // Graceful fallback to heuristic classification
    const { songs } = req.body;
    const fallbackIds = Array.isArray(songs) ? fallbackHymnClassifier(songs) : [];
    return res.json({
      hymnIds: fallbackIds,
      source: 'fallback_error_recovery',
      error: error.message,
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
