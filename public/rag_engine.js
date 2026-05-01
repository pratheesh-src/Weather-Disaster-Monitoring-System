/**
 * =====================================================
 *  DISASTER SAFETY RAG ENGINE
 *  Drop this into your dashboard.
 *  Works with Gemini 2.0 Flash API.
 * =====================================================
 *
 *  USAGE:
 *    1. Load your knowledge base txt file (see disaster_knowledge_base.txt)
 *    2. Call loadKnowledgeBase(rawText)
 *    3. Call askRAG(query) to get an answer
 *
 *  INTEGRATION EXAMPLE:
 *    const raw = await fetch('./disaster_knowledge_base.txt').then(r => r.text());
 *    loadKnowledgeBase(raw);
 *    const answer = await askRAG('What do I do during a flood?');
 *    console.log(answer.text, answer.severity, answer.sources);
 */

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const RAG_CONFIG = {
  maxChunks:    4,       // how many KB chunks to inject per query
  temperature:  0.3,
  maxTokens:    700,
  backendUrl:   '/api/rag-query',  // Backend proxy endpoint (NEVER expose API keys to frontend)
};

// ─── STATE ────────────────────────────────────────────────────────────────────

let knowledgeChunks = [];   // parsed from the .txt file

// ─── PUBLIC API ───────────────────────────────────────────────────────────────
// NOTE: API keys are NEVER exposed to frontend. All external API calls go through backend.

/**
 * Parse and load the knowledge base from raw .txt content.
 * Call this once on startup, or reload anytime the file changes.
 * @param {string} rawText  - contents of disaster_knowledge_base.txt
 * @returns {number}        - number of chunks loaded
 */
function loadKnowledgeBase(rawText) {
  knowledgeChunks = [];

  const blocks = rawText.split('---').map(b => b.trim()).filter(Boolean);

  for (const block of blocks) {
    // Skip comment-only lines (lines starting with #)
    const lines = block.split('\n').filter(l => !l.startsWith('#') && l.trim());
    if (lines.length < 2) continue;

    // First non-comment line is the header: [id | topic | severity]
    const headerMatch = lines[0].match(/\[(.+?)\|(.+?)\|(.+?)\]/);
    if (!headerMatch) continue;

    const id       = headerMatch[1].trim();
    const topic    = headerMatch[2].trim().toLowerCase();
    const severity = headerMatch[3].trim().toUpperCase();
    const text     = lines.slice(1).join(' ').trim();

    if (text) {
      knowledgeChunks.push({ id, topic, severity, text });
    }
  }

  console.log(`[RAG] Loaded ${knowledgeChunks.length} knowledge chunks.`);
  return knowledgeChunks.length;
}

/**
 * Detect if query is a greeting (hi, hello, hey, greetings, etc.)
 * @param {string} query
 * @returns {boolean}
 */
function isGreeting(query) {
  const q = query.toLowerCase().trim();
  const greetingPatterns = [
    /^(hi|hello|hey|greetings?|howdy|sup|yo)\b/,
    /\b(hi|hello|hey)\s*(there|pratheesh)?$/,
  ];
  return greetingPatterns.some(p => p.test(q));
}

/**
 * Generate personalized greeting response
 * @returns {Promise<{text: string, severity: string, sources: string[]}>}
 */
async function getGreetingResponse() {
  return {
    text: `Hello Pratheesh D.! 👋 Welcome to the Weather and Disaster Monitoring Prototype at USJP FOT.

I'm your AI assistant for this system. I can help you with:
• Weather monitoring and temperature threshold alerts
• Disaster safety protocols and preparedness
• Sensor data analysis (tilt sensors, seismic activity)
• Emergency response guidance

Feel free to ask about any current alerts, safety procedures, or system status.`,
    severity: 'INFORMATIONAL',
    sources: [],
  };
}

/**
 * Main RAG query function.
 * Retrieves relevant local chunks and sends query to backend for API processing.
 *
 * @param {string} query - user's natural language question
 * @returns {Promise<{text: string, severity: string, sources: string[], rawChunks: object[]}>}
 */
