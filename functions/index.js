const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();
setGlobalOptions({ region: "us-central1", maxInstances: 2 });

const clean = (value = "") => String(value)
  .replace(/<[^>]*>/g, " ")
  .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, " ").trim();
const stripTracking = (url = "") => {
  try { const u = new URL(url); ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"].forEach((key) => u.searchParams.delete(key)); return u.toString().replace(/\/$/, ""); }
  catch { return String(url).trim(); }
};
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex").slice(0, 32);
const tag = (xml, name) => {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return match ? clean(match[1].replace(/<!\[CDATA\[|\]\]>/g, "")) : "";
};
const atomTag = (xml, name) => tag(xml, name);
const entries = (xml) => {
  const rss = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
  const atom = [...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)].map((m) => m[1]);
  return rss.length ? rss : atom;
};
const entryToArticle = (entry, source) => {
  const title = tag(entry, "title");
  const url = stripTracking(tag(entry, "link") || ((entry.match(/<link[^>]+href=["']([^"']+)["']/i) || [])[1] || ""));
  const description = clean(tag(entry, "description") || tag(entry, "summary") || tag(entry, "content"));
  const content = clean(tag(entry, "content:encoded") || tag(entry, "content") || description);
  const published = tag(entry, "pubDate") || tag(entry, "published") || tag(entry, "updated") || new Date().toISOString();
  const image = ((entry.match(/<media:content[^>]+url=["']([^"']+)["']/i) || entry.match(/<enclosure[^>]+url=["']([^"']+)["']/i) || [])[1] || null);
  if (!title || !url) return null;
  const canonical = hash(`${url}|${title.toLocaleLowerCase()}`);
  return { id: canonical, title, description: description.slice(0, 1200) || null, content: content.slice(0, 12000) || null, url, image_url: image, author: tag(entry, "author") || null, category: tag(entry, "category") || source.assigned_category || "منوعات", language: source.language || "ar", published_at: new Date(published).toISOString(), source_id: source.id, is_published: true, is_ai_generated: false, created_at: admin.firestore.FieldValue.serverTimestamp(), slug: canonical };
};

async function fetchSource(source) {
  const response = await fetch(source.fetch_url || source.url, { headers: { "User-Agent": "Alqiada24NewsBot/1.0" }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const xml = await response.text();
  const parsed = entries(xml).map((entry) => entryToArticle(entry, source)).filter(Boolean).slice(0, 40);
  let fetched = 0;
  for (const article of parsed) {
    const ref = db.collection("articles").doc(article.id);
    const existing = await ref.get();
    if (!existing.exists) { await ref.set(article); fetched += 1; }
  }
  await db.collection("news_sources").doc(source.id).update({ last_fetched_at: new Date().toISOString(), articles_count: admin.firestore.FieldValue.increment(fetched), last_error: null });
  return fetched;
}

async function ingest(sourceId) {
  const snapshot = sourceId ? await db.collection("news_sources").doc(sourceId).get() : await db.collection("news_sources").where("is_active", "==", true).get();
  const sources = sourceId ? (snapshot.exists ? [{ id: snapshot.id, ...snapshot.data() }] : []) : snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  let fetched = 0; let completed = 0;
  for (const source of sources) { try { fetched += await fetchSource(source); completed += 1; } catch (error) { await db.collection("news_sources").doc(source.id).update({ last_error: String(error.message || error), last_fetched_at: new Date().toISOString() }).catch(() => {}); } }
  return { fetched, sources: completed, attempted: sources.length };
}

exports.ingestNews = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
  try { const result = await ingest(req.body && req.body.sourceId); return res.json(result); }
  catch (error) { console.error(error); return res.status(500).json({ error: "تعذر جلب الأخبار" }); }
});
exports.scheduledIngest = onSchedule("every 15 minutes", async () => { await ingest(); });
