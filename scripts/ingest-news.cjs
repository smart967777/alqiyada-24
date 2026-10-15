const admin = require("firebase-admin");
const crypto = require("crypto");

const credentials = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!credentials) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(credentials)) });
const db = admin.firestore();

const clean = (value = "") => String(value)
  .replace(/<[^>]*>/g, " ")
  .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, " ").trim();
const stripTracking = (url = "") => { try { const u = new URL(url); ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","fbclid","gclid"].forEach((k) => u.searchParams.delete(k)); return u.toString().replace(/\/$/, ""); } catch { return String(url).trim(); } };
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex").slice(0, 32);
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i")); return m ? clean(m[1].replace(/<!\[CDATA\[|\]\]>/g, "")) : ""; };
const entries = (xml) => { const rss = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map((m) => m[1]); return rss.length ? rss : [...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)].map((m) => m[1]); };
function parse(entry, source) {
  const title = tag(entry, "title");
  const url = stripTracking(tag(entry, "link") || ((entry.match(/<link[^>]+href=["']([^"']+)["']/i) || [])[1] || ""));
  const description = clean(tag(entry, "description") || tag(entry, "summary") || tag(entry, "content"));
  const content = clean(tag(entry, "content:encoded") || tag(entry, "content") || description);
  const published = tag(entry, "pubDate") || tag(entry, "published") || tag(entry, "updated") || new Date().toISOString();
  const image = ((entry.match(/<media:content[^>]+url=["']([^"']+)["']/i) || entry.match(/<enclosure[^>]+url=["']([^"']+)["']/i) || [])[1] || null);
  if (!title || !url) return null;
  const id = hash(`${url}|${title.toLocaleLowerCase()}`);
  let publishedAt; try { publishedAt = new Date(published).toISOString(); } catch { publishedAt = new Date().toISOString(); }
  return { title, description: description.slice(0, 1200) || null, content: content.slice(0, 12000) || null, url, image_url: image, author: tag(entry, "author") || null, category: tag(entry, "category") || source.assigned_category || "منوعات", language: source.language || "ar", published_at: publishedAt, source_id: source.id, is_published: true, is_ai_generated: false, created_at: new Date().toISOString(), slug: id };
}
async function main() {
  const snap = await db.collection("news_sources").where("is_active", "==", true).get();
  let total = 0, ok = 0;
  for (const doc of snap.docs) {
    const source = { id: doc.id, ...doc.data() };
    try {
      const response = await fetch(source.fetch_url || source.url, { headers: { "User-Agent": "Alqiada24NewsBot/1.0" }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const xml = await response.text();
      let fetched = 0;
      for (const item of entries(xml).map((e) => parse(e, source)).filter(Boolean).slice(0, 40)) {
        const ref = db.collection("articles").doc(item.slug);
        if (!(await ref.get()).exists) { await ref.set(item); fetched++; }
      }
      await doc.ref.update({ last_fetched_at: new Date().toISOString(), articles_count: admin.firestore.FieldValue.increment(fetched), last_error: null });
      total += fetched; ok++;
      console.log(`${source.name || source.url}: ${fetched} new articles`);
    } catch (error) {
      await doc.ref.update({ last_fetched_at: new Date().toISOString(), last_error: String(error.message || error) });
      console.error(`${source.name || source.url}: ${error.message || error}`);
    }
  }
  console.log(JSON.stringify({ sources: snap.size, successful: ok, newArticles: total }));
}
main().catch((error) => { console.error(error); process.exit(1); });