async function askRAG(query) {
  // Check for greeting first
  if (isGreeting(query)) {
    return await getGreetingResponse();
  }

  if (!knowledgeChunks.length) throw new Error('[RAG] Knowledge base not loaded. Call loadKnowledgeBase() first.');

  const retrieved = retrieveChunks(query);
  const context   = buildContext(retrieved);
  
  try {
    // Send to backend proxy - API key is safely stored server-side
    const response = await fetch(RAG_CONFIG.backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, context })
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    const result = await response.json();
    return parseResponse(result.text, retrieved);
  } catch (err) {
    console.warn('[RAG] Backend unavailable. Using local fallback response.');
    const fallback = synthesizeLocalResponse(query, retrieved);
    return parseResponse(fallback, retrieved);
  }
}

/**
 * Create a simple local response using retrieved knowledge chunks.
 * The returned string follows the same format the Gemini parser expects
 * (starts with a SEVERITY: line, followed by text and a Key actions: list).
 */
function synthesizeLocalResponse(query, chunks) {
  // Determine severity: if any HIGH -> HIGH RISK, else if any MODERATE -> MODERATE RISK
  let severity = 'INFORMATIONAL';
  if (chunks.some(c => c.severity === 'HIGH')) severity = 'HIGH RISK';
  else if (chunks.some(c => c.severity === 'MODERATE')) severity = 'MODERATE RISK';

  // Use up to 3 chunks to build an answer summary
  const top = chunks.slice(0, 3);
  let body = '';
  if (top.length === 0) {
    body = "I don't have specific knowledge for that query in the knowledge base. Follow general disaster safety principles and consult local authorities.";
  } else {
    // Build 2-3 short paragraphs summarizing key points
    const summaries = top.map(c => c.text.replace(/\s+/g, ' ').trim());
    body = summaries.slice(0, 2).map(s => s.length > 300 ? s.slice(0, 300) + '...' : s).join('\n\n');
  }

  // Key actions: derive simple bullets from chunk IDs/topics
  const actions = [];
  for (const c of top) {
    if (c.topic === 'flood') actions.push(`Follow guidance from ${c.id}: ${c.text.split('.').slice(0,1)[0].trim()}.`);
    else if (c.topic === 'earthquake') actions.push(`Follow guidance from ${c.id}: ${c.text.split('.').slice(0,1)[0].trim()}.`);
    else actions.push(`${c.id}: ${c.text.split('.').slice(0,1)[0].trim()}.`);
  }
  // Ensure 3 bullets
  while (actions.length < 3) actions.push('Monitor official channels and emergency services for updates.');

  const keyActions = 'Key actions:\n' + actions.slice(0,5).map(a => '- ' + a).join('\n');

  return `SEVERITY: ${severity}\n\n${body}\n\n${keyActions}`;
}

/**
 * Get current loaded chunks (for UI display / debugging)
 * @returns {object[]}
 */
function getChunks() {
  return knowledgeChunks;
}

// ─── RETRIEVAL (keyword + topic scoring) ─────────────────────────────────────

const TOPIC_KEYWORDS = {
  flood:      ['flood','flash flood','water','rain','inundation','river','drown','submerge','overflow','surge'],
  earthquake: ['earthquake','quake','tremor','seismic','shake','richter','tsunami','fault','aftershock'],
  heat:       ['heat','hot','temperature','heatstroke','heat stroke','dehydrat','sun','sweat','humid','fever','cooling'],
  wind:       ['wind','hurricane','tornado','cyclone','storm','gust','typhoon','squall'],
  landslide:  ['landslide','mudslide','slope','debris','mud','hill','mountain','slip','avalanche','rockfall'],
  gas:        ['gas','toxic','poison','chlorine','carbon monoxide','ammonia','fume','leak','chemical','hazmat','co2','h2s','lpg'],
};

