import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowUpLeft, ChevronLeft, Clock3, Menu, Search, Sparkles, TrendingUp, X } from "lucide-react";
import { useArticles } from "@/hooks/useArticles";
import ThemeToggle from "@/components/ThemeToggle";
import ErrorBoundary from "@/components/ErrorBoundary";
import SafeImage from "@/components/SafeImage";

const arCategories = ["الرئيسية", "سياسة", "اقتصاد", "تكنولوجيا", "رياضة", "ثقافة", "صحة", "علوم", "منوعات"];
const enCategories = ["All", "Politics", "Economy", "Technology", "Sports", "Culture", "Health", "Science", "Entertainment"];
const fallbackImages = ["/assets/hero-news.jpg", "/assets/politics-news.jpg", "/assets/economy-news.jpg", "/assets/tech-news.jpg", "/assets/sports-news.jpg"];

const formatDate = (value?: string | null) => value
  ? new Intl.DateTimeFormat("ar", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
  : "منذ قليل";

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const initialSection = (searchParams.get("section") || "ar") as "ar" | "en";
  const [activeSection, setActiveSection] = useState<"ar" | "en">(initialSection);
  const [activeCategory, setActiveCategory] = useState(initialSection === "ar" ? "الرئيسية" : "All");
  const [page] = useState(Number(searchParams.get("page") || 1));
  const isAr = activeSection === "ar";
  const { articles, loading, totalCount } = useArticles(activeSection, page);
  const categories = isAr ? arCategories : enCategories;
  const filtered = useMemo(() => activeCategory === "الرئيسية" || activeCategory === "All" ? articles : articles.filter((item) => item.category === activeCategory), [activeCategory, articles]);
  const lead = filtered[0];
  const secondary = filtered.slice(1, 5);
  const feed = filtered.slice(5);

  const changeSection = (section: "ar" | "en") => {
    setActiveSection(section);
    setActiveCategory(section === "ar" ? "الرئيسية" : "All");
    const params = new URLSearchParams(searchParams);
    params.set("section", section);
    setSearchParams(params, { replace: true });
  };

  const imageFor = (index: number, url?: string | null) => url || fallbackImages[index % fallbackImages.length];

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#f7f8fa] text-[#142235] dark:bg-[#0b111b] dark:text-slate-100" dir={isAr ? "rtl" : "ltr"}>
        <div className="bg-[#101b2d] px-4 py-2 text-xs text-slate-300">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <span>الأربعاء، 19 أغسطس 2026</span>
            <span className="hidden sm:inline">القيادة 24 — الخبر بدقة، والتحليل بعمق</span>
            <Link to="/admin/login" className="font-semibold text-amber-300 hover:text-white">دخول الإدارة</Link>
          </div>
        </div>

        <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-[#0d1624]/95">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 lg:px-8">
            <button aria-label="فتح القائمة" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
            <Link to="/" className="group flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#c9943e] text-xl font-black text-white shadow-lg shadow-amber-900/20">س</div>
              <div><div className="text-2xl font-black tracking-tight text-[#10233c] dark:text-white">القيادة <span className="text-[#c9943e]">24</span></div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">ALQIADA 24</div></div>
            </Link>
            <nav className={`${menuOpen ? "absolute inset-x-4 top-[76px] flex" : "hidden"} flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl lg:static lg:flex lg:flex-row lg:items-center lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none dark:border-slate-700 dark:bg-[#111c2c] lg:dark:bg-transparent`} aria-label="التنقل الرئيسي">
              {categories.slice(0, 6).map((category) => <button key={category} onClick={() => { setActiveCategory(category); setMenuOpen(false); }} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${activeCategory === category ? "bg-[#10233c] text-white dark:bg-[#c9943e]" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}>{category}</button>)}
            </nav>
            <div className="flex items-center gap-2"><button aria-label="بحث" className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Search size={20} /></button><ThemeToggle /><Link to="/archive" className="hidden rounded-xl bg-[#c9943e] px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-amber-900/15 transition hover:-translate-y-0.5 sm:inline-flex">الأرشيف</Link></div>
          </div>
          <div className="border-t border-slate-100 dark:border-slate-800"><div className="mx-auto flex max-w-7xl items-center gap-3 overflow-x-auto px-4 py-2.5 lg:px-8"><span className="flex shrink-0 items-center gap-2 text-xs font-black text-[#c14532]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#c14532]" /> عاجل</span><span className="h-4 w-px bg-slate-200 dark:bg-slate-700" /><span className="whitespace-nowrap text-xs font-semibold text-slate-500">متابعة مستمرة لأهم التطورات المحلية والعالمية لحظة بلحظة</span><button onClick={() => changeSection(isAr ? "en" : "ar")} className="mr-auto shrink-0 rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">{isAr ? "English Edition" : "النسخة العربية"}</button></div></div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-7 lg:px-8 lg:py-10">
          <section className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end dark:border-slate-800"><div><p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[#c9943e]"><Sparkles size={14} /> نبض الأخبار</p><h1 className="max-w-2xl text-3xl font-black leading-tight tracking-tight sm:text-5xl">نقرأ المشهد،<br /><span className="text-[#c9943e]">ونخبرك بما وراء الخبر.</span></h1></div><p className="max-w-xs text-sm leading-7 text-slate-500 dark:text-slate-400">منصة إخبارية عربية مستقلة تجمع الخبر العاجل مع القراءة الأعمق والتحليل الأكثر وضوحًا.</p></section>

          <section className="mb-10 grid gap-5 lg:grid-cols-12">
            {lead ? <Link to={`/article/${lead.slug || lead.id}`} className="group relative min-h-[390px] overflow-hidden rounded-[2rem] bg-[#12243c] lg:col-span-7"><SafeImage src={imageFor(0, lead.image_url)} alt={lead.title} fallbackLabel={lead.title} className="absolute inset-0 h-full w-full object-cover opacity-70 transition duration-700 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-[#08111f] via-[#08111f]/45 to-transparent" /><div className="relative flex h-full flex-col justify-end p-6 text-white sm:p-9"><span className="mb-4 w-fit rounded-full bg-[#c9943e] px-3 py-1 text-xs font-black">{lead.category || "الأبرز"}</span><h2 className="max-w-2xl text-2xl font-black leading-tight sm:text-4xl">{lead.title}</h2><div className="mt-4 flex items-center gap-3 text-xs text-slate-300"><Clock3 size={14} /> {formatDate(lead.published_at)} <span>•</span> قراءة في 4 دقائق</div></div></Link> : <div className="flex min-h-[390px] items-end rounded-[2rem] bg-gradient-to-br from-[#10233c] via-[#173a5d] to-[#c9943e] p-7 text-white lg:col-span-7"><div><span className="mb-4 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-black backdrop-blur">الواجهة الرئيسية</span><h2 className="max-w-xl text-3xl font-black leading-tight sm:text-5xl">أخبارك في مكان واحد.<br />بأسلوب يليق بك.</h2><p className="mt-4 max-w-md text-sm leading-7 text-slate-200">أضف مصادر الأخبار من لوحة الإدارة لتبدأ المنصة في استقبال أحدث القصص والتحليلات.</p></div></div>}
            <div className="grid gap-5 sm:grid-cols-2 lg:col-span-5">{secondary.length ? secondary.map((item, index) => <Link key={item.id} to={`/article/${item.slug || item.id}`} className="group relative min-h-[185px] overflow-hidden rounded-3xl bg-[#10233c]"><SafeImage src={imageFor(index + 1, item.image_url)} alt={item.title} fallbackLabel={item.title} className="absolute inset-0 h-full w-full object-cover opacity-65 transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-[#08111f] to-transparent" /><div className="relative flex h-full flex-col justify-end p-5 text-white"><span className="mb-2 text-[11px] font-black text-amber-300">{item.category || "خبر"}</span><h3 className="line-clamp-3 text-base font-black leading-6">{item.title}</h3></div></Link>) : ["قراءة سياسية هادئة وسط ضجيج العناوين", "اقتصاد جديد وفرص تتشكل الآن"].map((title, index) => <div key={title} className="flex min-h-[185px] flex-col justify-end rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111c2c]"><span className="mb-3 text-[11px] font-black text-[#c9943e]">قريبًا</span><h3 className="text-lg font-black leading-7">{title}</h3><p className="mt-2 text-xs text-slate-500">سيظهر المحتوى عند ربط مصادر الأخبار.</p></div>)} </div>
          </section>

          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#c14532]"><TrendingUp size={15} /> الأكثر متابعة</div><h2 className="text-2xl font-black sm:text-3xl">آخر الأخبار</h2></div><div className="flex gap-2 overflow-x-auto pb-1">{categories.map((category) => <button key={category} onClick={() => setActiveCategory(category)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition ${activeCategory === category ? "border-[#10233c] bg-[#10233c] text-white dark:border-[#c9943e] dark:bg-[#c9943e]" : "border-slate-200 bg-white text-slate-500 hover:border-[#c9943e] dark:border-slate-700 dark:bg-[#111c2c]"}`}>{category}</button>)}</div></div>

          {loading ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><div className="h-72 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" /><div className="h-72 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" /><div className="h-72 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" /></div> : feed.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{feed.map((item, index) => <Link key={item.id} to={`/article/${item.slug || item.id}`} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10 dark:border-slate-800 dark:bg-[#111c2c]"><div className="relative aspect-[16/9] overflow-hidden"><SafeImage src={imageFor(index + 2, item.image_url)} alt={item.title} fallbackLabel={item.title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><span className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-black text-[#10233c]">{item.category || "عام"}</span></div><div className="p-5"><div className="mb-3 flex items-center gap-2 text-xs text-slate-400"><Clock3 size={13} /> {formatDate(item.published_at)}</div><h3 className="line-clamp-3 text-lg font-black leading-7">{item.title}</h3><p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.description || "تغطية خاصة وتحليل موجز لأبرز تفاصيل الخبر."}</p><span className="mt-5 inline-flex items-center gap-2 text-xs font-black text-[#c9943e]">اقرأ القصة <ArrowLeft size={14} /></span></div></Link>)}</div> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-[#111c2c]"><div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-[#c9943e] dark:bg-amber-950/30"><Sparkles /></div><h3 className="text-xl font-black">المنصة جاهزة لاستقبال الأخبار</h3><p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">لا توجد قصص منشورة حاليًا. بعد إضافة مصادر الأخبار من لوحة الإدارة ستظهر العناوين هنا تلقائيًا.</p><Link to="/admin/login" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#10233c] px-5 py-3 text-sm font-black text-white hover:bg-[#1b385b]">إدارة المصادر <ArrowUpLeft size={16} /></Link></div>}

          <section className="mt-12 grid gap-4 border-y border-slate-200 py-6 sm:grid-cols-3 dark:border-slate-800"><div><div className="text-2xl font-black text-[#10233c] dark:text-white">{totalCount || "—"}</div><div className="mt-1 text-xs font-bold text-slate-500">قصة في الأرشيف</div></div><div><div className="text-2xl font-black text-[#c9943e]">24/7</div><div className="mt-1 text-xs font-bold text-slate-500">تغطية مستمرة</div></div><div><div className="text-2xl font-black text-[#10233c] dark:text-white">عربي</div><div className="mt-1 text-xs font-bold text-slate-500">منصة مستقلة بصوت واضح</div></div></section>
        </main>

        <footer className="bg-[#101b2d] px-4 py-10 text-white"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 sm:flex-row sm:items-end"><div><div className="text-2xl font-black">القيادة <span className="text-[#c9943e]">24</span></div><p className="mt-2 max-w-sm text-sm leading-7 text-slate-400">نحو صحافة عربية أكثر وضوحًا، وأقرب إلى القارئ، وأبعد عن ضجيج العناوين.</p></div><div className="flex gap-5 text-sm font-bold text-slate-300"><Link to="/archive" className="hover:text-amber-300">الأرشيف</Link><Link to="/admin/login" className="hover:text-amber-300">الإدارة</Link><a href="mailto:hello@nawaqes7.github.io/shibam" className="hover:text-amber-300">تواصل معنا</a></div></div><div className="mx-auto mt-8 max-w-7xl border-t border-white/10 pt-5 text-xs text-slate-500">© 2026 القيادة 24. جميع الحقوق محفوظة.</div></footer>
      </div>
    </ErrorBoundary>
  );
};

export default Index;
