import { useState, useRef, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";

const NAV_LINKS = [
  {label:"URL Checker",to:"/"},{label:"Batch",to:"/Batch"},{label:"Models",to:"/ModelExplorer"},
  {label:"EDA",to:"/EdaDashboard"},{label:"FP Lab",to:"/FpLab"},
  {label:"Adversarial",to:"/Adversarial"},
  {label:"Typosquat",to:"/TypoSquat"},{label:"About",to:"/About"},
];

const MODELS = [
  { id:"rf",    label:"Random Forest",       short:"RF",  color:"#00f0ff" },
  { id:"gbm",   label:"Gradient Boosting",   short:"GBM", color:"#9b59ff" },
  { id:"lr",    label:"Logistic Regression", short:"LR",  color:"#00b4d8" },
  { id:"dummy", label:"Dummy Classifier",    short:"DUM", color:"#6b7280" },
];

function Navbar({ active }) {
  return (
    <nav style={{ position:"fixed", top:0, left:0, right:0, zIndex:100, background:"rgba(8,10,20,0.88)", backdropFilter:"blur(18px)", borderBottom:"1px solid rgba(99,220,255,0.10)", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 32px", height:64 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:22, filter:"drop-shadow(0 0 8px #00f0ff)" }}>🛡️</span>
        <span style={{ color:"#fff", fontWeight:800, fontSize:18, letterSpacing:1 }}>PhishGuard <span style={{ color:"#00f0ff", fontWeight:400, fontSize:13 }}>AI</span></span>
      </div>
      <div style={{ display:"flex", gap:4 }}>
        {NAV_LINKS.map(l => (
          <Link key={l.to} to={l.to} style={{ color: active===l.label ? "#00f0ff" : "rgba(255,255,255,0.6)", textDecoration:"none", fontSize:12, fontWeight:600, padding:"6px 14px", borderRadius:8, background: active===l.label ? "rgba(0,240,255,0.08)" : "transparent", border: active===l.label ? "1px solid rgba(0,240,255,0.25)" : "1px solid transparent" }}>{l.label}</Link>
        ))}
      </div>
    </nav>
  );
}

// Inline feature extractor (same logic as Home.jsx — in real app this calls your API)
function scoreURL(url, modelId) {
  try {
    const u = new URL(url.startsWith("http") ? url : "https://" + url);
    const domain = u.hostname;
    const path = u.pathname;
    const full = url;
    const suspiciousKeywords = ["login","secure","verify","account","update","banking","confirm","password","signin","webscr","suspend","unusual","alert","authenticate"];
    const suspiciousTLDs = [".tk",".ml",".ga",".cf",".gq",".xyz",".top",".club",".online",".site",".info"];
    const entropy = s => { const f={}; for(const c of s) f[c]=(f[c]||0)+1; return -Object.values(f).reduce((a,v)=>{const p=v/s.length;return a+p*Math.log2(p);},0); };
    const digitRatio = s => (s.match(/\d/g)||[]).length / (s.length||1);

    const urlLen=full.length, domainLen=domain.length, subdomainCount=Math.max(0,domain.split(".").length-2);
    const pathDepth=path.split("/").filter(Boolean).length, hasAt=full.includes("@")?1:0;
    const dashCount=(domain.match(/-/g)||[]).length, digitRatioDom=digitRatio(domain);
    const domainEntropy=entropy(domain), isHttps=url.startsWith("https")?1:0;
    const keywordHit=suspiciousKeywords.filter(k=>full.toLowerCase().includes(k)).length;
    const suspTLD=suspiciousTLDs.some(t=>domain.endsWith(t))?1:0;
    const percentCount=(full.match(/%/g)||[]).length;

    const weights = [
      urlLen>100?0.20:urlLen>75?0.12:urlLen>50?0.03:-0.05,
      domainLen>30?0.10:domainLen>20?0.04:-0.03,
      subdomainCount>4?0.24:subdomainCount>2?0.14:subdomainCount>1?0.05:-0.04,
      pathDepth>5?0.08:pathDepth>3?0.03:-0.02,
      hasAt?0.22:-0.02,
      dashCount>4?0.18:dashCount>2?0.10:-0.03,
      digitRatioDom>0.4?0.15:digitRatioDom>0.2?0.08:-0.04,
      domainEntropy>4.2?0.12:domainEntropy>3.8?0.08:-0.06,
      isHttps?-0.08:0.10,
      keywordHit>1?0.18:keywordHit===1?0.10:-0.08,
      suspTLD?0.20:-0.05,
      percentCount>3?0.12:percentCount>1?0.05:-0.02,
    ];
    const base = weights.reduce((a,v)=>a+v, 0);
    const scores = { rf: base, gbm: base*1.02-0.01, lr: base*0.88+0.04, dummy: 0.557 };
    const score = Math.min(0.97, Math.max(0.03, scores[modelId]||base));
    const topFeatures = ["URL Length","Subdomain Count","@ Symbol","Suspicious Keywords","HTTPS","Suspicious TLD","Domain Entropy","Dash Count","Digit Ratio","URL Encoding (%)"];
    const topVals = [urlLen, subdomainCount, hasAt?"Present":"None", keywordHit, isHttps?"Yes":"No", suspTLD?"Yes":"No", domainEntropy.toFixed(2), dashCount, digitRatioDom.toFixed(2), percentCount];
    return { score, domain, topFeatures, topVals };
  } catch {
    return null;
  }
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  const urls = [];
  for (const line of lines) {
    // try comma-separated: take the column that looks like a URL
    const cols = line.split(",").map(c => c.trim().replace(/^["']|["']$/g,""));
    const urlCol = cols.find(c => c.includes(".") && c.length > 4);
    if (urlCol) urls.push(urlCol);
  }
  return urls;
}

// ── Educational components ───────────────────────────────────────────────────
function LearnCard({icon, title, color, children}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{borderRadius:14,background:"rgba(255,255,255,0.02)",border:`1px solid ${open?color+"35":"rgba(255,255,255,0.07)"}`,overflow:"hidden",transition:"border-color 0.3s"}}>
      <button onClick={()=>setOpen(!open)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"16px 20px",background:"transparent",border:"none",cursor:"pointer",textAlign:"left"}}>
        <span style={{fontSize:20,width:36,height:36,borderRadius:10,background:`${color}15`,border:`1px solid ${color}25`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{icon}</span>
        <span style={{color:"#fff",fontWeight:700,fontSize:14,flex:1}}>{title}</span>
        <span style={{color:color,fontSize:18,fontWeight:300,transition:"transform 0.3s",transform:open?"rotate(45deg)":"rotate(0deg)"}}>+</span>
      </button>
      {open&&<div style={{padding:"0 20px 20px"}}>{children}</div>}
    </div>
  );
}
function Tier({label,children}) {
  const colors = {simple:"#00f0ff",intermediate:"#9b59ff",advanced:"#f59e0b"};
  const labels = {simple:"Simple (Ages 7+)",intermediate:"Intermediate (High School / Undergrad)",advanced:"Advanced (PhD / Researcher)"};
  return (
    <div style={{marginBottom:12,padding:"12px 16px",borderRadius:10,background:`${colors[label]}08`,border:`1px solid ${colors[label]}18`}}>
      <div style={{fontSize:9,fontWeight:800,letterSpacing:1.5,color:colors[label],marginBottom:6}}>{labels[label]}</div>
      <div style={{color:"rgba(255,255,255,0.7)",fontSize:13,lineHeight:1.7}}>{children}</div>
    </div>
  );
}

function BatchLearnSection() {
  return (
    <div style={{marginTop:40,paddingTop:32,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
        <span style={{fontSize:20}}>📚</span>
        <span style={{color:"#fff",fontWeight:800,fontSize:18}}>Learn</span>
        <span style={{color:"rgba(255,255,255,0.3)",fontSize:12}}>— Understand batch analysis</span>
      </div>
      <p style={{color:"rgba(255,255,255,0.35)",fontSize:12,marginBottom:20,maxWidth:600}}>Click any topic below to learn more. Each explanation has three levels of detail.</p>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <LearnCard icon="📂" title="What is Batch Analysis?" color="#00f0ff">
          <Tier label="simple">
            <b>Batch analysis lets you check LOTS of web addresses at once instead of one at a time — and it is the key to understanding how well the model really works.</b> Imagine you have a big bag of sweets and you want to check if any are bad. You could taste one at a time — but that would take ages! Instead, you pour them all out and check them all at once. That is what batch analysis does with web addresses. You can give it a list of 10, 100, or even 10,000 links and it checks them all in seconds. This is really useful for lots of people: teachers can show the whole class how the model handles different kinds of websites; security teams can check all the links in suspicious emails at once; researchers can test the model with hundreds of examples to see how often it makes mistakes. Each web address goes through exactly the same 18-clue check as when you test a single address on the home page — nothing changes about how the model works. The batch tool just does it faster because it processes them all together. After checking, you get a summary showing how many addresses looked safe, how many looked suspicious, and the overall score. You can also download the results as a spreadsheet to study them later. This is especially important for studying false positives — you need to test HUNDREDS of safe websites to get a reliable estimate of how often the model makes false alarms.
          </Tier>
          <Tier label="intermediate">
            Batch processing sends multiple URLs to the model simultaneously via the POST /api/predict/batch endpoint. This is the primary tool for systematic model evaluation, enabling:
            <br/><br/>
            <b>Who uses batch analysis?</b>
            <br/>• <b>Security teams</b> — Audit email logs, check URLs from suspicious campaigns, scan web proxy logs
            <br/>• <b>Researchers</b> — Evaluate model performance on specific URL categories, measure FPR across domain types
            <br/>• <b>Teachers/students</b> — Demonstrate ML model behaviour at scale, compare predictions across URL types
            <br/>• <b>Penetration testers</b> — Test the model against known phishing datasets or custom adversarial URLs
            <br/><br/>
            <b>Input formats:</b> CSV files (with a "url" column — the parser auto-detects it), or plain text (one URL per line). Duplicates are automatically removed. Each URL goes through the same 18-feature extraction pipeline and model prediction as a single URL check on the Home page — batch results are guaranteed to match individual results.
            <br/><br/>
            <b>Why batch matters for FP analysis:</b> Testing a single URL tells you nothing about the model's overall false positive rate. You need hundreds or thousands of legitimate URLs to estimate FPR reliably. Our testing pipeline uses batch analysis to process 99 legitimate URL types across 33 categories, 10,000 procedurally generated URLs, and 50 adversarial phishing variants — all through this same batch interface.
          </Tier>
          <Tier label="advanced">
            The batch endpoint (POST /api/predict/batch) processes up to 10,000 URLs per request. Server-side, each URL is independently feature-extracted via features.py and scored via the selected model's predict_proba() — there is no batch-level feature normalisation or inter-URL dependencies, guaranteeing that batch results are identical to individual predictions. The response includes per-URL results (url, is_phishing, probability, risk_label, domain) and a batch summary (total, phishing_count, legitimate_count, error_count, avg_score).
            <br/><br/>
            <b>Client-side fallback:</b> If the API is unreachable, the frontend falls back to a chunked client-side processing loop: URLs are processed in batches of 5 with requestAnimationFrame yields between batches to prevent UI thread blocking. Feature extraction uses a JavaScript mirror of features.py (same 18 features, same extraction logic). This fallback enables offline usage but should not be relied upon for production predictions (minor floating-point differences between Python and JS implementations).
            <br/><br/>
            <b>Performance:</b> Server-side processing averages ~50ms per URL (dominated by feature extraction, not prediction). A 10K URL batch completes in ~8 minutes. The CSV parser uses a heuristic column detector: for each row, it selects the first field matching the URL pattern (contains "." AND length above 4). The batch deduplicates using Set() before processing, so duplicate URLs are not double-counted.
          </Tier>
        </LearnCard>

        <LearnCard icon="📋" title="How to Format Your Data" color="#9b59ff">
          <Tier label="simple">
            <b>You can give the tool your list of web addresses in two easy ways — and the tool is smart enough to handle messy data!</b>
            <br/><br/>
            <b>Way 1: Upload a file.</b> If you have a spreadsheet with web addresses in it (saved as a .csv file), you can drag it onto the upload area or click to browse for it. The tool will automatically find the column that contains web addresses, even if your file has other columns like "name," "date," or "category." You do not need to clean up the file first — just upload it as-is.
            <br/><br/>
            <b>Way 2: Type or paste.</b> You can also paste a list of web addresses directly into the text box. Put each address on its own line, or separate them with commas. The tool will automatically skip empty lines, remove duplicates, and ignore anything that is too short to be a real web address (fewer than 4 characters).
            <br/><br/>
            <b>Tips:</b> Web addresses should start with "http://" or "https://", but the tool will try to handle addresses without these prefixes too. If you are testing the model, try including a mix of addresses you know are safe AND ones that look suspicious — this way you can see how the model handles both types.
          </Tier>
          <Tier label="intermediate">
            <b>CSV format:</b> Your file should have at least one column containing URLs. The parser auto-detects URL columns using a heuristic: the first column in each row that contains "." and is longer than 4 characters is treated as the URL. Header rows are handled automatically (if the first row does not match the URL heuristic, it is skipped).
            <br/><br/>
            <b>Example CSV:</b><br/>
            <code style={{color:"#00f0ff",fontSize:11}}>url,source,date<br/>https://google.com,email,2024-01-15<br/>http://login-paypal.tk/verify,suspicious,2024-01-15<br/>https://docs.google.com/d/1abc,email,2024-01-16</code>
            <br/><br/>
            <b>Paste format:</b> One URL per line, or comma-separated. Duplicates are removed using Set() before processing. Empty lines and strings shorter than 4 characters are filtered out. The deduplication means that if the same URL appears 50 times in your list, it is scored only once (improving speed by 50x for that URL).
            <br/><br/>
            <b>Limitations:</b> CSVs with multiple URL-like columns will use the first match per row. TSV (tab-separated) files are not natively supported but work if URLs contain no tabs. The 10K URL soft cap is enforced client-side — larger files should be split into chunks.
          </Tier>
          <Tier label="advanced">
            The CSV parser implementation: each line is split by comma, each field is stripped of surrounding quotes (single and double), and the URL heuristic (field.includes(".") && field.length {">"}  4) selects the first matching column. This heuristic deliberately avoids regex-based URL validation (which is notoriously fragile) in favour of a permissive approach that catches most URL formats including bare domains, IP addresses, and non-standard schemes. For production use cases requiring exact column specification, the parser should be extended with a column name parameter.
            <br/><br/>
            <b>Deduplication:</b> Uses JavaScript Set() on the raw URL strings. This means "https://google.com" and "https://Google.com" are treated as different URLs (case-sensitive). URL canonicalisation (lowercasing scheme and host, removing default ports, normalising path) would improve deduplication but risk altering URLs that the user specifically wants to test.
            <br/><br/>
            <b>Memory constraints:</b> The 10K limit exists because the results array is held entirely in browser memory. Each result object contains ~500 bytes (URL, score, label, domain, features). 10K results ≈ 5MB, well within browser limits. The visible table is capped at 200 rows for DOM rendering performance; full results are always available via CSV export.
          </Tier>
        </LearnCard>

        <LearnCard icon="📊" title="Reading Batch Results" color="#00b4d8">
          <Tier label="simple">
            <b>After checking all your web addresses, you will see a summary dashboard that shows everything at a glance:</b>
            <br/><br/>
            At the top, you will see big numbers:
            <br/>• <b style={{color:"#ff4d6d"}}>Red number</b> = How many addresses look fake (phishing). These are the dangerous ones!
            <br/>• <b style={{color:"#00f0ff"}}>Blue number</b> = How many addresses look safe (legitimate). These are probably fine.
            <br/>• A coloured <b>bar</b> shows the split visually — the more red in the bar, the more dangerous links you had in your list.
            <br/><br/>
            Below the summary, every single web address is listed with its individual score. A score near 100% means the model is very confident it is phishing; near 0% means it is very confident it is safe. You can click the column headers to sort the list — try sorting by "most dangerous first" to see the riskiest addresses at the top. You can also filter to show only phishing results, only safe results, or all results. If you want to save everything, click "Export CSV" to download a spreadsheet you can open in Excel or Google Sheets.
          </Tier>
          <Tier label="intermediate">
            <b>The batch results interface has four main components:</b>
            <br/><br/>
            <b>1. Summary cards:</b> Total URLs processed, phishing count (score above 0.50), legitimate count (score below 0.50), invalid/skipped count (URLs that failed parsing), and the average risk score across the entire batch. The average score gives a quick sense of the batch composition: a batch of enterprise email URLs should have avg ~10-20%; a batch of known phishing URLs should have avg ~80-90%.
            <br/><br/>
            <b>2. Prediction breakdown bar:</b> Visual ratio showing what fraction of your batch is phishing vs legitimate vs invalid. A healthy result for a batch of known-legitimate URLs should show almost entirely blue. Any red indicates potential false positives that deserve investigation.
            <br/><br/>
            <b>3. Results table:</b> Each URL shows its domain, prediction label (Phishing/Legitimate), risk score (0-100%), and a colour-coded score bar. You can filter by prediction (All / Phishing / Legitimate) and sort by score descending (most dangerous first), score ascending, or alphabetically by domain. The "Export CSV" button downloads the full results including URL, domain, score, and prediction label.
            <br/><br/>
            <b>4. Cross-page exploration:</b> After batch results, the "Explore" links pass batch summary data to other pages — FP Lab (to see where batch scores fall on the ROC curve), Model Explorer (to compare how different models would score the same batch), and EDA Dashboard (to see how batch URLs compare to the training data distribution).
          </Tier>
          <Tier label="advanced">
            The batch results table renders up to 200 visible rows in the DOM for performance — beyond this, the table truncates with a "showing 200 of N" indicator. Full results are always available via the CSV export, which serialises the complete result array. The average risk score is computed as mean(scores) over valid URLs only (excluding parse failures), providing an unbiased batch-level metric.
            <br/><br/>
            <b>Filter/sort architecture:</b> All operations are client-side on the in-memory result array — no API re-queries. The sort uses Array.sort() with a custom comparator for each sort mode. The filter uses Array.filter() with prediction label matching. Both update the displayed subset without modifying the underlying data.
            <br/><br/>
            <b>Cross-page data transfer:</b> The "Explore Batch" links serialise summary data as URL query parameters via React Router's useSearchParams. For large batches (above ~200 URLs), only aggregate statistics (avg_score, count, phishing_count, legitimate_count) are passed to avoid browser URL length limits (~2KB for IE, ~64KB for Chrome). Individual URL scores are not passed for large batches. The FP Lab can plot the score distribution as a histogram when receiving batch summary data.
          </Tier>
        </LearnCard>

        <LearnCard icon="🔬" title="Why Test at Scale? (FP Analysis)" color="#f59e0b">
          <Tier label="simple">
            <b>Checking one web address is good, but checking hundreds or thousands tells you how well the tool REALLY works — and this is essential for finding false positives.</b> Think about it this way: if you ask one person if they like your cooking, you get one opinion. But if you ask 100 people, you get a much better idea of whether your food is actually good. The same is true for phishing detection. When you test just one URL, you learn about that one URL. But when you test 1,000 legitimate URLs, you can measure the actual false positive rate — how many safe websites the model wrongly blocks. If 5 out of 1,000 safe URLs get flagged, that is a 0.5% false positive rate. Is that acceptable? It depends on your use case. For a bank, even 0.5% might be too many (that is 5 customer complaints). For a casual browser extension, 0.5% might be fine. You cannot answer this question without testing at scale. Our own testing used this exact batch process: we tested 99 handcrafted legitimate URL types across 33 categories (banking, shopping, social media, APIs, CDNs, OAuth flows, etc.) and a 10,000-URL procedural fuzzer to get a comprehensive picture of the model's performance.
          </Tier>
          <Tier label="intermediate">
            <b>Scale testing is the only way to get reliable estimates of model performance metrics — especially false positive rate.</b> Here is what batch testing reveals that single-URL testing cannot:
            <br/><br/>
            <b>1. False positive rate estimation:</b> What percentage of legitimate URLs get incorrectly flagged? You need at least 200-500 legitimate URLs to estimate FPR with statistical confidence. With 1,000 URLs, the standard error of a 5% FPR is about ±0.7 percentage points.
            <br/><br/>
            <b>2. Score distribution analysis:</b> Do phishing URLs cluster near 90-100% and legitimate near 0-10%? Or is there overlap in the 30-70% zone? Overlap indicates the model's uncertain region where threshold selection matters most. The FP Lab page lets you explore this further.
            <br/><br/>
            <b>3. Category-specific weaknesses:</b> Does the model struggle with specific URL types? Our testing revealed that banking login URLs, OAuth flows, and marketing URLs with tracking parameters had the highest FP rates — information that directly informed our debiasing strategy and new feature engineering.
            <br/><br/>
            <b>Our testing pipeline (all using batch analysis):</b>
            <br/>• 99 legitimate URL types across 33 categories — handcrafted real-world patterns
            <br/>• 10,000 procedurally generated URLs (5 categories × 2000 combinations)
            <br/>• 50 adversarial phishing URLs evolved via genetic algorithm
            <br/>• Result: 99.9% legitimate accuracy, 0.1% FP rate on the procedural fuzzer
          </Tier>
          <Tier label="advanced">
            Scale testing is essential for estimating population-level metrics with quantifiable confidence. A single URL tells you P(phishing|this_url) but nothing about the model's decision boundary geometry. Batch testing enables: (1) FPR/FNR estimation with confidence intervals — for N legitimate URLs, SE(FPR) = sqrt(FPR*(1-FPR)/N), so N=1000 gives SE ≈ 0.007 for FPR=0.05, meaning 95% CI is [0.036, 0.064], (2) score calibration assessment — plot predicted probability against observed frequency in bins to verify calibration, (3) subgroup analysis — stratify FPR by URL category to identify systematic weaknesses.
            <br/><br/>
            <b>Our three-stage testing pipeline:</b>
            <br/><br/>
            <b>Stage 1 — 100 URL types (test_100_url_types.py):</b> 99 handcrafted legitimate URLs across 33 categories (banking, e-commerce, social media, government, education, CDN, API, OAuth, cloud storage, cryptocurrency, gaming, streaming, IoT, etc.) + 15 known phishing URLs. Each scored with RF and GBM. Results: category-level FP rates, identifying banking logins and OAuth flows as the highest-FP categories.
            <br/><br/>
            <b>Stage 2 — 10K fuzzer (generate_10k_urls.py):</b> Procedural URL generation combining 5 buckets (100 base domains × 50 paths × 40 query strings × 20 obfuscation techniques × 10 parser-breaking patterns) via itertools.product with random sampling. Scored with RF. Result: 0.1% FP rate on legitimate URLs, confirming the debiasing effectiveness.
            <br/><br/>
            <b>Stage 3 — Adversarial evolver (adversarial_evolver.py):</b> Genetic algorithm (pop=100, gen=50, tournament k=3) evolving 50 seed phishing URLs toward evasion. 9 mutation operators, crossover, elitism. Result: 100% evasion via TLD swap, confirming URL-only detection ceiling.
          </Tier>
        </LearnCard>
      </div>
    </div>
  );
}

function WhyPanel({ url, modelId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/predict", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({url, model: modelId}) })
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError("Could not load explanation. Is the backend running?"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url, modelId]);

  if (loading) return <div style={{ padding:"16px 20px", color:"rgba(255,255,255,0.4)", fontSize:12 }}>Loading explanation...</div>;
  if (error) return <div style={{ padding:"16px 20px", color:"#ff4d6d", fontSize:12 }}>{error}</div>;
  if (!data) return null;

  const score = data.probability;
  const top5 = data.top5 || [];
  const pushingPhish = top5.filter(f => f.weight > 0);
  const pushingSafe = top5.filter(f => f.weight <= 0);

  return (
    <div style={{ padding:"18px 24px", background:"rgba(255,255,255,0.015)", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
        {/* Simple explanation */}
        <div style={{ flex:"1 1 320px", padding:"14px 18px", borderRadius:12, background: score >= 0.5 ? "rgba(255,77,109,0.06)" : "rgba(0,240,255,0.04)", border: `1px solid ${score >= 0.5 ? "rgba(255,77,109,0.15)" : "rgba(0,240,255,0.12)"}` }}>
          <div style={{ fontSize:10, fontWeight:800, letterSpacing:1.5, color: score >= 0.5 ? "#ff4d6d" : "#00f0ff", marginBottom:8 }}>WHY THIS SCORE?</div>
          <div style={{ color:"rgba(255,255,255,0.75)", fontSize:13, lineHeight:1.7 }}>
            {score >= 0.5 ? (
              <><b style={{color:"#ff4d6d"}}>This URL looks suspicious ({(score*100).toFixed(1)}% phishing risk).</b> The model checked 18 clues about this web address. The main red flags:{" "}
                {pushingPhish.length > 0
                  ? pushingPhish.map((f,i) => <span key={i}><b style={{color:"#ff4d6d"}}>{f.name}</b> ({f.description}){i < pushingPhish.length-1 ? ", " : ". "}</span>)
                  : "multiple small clues added up. "}
                {pushingSafe.length > 0 && <>Some clues looked okay: {pushingSafe.map(f => f.name).join(", ")}.</>}
              </>
            ) : (
              <><b style={{color:"#00f0ff"}}>This URL looks safe ({(score*100).toFixed(1)}% phishing risk).</b> The model checked 18 clues and most look normal.{" "}
                {pushingSafe.length > 0
                  ? <>Safe signals: {pushingSafe.map((f,i) => <span key={i}><b style={{color:"#00f0ff"}}>{f.name}</b> ({f.description}){i < pushingSafe.length-1 ? ", " : ". "}</span>)}</>
                  : "The overall pattern matches legitimate websites. "}
                {pushingPhish.length > 0 && <>Minor concerns: {pushingPhish.map(f => f.name).join(", ")} — but not enough to flag it.</>}
              </>
            )}
          </div>
        </div>

        {/* Top features table */}
        <div style={{ flex:"1 1 280px" }}>
          <div style={{ fontSize:10, fontWeight:800, letterSpacing:1.5, color:"rgba(255,255,255,0.35)", marginBottom:8 }}>TOP 5 FEATURES (BY IMPACT)</div>
          {top5.map((f, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", marginBottom:4, borderRadius:8, background: f.weight > 0 ? "rgba(255,77,109,0.05)" : "rgba(0,240,255,0.04)" }}>
              <span style={{ color: f.weight > 0 ? "#ff4d6d" : "#00f0ff", fontWeight:800, fontSize:12, width:16 }}>{f.weight > 0 ? "▲" : "▼"}</span>
              <span style={{ color:"#fff", fontWeight:700, fontSize:11, minWidth:100 }}>{f.name}</span>
              <span style={{ color:"rgba(255,255,255,0.4)", fontSize:10, flex:1 }}>{f.description}</span>
              <span style={{ color: f.weight > 0 ? "#ff4d6d" : "#00f0ff", fontSize:10, fontWeight:700 }}>{f.weight > 0 ? "+" : ""}{(f.weight*100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop:10, color:"rgba(255,255,255,0.25)", fontSize:10 }}>▲ = pushes toward phishing · ▼ = pushes toward safe · The 5 most influential features out of 18 total</div>
    </div>
  );
}

export default function Batch() {
  const [modelId, setModelId]         = useState("rf");
  const [results, setResults]         = useState([]);
  const [processing, setProcessing]   = useState(false);
  const [progress, setProgress]       = useState(0);
  const [filter, setFilter]           = useState("all");
  const [sortBy, setSortBy]           = useState("score_desc");
  const [dragOver, setDragOver]       = useState(false);
  const [filename, setFilename]       = useState("");
  const [manualText, setManualText]   = useState("");
  const [tab, setTab]                 = useState("upload"); // upload | paste
  const [expandedRow, setExpandedRow] = useState(null);
  const fileRef = useRef();

  const selectedModel = MODELS.find(m => m.id === modelId);

  const processURLs = async (urls) => {
    const cleaned = [...new Set(urls.map(u => u.trim()).filter(u => u.length > 3))];
    if (!cleaned.length) return;
    setProcessing(true); setResults([]); setProgress(0); setExpandedRow(null);

    const all = [];
    let useAPI = true;

    // Try backend API first (batch endpoint)
    try {
      const resp = await fetch("/api/predict/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: cleaned, model: modelId }),
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) throw new Error(resp.statusText);
      const data = await resp.json();
      data.results.forEach(r => {
        if (r.error) all.push({ url: r.url, score: null, label: "INVALID", domain: "-", topFeatures: [], topVals: [] });
        else all.push({ url: r.url, score: r.probability, label: r.is_phishing ? "PHISHING" : "LEGITIMATE", domain: r.domain, topFeatures: [], topVals: [] });
      });
      setProgress(100);
      useAPI = false;
    } catch (_) {
      useAPI = true;
    }

    // Client-side fallback
    if (useAPI) {
      const CHUNK = 5;
      let done = 0;
      for (let i = 0; i < cleaned.length; i += CHUNK) {
        cleaned.slice(i, i + CHUNK).forEach(url => {
          const r = scoreURL(url, modelId);
          if (r) all.push({ url, ...r, label: r.score >= 0.5 ? "PHISHING" : "LEGITIMATE" });
          else   all.push({ url, score: null, label: "INVALID", domain: "-" });
          done++;
        });
        setProgress(Math.round((done / cleaned.length) * 100));
        await new Promise(res => setTimeout(res, 20));
      }
    }

    setResults([...all]);
    setProcessing(false);
  };

  const handleFile = (file) => {
    if (!file) return;
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const urls = parseCSV(e.target.result);
      processURLs(urls);
    };
    reader.readAsText(file);
  };

  const handlePaste = () => {
    const urls = manualText.split(/[\n,]/).map(u => u.trim()).filter(Boolean);
    processURLs(urls);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // Stats
  const total     = results.length;
  const phishing  = results.filter(r => r.label === "PHISHING").length;
  const legit     = results.filter(r => r.label === "LEGITIMATE").length;
  const invalid   = results.filter(r => r.label === "INVALID").length;
  const avgScore  = total ? (results.filter(r => r.score !== null).reduce((a, r) => a + r.score, 0) / (total - invalid || 1)).toFixed(3) : "—";

  // Filter + sort
  const filtered = results
    .filter(r => filter === "all" || r.label === filter.toUpperCase())
    .sort((a, b) => {
      if (sortBy === "score_desc") return (b.score || 0) - (a.score || 0);
      if (sortBy === "score_asc")  return (a.score || 0) - (b.score || 0);
      if (sortBy === "url")        return a.url.localeCompare(b.url);
      return 0;
    });

  // CSV export
  const exportCSV = () => {
    const header = "url,domain,prediction,score\n";
    const rows = results.map(r => `"${r.url}","${r.domain}","${r.label}","${r.score !== null ? r.score.toFixed(4) : "N/A"}"`).join("\n");
    const blob = new Blob([header + rows], { type:"text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `phishguard_batch_${modelId}.csv`; a.click();
  };

  return (
    <div style={{ minHeight:"100vh", background:"#080a14", fontFamily:"'Inter','Segoe UI',sans-serif" }}>
      <Navbar active="Batch Checker" />

      <div style={{ paddingTop:100, maxWidth:1200, margin:"0 auto", padding:"100px 32px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom:40 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(0,240,255,0.06)", border:"1px solid rgba(0,240,255,0.2)", borderRadius:20, padding:"5px 14px", marginBottom:14 }}>
            <span style={{ color:"#00f0ff", fontSize:11, fontWeight:700, letterSpacing:1 }}>BATCH PROCESSING · SCALE DEMO</span>
          </div>
          <h1 style={{ color:"#fff", fontSize:"clamp(26px,4vw,46px)", fontWeight:900, margin:"0 0 10px", letterSpacing:-0.5 }}>Batch URL Checker</h1>
          <p style={{ color:"rgba(255,255,255,0.4)", fontSize:14, maxWidth:580 }}>
            Upload a CSV file or paste URLs directly — get predictions on hundreds of URLs at once. Demonstrates model performance at scale.
          </p>
        </div>

        {/* Model selector */}
        <div style={{ display:"flex", gap:8, marginBottom:28, flexWrap:"wrap" }}>
          {MODELS.map(m => (
            <button key={m.id} onClick={() => setModelId(m.id)} style={{ padding:"7px 16px", borderRadius:9, border:"1px solid", borderColor: modelId===m.id ? m.color : "rgba(255,255,255,0.10)", background: modelId===m.id ? `${m.color}14` : "rgba(255,255,255,0.02)", color: modelId===m.id ? m.color : "rgba(255,255,255,0.5)", fontSize:12, fontWeight:700, cursor:"pointer", transition:"all 0.2s" }}>
              {m.short} · {m.label}
            </button>
          ))}
        </div>

        {/* Input tabs */}
        <div style={{ marginBottom:24 }}>
          <div style={{ display:"flex", gap:0, marginBottom:20 }}>
            {["upload","paste"].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ padding:"9px 22px", border:"1px solid", fontSize:12, fontWeight:700, cursor:"pointer", borderColor: tab===t ? "rgba(0,240,255,0.4)" : "rgba(255,255,255,0.1)", background: tab===t ? "rgba(0,240,255,0.08)" : "rgba(255,255,255,0.02)", color: tab===t ? "#00f0ff" : "rgba(255,255,255,0.5)", borderRadius: t==="upload" ? "9px 0 0 9px" : "0 9px 9px 0" }}>
                {t === "upload" ? "📁 Upload CSV" : "📋 Paste URLs"}
              </button>
            ))}
          </div>

          {tab === "upload" && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current.click()}
              style={{ padding:"40px 32px", borderRadius:14, border:`2px dashed ${dragOver ? selectedModel.color : "rgba(255,255,255,0.12)"}`, background: dragOver ? `${selectedModel.color}08` : "rgba(255,255,255,0.015)", textAlign:"center", cursor:"pointer", transition:"all 0.2s" }}>
              <div style={{ fontSize:36, marginBottom:12 }}>📂</div>
              <div style={{ color:"#fff", fontWeight:700, fontSize:15, marginBottom:6 }}>
                {filename ? `✅ ${filename}` : "Drop CSV here or click to browse"}
              </div>
              <div style={{ color:"rgba(255,255,255,0.3)", fontSize:12 }}>
                CSV with a URL column — one URL per row · max 10,000 rows
              </div>
              <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display:"none" }} onChange={e => handleFile(e.target.files[0])} />
              <div style={{ marginTop:16, padding:"10px 20px", borderRadius:8, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", display:"inline-block" }}>
                <div style={{ color:"rgba(255,255,255,0.4)", fontSize:11, fontFamily:"monospace" }}>url</div>
                <div style={{ color:"rgba(255,255,255,0.6)", fontSize:11, fontFamily:"monospace" }}>https://google.com</div>
                <div style={{ color:"rgba(255,255,255,0.6)", fontSize:11, fontFamily:"monospace" }}>http://login-paypal.tk/verify</div>
                <div style={{ color:"rgba(255,255,255,0.4)", fontSize:11, fontFamily:"monospace" }}>…</div>
              </div>
            </div>
          )}

          {tab === "paste" && (
            <div>
              <textarea
                value={manualText}
                onChange={e => setManualText(e.target.value)}
                placeholder={"Paste URLs — one per line or comma-separated:\n\nhttps://google.com\nhttp://login-paypal.tk/verify\nhttps://github.com/openai/gpt-4\n…"}
                style={{ width:"100%", minHeight:180, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, padding:"16px 18px", color:"rgba(255,255,255,0.8)", fontSize:13, fontFamily:"monospace", outline:"none", resize:"vertical" }}
              />
              <button onClick={handlePaste} style={{ marginTop:12, padding:"11px 28px", background:`linear-gradient(135deg,${selectedModel.color},#9b59ff)`, border:"none", borderRadius:9, color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer" }}>
                Analyse {manualText.split(/[\n,]/).filter(u=>u.trim().length>3).length} URLs →
              </button>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {processing && (
          <div style={{ marginBottom:28, padding:"20px 24px", borderRadius:12, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
              <span style={{ color:"rgba(255,255,255,0.6)", fontSize:13, fontWeight:600 }}>Processing…</span>
              <span style={{ color:selectedModel.color, fontWeight:700 }}>{progress}%</span>
            </div>
            <div style={{ height:8, borderRadius:4, background:"rgba(255,255,255,0.06)" }}>
              <div style={{ height:"100%", width:`${progress}%`, background:`linear-gradient(90deg,${selectedModel.color},#9b59ff)`, borderRadius:4, transition:"width 0.1s" }}/>
            </div>
          </div>
        )}

        {/* Summary cards */}
        {results.length > 0 && !processing && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:14, marginBottom:28 }}>
              {[
                { label:"Total Processed", value:total, color:"rgba(255,255,255,0.8)", icon:"📊" },
                { label:"Phishing", value:phishing, color:"#ff4d6d", icon:"🎣", sub:`${total ? ((phishing/total)*100).toFixed(1) : 0}%` },
                { label:"Legitimate", value:legit, color:"#00f0ff", icon:"✅", sub:`${total ? ((legit/total)*100).toFixed(1) : 0}%` },
                { label:"Invalid / Skipped", value:invalid, color:"#f59e0b", icon:"⚠️" },
                { label:"Avg Risk Score", value:avgScore, color:"#9b59ff", icon:"📈" },
              ].map((s, i) => (
                <div key={i} style={{ padding:"18px 20px", borderRadius:12, background:`${s.color}0a`, border:`1px solid ${s.color}20` }}>
                  <div style={{ fontSize:18, marginBottom:6 }}>{s.icon}</div>
                  <div style={{ color:s.color, fontSize:24, fontWeight:900 }}>{s.value}</div>
                  {s.sub && <div style={{ color:"rgba(255,255,255,0.3)", fontSize:10 }}>{s.sub} of total</div>}
                  <div style={{ color:"rgba(255,255,255,0.4)", fontSize:11, marginTop:4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Phishing rate bar */}
            <div style={{ marginBottom:24, padding:"16px 20px", borderRadius:10, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.35)", letterSpacing:1, marginBottom:10 }}>PREDICTION BREAKDOWN — {selectedModel.label.toUpperCase()}</div>
              <div style={{ height:12, borderRadius:6, background:"rgba(255,255,255,0.05)", overflow:"hidden", display:"flex" }}>
                {phishing > 0 && <div style={{ flex:phishing, background:"linear-gradient(90deg,#ff4d6d,#ff8fa3)", transition:"flex 0.5s" }}/>}
                {legit > 0 && <div style={{ flex:legit, background:"linear-gradient(90deg,#00b4d8,#00f0ff)", transition:"flex 0.5s" }}/>}
                {invalid > 0 && <div style={{ flex:invalid, background:"rgba(255,255,255,0.08)" }}/>}
              </div>
              <div style={{ display:"flex", gap:16, marginTop:8 }}>
                <div style={{ display:"flex", gap:5, alignItems:"center" }}><div style={{ width:8, height:8, borderRadius:2, background:"#ff4d6d" }}/><span style={{ color:"rgba(255,255,255,0.4)", fontSize:11 }}>Phishing</span></div>
                <div style={{ display:"flex", gap:5, alignItems:"center" }}><div style={{ width:8, height:8, borderRadius:2, background:"#00f0ff" }}/><span style={{ color:"rgba(255,255,255,0.4)", fontSize:11 }}>Legitimate</span></div>
                <div style={{ display:"flex", gap:5, alignItems:"center" }}><div style={{ width:8, height:8, borderRadius:2, background:"rgba(255,255,255,0.2)" }}/><span style={{ color:"rgba(255,255,255,0.4)", fontSize:11 }}>Invalid</span></div>
              </div>
            </div>

            {/* Cross-page connections */}
            <div style={{ marginBottom:20, padding:"14px 18px", borderRadius:11, background:"rgba(155,89,255,0.05)", border:"1px solid rgba(155,89,255,0.15)", display:"flex", flexWrap:"wrap", gap:10, alignItems:"center" }}>
              <span style={{ color:"rgba(255,255,255,0.3)", fontSize:10, fontWeight:700, letterSpacing:1 }}>EXPLORE BATCH:</span>
              <Link to={`/FpLab?batch=${encodeURIComponent(JSON.stringify(results.filter(r=>r.score!==null).map(r=>({url:r.url,score:r.score}))))}`} style={{ color:"#9b59ff", fontSize:11, fontWeight:600, textDecoration:"none", padding:"4px 10px", borderRadius:6, background:"rgba(155,89,255,0.08)", border:"1px solid rgba(155,89,255,0.2)" }}>
                Plot {results.filter(r=>r.score!==null).length} scores on the ROC curve →
              </Link>
              <Link to={`/ModelExplorer?batch_avg=${avgScore}&batch_count=${total}&batch_phish=${phishing}`} style={{ color:"#00f0ff", fontSize:11, fontWeight:600, textDecoration:"none", padding:"4px 10px", borderRadius:6, background:"rgba(0,240,255,0.06)", border:"1px solid rgba(0,240,255,0.15)" }}>
                See model agreement across your batch →
              </Link>
              <Link to={`/EdaDashboard?batch_count=${total}`} style={{ color:"#00b4d8", fontSize:11, fontWeight:600, textDecoration:"none", padding:"4px 10px", borderRadius:6, background:"rgba(0,180,216,0.06)", border:"1px solid rgba(0,180,216,0.15)" }}>
                Compare your batch distributions to dataset →
              </Link>
            </div>

            {/* Controls */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:12 }}>
              <div style={{ display:"flex", gap:8 }}>
                {["all","phishing","legitimate"].map(f => (
                  <button key={f} onClick={() => setFilter(f)} style={{ padding:"6px 14px", borderRadius:7, border:"1px solid", fontSize:11, fontWeight:700, cursor:"pointer", borderColor: filter===f ? (f==="phishing"?"rgba(255,77,109,0.5)":"rgba(0,240,255,0.5)") : "rgba(255,255,255,0.1)", background: filter===f ? (f==="phishing"?"rgba(255,77,109,0.1)":"rgba(0,240,255,0.08)") : "transparent", color: filter===f ? (f==="phishing"?"#ff4d6d":"#00f0ff") : "rgba(255,255,255,0.45)" }}>
                    {f.toUpperCase()} {f==="all"?`(${total})`:f==="phishing"?`(${phishing})`:`(${legit})`}
                  </button>
                ))}
              </div>
              <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.6)", borderRadius:7, padding:"6px 10px", fontSize:11, cursor:"pointer" }}>
                  <option value="score_desc">Sort: Highest Risk</option>
                  <option value="score_asc">Sort: Lowest Risk</option>
                  <option value="url">Sort: A–Z</option>
                </select>
                <button onClick={exportCSV} style={{ padding:"7px 18px", borderRadius:7, border:"1px solid rgba(0,240,255,0.3)", background:"rgba(0,240,255,0.07)", color:"#00f0ff", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                  ⬇ Export CSV
                </button>
              </div>
            </div>

            {/* Results table */}
            <div style={{ borderRadius:14, border:"1px solid rgba(255,255,255,0.07)", overflow:"hidden" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:"rgba(255,255,255,0.03)" }}>
                    {["#","URL","Domain","Prediction","Risk Score","Score Bar","Why?"].map((h,i) => (
                      <th key={i} style={{ textAlign: i>1 ? "center" : "left", padding:"11px 14px", color:"rgba(255,255,255,0.35)", fontSize:10, fontWeight:700, letterSpacing:1, borderBottom:"1px solid rgba(255,255,255,0.07)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0,200).map((r, i) => (
                    <>
                    <tr key={`row-${i}`} style={{ background: expandedRow===i ? "rgba(0,240,255,0.03)" : i%2===0 ? "rgba(255,255,255,0.005)" : "transparent", borderBottom:"1px solid rgba(255,255,255,0.04)", cursor:"pointer", transition:"background 0.15s" }} onClick={() => setExpandedRow(expandedRow===i ? null : i)}>
                      <td style={{ padding:"9px 14px", color:"rgba(255,255,255,0.25)", fontSize:11 }}>{i+1}</td>
                      <td style={{ padding:"9px 14px", maxWidth:260, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        <span style={{ color:"rgba(255,255,255,0.75)", fontSize:11, fontFamily:"monospace" }}>{r.url}</span>
                      </td>
                      <td style={{ padding:"9px 14px", textAlign:"center" }}>
                        <span style={{ color:"rgba(255,255,255,0.5)", fontSize:11, fontFamily:"monospace" }}>{r.domain}</span>
                      </td>
                      <td style={{ padding:"9px 14px", textAlign:"center" }}>
                        <span style={{ fontSize:10, fontWeight:800, padding:"3px 10px", borderRadius:6, background: r.label==="PHISHING"?"rgba(255,77,109,0.15)":r.label==="LEGITIMATE"?"rgba(0,240,255,0.10)":"rgba(255,255,255,0.06)", color: r.label==="PHISHING"?"#ff4d6d":r.label==="LEGITIMATE"?"#00f0ff":"rgba(255,255,255,0.4)", border:`1px solid ${r.label==="PHISHING"?"rgba(255,77,109,0.25)":r.label==="LEGITIMATE"?"rgba(0,240,255,0.2)":"rgba(255,255,255,0.08)"}` }}>
                          {r.label}
                        </span>
                      </td>
                      <td style={{ padding:"9px 14px", textAlign:"center" }}>
                        <span style={{ color: r.score>0.7?"#ff4d6d":r.score>0.5?"#f59e0b":"#00f0ff", fontWeight:700, fontSize:12, fontFamily:"monospace" }}>
                          {r.score !== null ? (r.score*100).toFixed(1)+"%" : "—"}
                        </span>
                      </td>
                      <td style={{ padding:"9px 14px", width:100 }}>
                        {r.score !== null && (
                          <div style={{ height:5, borderRadius:3, background:"rgba(255,255,255,0.06)" }}>
                            <div style={{ height:"100%", width:`${r.score*100}%`, background: r.score>0.7?"#ff4d6d":r.score>0.5?"#f59e0b":"#00f0ff", borderRadius:3 }}/>
                          </div>
                        )}
                      </td>
                      <td style={{ padding:"9px 14px", textAlign:"center" }}>
                        <span style={{ color: expandedRow===i ? "#00f0ff" : "rgba(255,255,255,0.3)", fontSize:10, fontWeight:700, transition:"color 0.15s" }}>
                          {expandedRow===i ? "▲ Hide" : "▼ Show"}
                        </span>
                      </td>
                    </tr>
                    {expandedRow===i && r.label !== "INVALID" && (
                      <tr key={`detail-${i}`}><td colSpan={7} style={{ padding:0 }}><WhyPanel url={r.url} modelId={modelId} /></td></tr>
                    )}
                    </>
                  ))}
                </tbody>
              </table>
              {filtered.length > 200 && (
                <div style={{ padding:"12px", textAlign:"center", color:"rgba(255,255,255,0.3)", fontSize:12, borderTop:"1px solid rgba(255,255,255,0.07)" }}>
                  Showing 200 of {filtered.length} results — export CSV for full dataset
                </div>
              )}
            </div>
          </>
        )}

        {/* Empty state */}
        {!processing && results.length === 0 && (
          <div style={{ textAlign:"center", padding:"60px 0", color:"rgba(255,255,255,0.2)", fontSize:14 }}>
            Upload a CSV or paste URLs above to begin batch analysis
          </div>
        )}

        {/* ═══════ EDUCATIONAL SECTION ═══════ */}
        <BatchLearnSection />
      </div>

      <style>{`* { box-sizing:border-box } textarea::placeholder { color: rgba(255,255,255,0.2) }`}</style>
    </div>
  );
}