function retrieveChunks(query) {
  const q = query.toLowerCase();

  const scored = knowledgeChunks.map(chunk => {
    let score = 0;

    // Topic match: if query contains topic keywords, boost same-topic chunks heavily
    for (const [topic, words] of Object.entries(TOPIC_KEYWORDS)) {
      const queryHitsTopic = words.some(w => q.includes(w));
      if (queryHitsTopic && chunk.topic === topic) score += 5;
    }

    // Severity boost: HIGH severity chunks score higher for dangerous-sounding queries
    const dangerWords = ['danger','emergency','survive','escape','trapped','dying','help','now','immediately','safe'];
    if (dangerWords.some(w => q.includes(w)) && chunk.severity === 'HIGH') score += 2;

    // Word overlap between query and chunk text
    const chunkWords  = chunk.text.toLowerCase().split(/\W+/);
    const queryWords  = q.split(/\W+/).filter(w => w.length > 3);
    const overlap     = queryWords.filter(w => chunkWords.includes(w)).length;
    score += overlap;

    return { chunk, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, RAG_CONFIG.maxChunks)
    .map(s => s.chunk);
}

function buildContext(chunks) {
  if (!chunks.length) return 'No specific knowledge matched. Use general disaster safety principles.';
  return 'KNOWLEDGE BASE CONTEXT:\n\n' +
    chunks.map((c, i) =>
      `[${i + 1}] ID:${c.id} | Topic:${c.topic} | Severity:${c.severity}\n${c.text}`
    ).jNOTE: Gemini API calls are handled server-side for security ─────────────
// The backend endpoint /api/rag-query uses the API key stored securely in .env
// Frontend NEVER has access to API credentials. }

  return data?.candidates?.[0]?.content?.parts?.[0]?.text || (typeof text === 'string' ? text : '');
}

// ─── RESPONSE PARSER ─────────────────────────────────────────────────────────

function parseResponse(rawText, sources) {
  let severity = 'INFORMATIONAL';
  let text = rawText;

  const severityMatch = rawText.match(/SEVERITY:\s*(HIGH RISK|MODERATE RISK|INFORMATIONAL)/i);
  if (severityMatch) {
    severity = severityMatch[1].toUpperCase();
    text = rawText.replace(severityMatch[0], '').trim();
  }

  return {
    text,
    severity,                             // "HIGH RISK" | "MODERATE RISK" | "INFORMATIONAL"
    sources: sources.map(c => c.id),      // e.g. ["flood-001", "flood-003"]
    rawChunks: sources,                   // full chunk objects if needed
  };
}

// ─── EXPORTS (use whichever module system your dashboard uses) ────────────────

// CommonJS (Node / webpack)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadKnowledgeBase, askRAG, getChunks };
}

// ESM
// export { setApiKey, loadKnowledgeBase, askRAG, getChunks };

// Browser global
if (typeof window !== 'undefined') {
  window.DisasterRAG = { loadKnowledgeBase, askRAG, getChunks };

  // Convenience initializer: call on page load to set API key and load KB
  async function initRAG(apiKey = RAG_CONFIG.geminiApiKey, kbPath = './disaster_knowledge_base.txt') {
    if (apiKey) DisasterRAG.setApiKey(apiKey);
    try {
      const raw = await fetch(kbPath).then(r => r.text());
      const count = DisasterRAG.loadKnowledgeBase(raw);
      console.log('RAG ready —', count, 'chunks loaded');
      // expose status
      DisasterRAG._status = { chunks: count, kbPath, apiKeySet: !!apiKey };
      return count;
    } catch (err) {
      console.error('[RAG] Failed to load knowledge base:', err);
      DisasterRAG._status = { chunks: 0, kbPath, apiKeySet: !!apiKey, lastError: err && (err.message || err) };
      throw err;
    }
  }

  // Diagnostic helper
  function checkStatus() {
    return {
      chunks: knowledgeChunks.length,
      apiKeySet: !!RAG_CONFIG.geminiApiKey,
      geminiModel: RAG_CONFIG.geminiModel,
      geminiUrl: RAG_CONFIG.geminiUrl,
      lastStatus: DisasterRAG?._status || null
    };
  }

  // Convenience query wrapper: use to wire chat input -> output element
  async function askDisasterRAG(userMessage, outputElementId = null) {
    try {
      const result = await DisasterRAG.askRAG(userMessage);
      console.log(result.text);
      console.log(result.severity);
      console.log(result.sources);

      if (outputElementId) {
        const el = document.getElementById(outputElementId);
        if (el) el.innerHTML = result.text;
      }

      return result;
    } catch (err) {
      console.error('[RAG] askDisasterRAG error:', err);
      if (outputElementId) {
        const el = document.getElementById(outputElementId);
        if (el) el.innerHTML = '[RAG] Error: ' + (err.message || err);
      }
      throw err;
    }
  }

  // Expose helpers
  window.DisasterRAG.initRAG = initRAG;
  window.DisasterRAG.askDisasterRAG = askDisasterRAG;
}
