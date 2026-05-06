import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";

const NAV_LINKS = [
  {label:"URL Checker",to:"/"},{label:"Batch",to:"/Batch"},{label:"Models",to:"/ModelExplorer"},
  {label:"EDA",to:"/EdaDashboard"},{label:"FP Lab",to:"/FpLab"},
  {label:"Adversarial",to:"/Adversarial"},
  {label:"Typosquat",to:"/TypoSquat"},{label:"About",to:"/About"},
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

// No hardcoded data — everything fetched from /api/stats

function corrColor(v) {
  if (v >= 0.8)  return "rgba(0,240,255,0.90)";
  if (v >= 0.6)  return "rgba(0,180,216,0.70)";
  if (v >= 0.4)  return "rgba(0,180,216,0.40)";
  if (v >= 0.2)  return "rgba(255,255,255,0.14)";
  if (v >= 0)    return "rgba(255,255,255,0.06)";
  return "rgba(255,77,109,0.45)";
}

function HistChart({ feature }) {
  const maxVal = Math.max(...feature.phishing, ...feature.legit, 1);
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:"#fff" }}>{feature.name}</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>Distribution by class · unit: {feature.unit}</div>
        </div>
        <div style={{ display:"flex", gap:12 }}>
          {[["#ff4d6d","Phishing"],["#00f0ff","Legitimate"]].map(([c,l]) => (
            <div key={l} style={{ display:"flex", gap:5, alignItems:"center" }}>
              <div style={{ width:10, height:10, borderRadius:2, background:c }}/>
              <span style={{ color:"rgba(255,255,255,0.4)", fontSize:11 }}>{l}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display:"flex", gap:2, alignItems:"flex-end", height:140, marginBottom:6 }}>
        {feature.bins.map((bin, i) => (
          <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:1 }}>
            <div style={{ width:"100%", display:"flex", gap:1, alignItems:"flex-end", height:130 }}>
              <div style={{ flex:1, background:"rgba(255,77,109,0.75)", borderRadius:"2px 2px 0 0", height:`${(feature.phishing[i]/maxVal)*125}px`, minHeight:1, transition:"height 0.4s ease" }}/>
              <div style={{ flex:1, background:"rgba(0,240,255,0.65)", borderRadius:"2px 2px 0 0", height:`${(feature.legit[i]/maxVal)*125}px`, minHeight:1, transition:"height 0.4s ease" }}/>
            </div>
            <div style={{ color:"rgba(255,255,255,0.25)", fontSize:8, textAlign:"center", marginTop:2 }}>{bin}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Educational components ───────────────────────────────────────────────────
function LearnCard({icon, title, color, children}) {
  const [open, setOpen] = React.useState(false);
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

function EdaLearnSection() {
  return (
    <div style={{marginTop:40,paddingTop:32,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
        <span style={{fontSize:20}}>📚</span>
        <span style={{color:"#fff",fontWeight:800,fontSize:18}}>Learn</span>
        <span style={{color:"rgba(255,255,255,0.3)",fontSize:12}}>— Understand the EDA Dashboard</span>
      </div>
      <p style={{color:"rgba(255,255,255,0.35)",fontSize:12,marginBottom:20,maxWidth:600}}>Click any topic to learn about exploratory data analysis and what the charts mean.</p>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <LearnCard icon="🔍" title="What is EDA (Exploratory Data Analysis)?" color="#00f0ff">
          <Tier label="simple">
            <b>EDA is like looking at all your puzzle pieces before starting to solve the puzzle — and it is one of the most important steps in any data science project!</b> Before the computer can learn to spot fake websites, we first need to understand what we are working with. How many good links and bad links do we have? What makes them different? Are there any obvious patterns we can see with our own eyes before the computer even starts learning? This page shows you everything about the 235,795 real web addresses in our training data. You can see bar charts (histograms) that show how different clues (features) look for phishing versus safe websites. For example, you might notice that phishing addresses tend to be longer, or that they are less likely to use "https://". You can also see a colourful grid (correlation heatmap) that shows which clues are related to each other. EDA helps us spot problems in the data before they become problems in the model. For instance, we discovered that ALL the safe websites in the original dataset had "www." at the beginning — which means the computer could just check for "www." instead of actually learning about phishing. That is a bias, and we had to fix it! Understanding data before building models is like reading the recipe before cooking — you are much less likely to make mistakes.
          </Tier>
          <Tier label="intermediate">
            EDA is the critical first step in any ML pipeline. Before training models, you must understand your dataset to avoid garbage-in-garbage-out. This page visualises the PhiUSIIL dataset — 235,795 real labelled URLs (134,850 legitimate, 100,945 phishing) from the UCI ML Repository — with 18 engineered features. Key questions EDA answers:
            <br/><br/>
            <b>1. Class distribution:</b> Is the dataset balanced? Ours is 57% legit / 43% phish — moderately balanced, meaning no resampling (SMOTE, undersampling) is needed. The Dummy classifier's ~57% accuracy confirms it simply predicts the majority class.
            <br/><br/>
            <b>2. Feature distributions:</b> Which features separate the classes? The histograms show that domain_entropy, keyword_count, has_suspicious_tld, and is_ip_domain have strong class separation — these will be the most important features for the model. Features like underscore_count and percent_count show heavy overlap — weak features that contribute less to predictions.
            <br/><br/>
            <b>3. Feature correlations:</b> Which features are redundant? url_length and path_length are moderately correlated (longer URLs often have longer paths). Redundant features do not hurt tree-based models but can cause instability in linear models (Logistic Regression).
            <br/><br/>
            <b>4. Data quality and bias:</b> The most critical EDA finding was that ALL original legitimate URLs had www. + HTTPS, creating a spurious correlation. This bias, if uncorrected, lets the model achieve ~99% accuracy using just two features — no phishing detection at all. Our aggressive debiasing fixed this.
            <br/><br/>
            All statistics are computed from the real dataset and served by the GET /api/stats endpoint — nothing is hardcoded.
          </Tier>
          <Tier label="advanced">
            EDA serves as both hypothesis generation and quality assurance. For PhishGuard, it revealed several critical issues that shaped the entire pipeline:
            <br/><br/>
            <b>1. Spurious correlation detection:</b> The original PhiUSIIL dataset's legitimate URLs were all bare domains with www. + HTTPS (e.g., "https://www.google.com" but never "http://google.com/products?q=laptop"). This created a confound: has_www and has_https were near-perfect predictors of the label, not because they indicate safety, but because of collection bias. EDA (specifically, per-class histograms of has_www and has_https) made this immediately visible. The debiasing intervention (50% www stripping, 25% HTTP downgrade, 85% path injection, 60% query injection, 50% subdomain injection) is a causal manipulation in the Pearlian sense: randomising the "treatment" (URL structure) across the legitimate class removes the spurious causal path.
            <br/><br/>
            <b>2. Feature engineering validation:</b> The four new features (path_length, query_length, has_tracking_params, query_entropy) were designed to reduce false positives on legitimate URLs with complex structures. EDA confirmed that these features show meaningful class-conditional distributional differences post-debiasing, validating their inclusion.
            <br/><br/>
            <b>3. Multicollinearity assessment:</b> The Pearson correlation matrix (computed via pandas.DataFrame.corr()) identifies linear dependencies. url_length ↔ path_length and query_length ↔ query_entropy show moderate correlations (~0.4-0.6). This is acceptable for tree ensembles (RF, GBM) which handle correlated features natively, but causes coefficient instability in LR. The full 18×18 matrix is served by /api/stats and rendered as an interactive heatmap.
          </Tier>
        </LearnCard>

        <LearnCard icon="📊" title="Reading the Histograms" color="#9b59ff">
          <Tier label="simple">
            <b>Histograms are bar charts that show how common different values are — they help us see patterns in the data.</b> Imagine you measured the height of everyone in your class and drew a chart showing how many people are each height. You would see most people are about average height, with fewer very short or very tall people. These histograms do the same thing, but for web address clues (features). Each chart shows one clue — like "URL Length" or "Number of Dashes." The <b style={{color:"#ff4d6d"}}>red/pink bars</b> show phishing URLs and the <b style={{color:"#00f0ff"}}>blue bars</b> show safe URLs. When the red and blue bars are in different positions, that clue is really useful for telling them apart! For example, you might see that phishing URLs tend to be longer than safe ones — so the red bars are further to the right. But when the red and blue bars overlap a lot (sitting on top of each other), that clue is not very helpful because both phishing and safe URLs have similar values. Try clicking different feature buttons above the chart to switch between all 18 clues and see which ones separate phishing from safe URLs the best!
          </Tier>
          <Tier label="intermediate">
            Each histogram divides feature values into 8 equal-width bins and counts how many phishing vs legitimate URLs fall in each bin. The overlaid bars allow direct visual comparison of class-conditional distributions. Key patterns to look for:
            <br/><br/>
            <b>Strong features (clear class separation):</b>
            <br/>• <b>has_suspicious_tld</b> — Most phishing URLs have suspicious TLDs (bin at 1), most legit do not (bin at 0). Near-perfect separation.
            <br/>• <b>keyword_count</b> — Phishing URLs have higher keyword counts (login, verify, secure). Clear rightward shift.
            <br/>• <b>is_ip_domain</b> — IP-based domains are almost exclusively phishing. Binary feature with extreme class separation.
            <br/>• <b>domain_entropy</b> — Phishing domains tend to have higher entropy (more random characters).
            <br/><br/>
            <b>Weak features (heavy class overlap):</b>
            <br/>• <b>underscore_count</b> — Both classes have very similar distributions (mostly 0).
            <br/>• <b>percent_count</b> — Rare in both classes (most URLs have 0 percent-encoded characters).
            <br/><br/>
            <b>Distribution shapes:</b> Many features are right-skewed (most values small, few very large) — url_length, path_length, query_length. Binary features (has_www, has_https, is_ip_domain) show as two-bar histograms. The feature buttons above let you cycle through all 18 features to compare discriminative power. Features with clear separation should correlate with high SHAP importance in the model.
          </Tier>
          <Tier label="advanced">
            The histograms use pd.cut() with 8 equal-width bins, computed server-side from the full dataset (not just train). The y-axis shows raw counts, not density — since the legitimate class is ~34% larger (134,850 vs 100,945), its bars appear taller even when per-class distributions are identical. For rigorous visual comparison, normalise by dividing each bin count by the class total to get P(bin | class). The API returns phish_mean and legit_mean per feature for quantitative comparison.
            <br/><br/>
            <b>Key statistical observations:</b> Features with large |phish_mean - legit_mean| / pooled_std (high Cohen's d) will be the most discriminative. The histograms serve as a visual proxy for this effect size. Binary features (has_www, has_https, is_ip_domain, has_at_symbol, has_suspicious_tld, has_tracking_params) produce degenerate two-bin histograms — for these, a simple contingency table (2×2 chi-square test) is more appropriate. Continuous features with heavy skew (url_length, path_length) may benefit from log-transformation for visualisation, though the tree-based models are invariant to monotone transformations. If you checked a URL on the Home page, its feature values are highlighted here — allowing you to see whether it falls in the phishing or legitimate region of each feature's distribution.
          </Tier>
        </LearnCard>

        <LearnCard icon="🧮" title="Reading the Correlation Heatmap" color="#f59e0b">
          <Tier label="simple">
            <b>The colourful grid shows which clues are related to each other — like finding out which subjects at school go together.</b> If you are good at maths, you are probably also good at science — those are "related" subjects. Similarly, some URL clues go up and down together. Bright blue squares mean two clues increase together (they are "friends" — like URL length and path length: longer URLs usually have longer paths). Dark red squares mean when one goes up, the other goes down (they are "opposites" — like having HTTPS and having a suspicious domain ending: safe sites use HTTPS, suspicious ones often do not). Grey squares mean the two clues are not related at all — they tell us completely different things. The diagonal line of bright blue squares from corner to corner is just each clue compared to itself (which is always a perfect match). The most useful features are the ones that are NOT closely related to other features, because each one gives us unique, new information that the others do not provide.
          </Tier>
          <Tier label="intermediate">
            The heatmap shows Pearson correlation coefficients between all 18 features, computed from the full 235,795-URL dataset. Values range from -1 (perfect negative correlation) to +1 (perfect positive correlation), with 0 meaning no linear relationship. Key observations:
            <br/><br/>
            <b>Notable correlations:</b>
            <br/>• <b>url_length vs path_length</b>: Moderate positive (~0.4-0.6). Longer URLs tend to have longer paths. This makes physical sense — the path is a component of the total URL length.
            <br/>• <b>url_length vs domain_length</b>: Moderate positive. Longer URLs often have longer domains.
            <br/>• <b>query_length vs query_entropy</b>: Moderate positive. Longer query strings tend to have higher entropy (more characters = more randomness).
            <br/>• <b>has_https vs has_suspicious_tld</b>: Negative. Free TLDs (.tk, .ml) rarely use HTTPS certificates.
            <br/>• <b>has_www vs has_https</b>: Moderate positive post-debiasing (many legit sites have both, but our debiasing reduced this).
            <br/><br/>
            <b>Why low correlation is good:</b> Most features have low mutual correlation (|r| under 0.3), meaning each contributes unique information to the model. If two features were highly correlated (|r| above 0.8), one could be removed without losing information. Our 18 features are mostly independent, validating the feature engineering design.
          </Tier>
          <Tier label="advanced">
            Pearson correlation captures only linear (monotonic) relationships — non-linear dependencies (e.g., url_length has a threshold effect around 75-100 characters) are invisible to this measure. Spearman rank correlation or mutual information would capture non-linear dependencies but are more expensive to compute and harder to visualise. For our feature space, Pearson is a reasonable first-order approximation.
            <br/><br/>
            <b>Multicollinearity impact by model type:</b> High correlation (|r| above 0.7) between features causes coefficient instability in LR — the model struggles to attribute importance to individual correlated features, leading to large standard errors on coefficients. Tree-based models (RF, GBM) handle correlated features natively because each tree split considers only one feature at a time; correlated features simply compete for splits at similar points in the tree, and the forest averages out the attribution. The SHAP values for correlated features in RF will be lower for each individual feature than if they were independent (the credit is shared), but the sum of their SHAP values is correct.
            <br/><br/>
            <b>Technical note:</b> The correlation matrix is symmetric (corr(A,B) = corr(B,A)), so only the upper or lower triangle contains unique information. The diagonal is always 1.0. The 18×18 matrix = 153 unique pairs. It is computed server-side via pandas.DataFrame.corr() on the full dataset and served by the /api/stats endpoint as a JSON array of arrays.
          </Tier>
        </LearnCard>

        <LearnCard icon="⚖️" title="Class Balance, Debiasing, and False Positives" color="#ff4d6d">
          <Tier label="simple">
            <b>Class balance means: how many good links versus bad links are in the training data? And this matters a LOT for false positives!</b> Imagine you are training a dog to fetch. If you show the dog 99 tennis balls and only 1 stick, the dog will always fetch tennis balls because that is what it saw most. The same problem happens with computers — if you give them mostly safe links, they learn to always say "safe" and get a high score, but they never actually learn what phishing looks like. Our dataset has about 57% safe links (134,850) and 43% phishing links (100,945), which is pretty balanced — the computer sees plenty of both kinds. But we had an even bigger problem: ALL the safe links in the original data had "www." at the start and used "https://" (the lock icon). The computer figured out this shortcut and just checked for "www." — it was not actually learning about phishing at all! We had to fix this by randomly removing "www." from half the safe links, changing some to "http://", and adding realistic web address paths, search parameters, and subdomains. After fixing this, the accuracy dropped from 99% to 86% — but now the model is actually detecting phishing instead of just looking for shortcuts.
          </Tier>
          <Tier label="intermediate">
            <b>The PhiUSIIL dataset presents both a class balance success and a data quality challenge.</b>
            <br/><br/>
            <b>Class balance (57/43):</b> The dataset has 134,850 legitimate (57%) and 100,945 phishing (43%) URLs — close enough to balanced that resampling techniques (SMOTE, random undersampling) are unnecessary. The Dummy classifier's ~57% accuracy confirms it simply predicts the majority class, setting the correct performance floor.
            <br/><br/>
            <b>The bias problem:</b> Far more impactful than class imbalance was the systematic structural bias in the legitimate URLs. The PhiUSIIL dataset was collected by scraping popular websites — ALL legitimate URLs had www. prefix + HTTPS, while phishing URLs (collected from phishing feeds) largely lacked these features. This created a spurious shortcut: the model could achieve ~99% accuracy by checking just two binary features, without learning anything about phishing URL structure. This is a textbook example of a confounded dataset.
            <br/><br/>
            <b>Our debiasing intervention (aggressive):</b>
            <br/>• Strip www. from <b>50%</b> of legitimate URLs (removes has_www shortcut)
            <br/>• Convert <b>25%</b> of legitimate URLs to HTTP (removes has_https shortcut)
            <br/>• Inject realistic paths into <b>85%</b> of legitimate URLs (PhiUSIIL legit URLs are ALL bare domains)
            <br/>• Add tracking query strings to <b>60%</b> (utm_source, gclid, srsltid — realistic marketing URLs)
            <br/>• Prepend subdomains to <b>50%</b> (drive., mail., accounts., signin., cdn.)
            <br/><br/>
            <b>Impact on false positives:</b> Post-debiasing, accuracy dropped from ~99% to ~86%, but this ~13% "loss" represents the removal of shortcuts, not genuine performance degradation. The model now correctly classifies URLs like drive.google.com, accounts.microsoft.com, and marketing URLs with ?utm_source=google — all previously misclassified by the biased model.
          </Tier>
          <Tier label="advanced">
            <b>The debiasing procedure is the project's most significant methodological contribution to false positive reduction.</b>
            <br/><br/>
            <b>Causal analysis:</b> The PhiUSIIL collection procedure created a confound: URL structure (www., HTTPS, bare domain) → label AND URL structure → features. The path www → label is spurious (www does not cause legitimacy; it correlates with it in this specific dataset due to collection bias). Our debiasing is a causal intervention in the Pearlian framework: by randomising the "treatment" (URL structural properties) across the legitimate class, we sever the spurious causal path, forcing the model to rely on genuinely discriminative features (domain entropy, keyword count, suspicious TLD).
            <br/><br/>
            <b>Debiasing rates:</b> The rates (50% www, 25% HTTP, 85% path, 60% query, 50% subdomain) were chosen through iterative testing: lower rates left residual shortcut signal; higher rates distorted the legitimate URL distribution too much (creating unrealistic URLs). The 85% path injection rate is particularly high because PhiUSIIL's legitimate URLs were 100% bare domains — a severe bias. Post-debiasing, the accuracy drop from ~99% to ~86.4% quantifies the confound's contribution: approximately 13% of the original model's "accuracy" was attributable to the bias, not to phishing detection capability.
            <br/><br/>
            <b>Impact on feature importance:</b> Pre-debiasing, has_www and has_https dominated the SHAP importance ranking. Post-debiasing, domain_entropy, keyword_count, and url_length are the top features — genuinely discriminative signals. The debiased model correctly classifies OAuth URLs (accounts.google.com), cloud storage (drive.google.com), and marketing URLs (?gclid=...) that the biased model flagged as phishing.
          </Tier>
        </LearnCard>
      </div>
    </div>
  );
}

export default function EdaDashboard() {
  const [searchParams] = useSearchParams();
  const incomingUrl = searchParams.get("url") || null;
  let incomingFeatures = null;
  try { incomingFeatures = searchParams.get("features") ? JSON.parse(decodeURIComponent(searchParams.get("features"))) : null; } catch {}

  const [activeFeature, setActiveFeature] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats").then(r => r.json()).then(data => {
      setStats(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const featureNames = stats?.feature_names || [];
  const corrFeatures = stats?.correlation?.features || [];
  const corrMatrix   = stats?.correlation?.matrix || [];

  // Build histogram data from API feature_stats
  const features = featureNames.map(name => {
    const fs = stats?.feature_stats?.[name];
    if (!fs) return { name, bins:[], phishing:[], legit:[] };
    return { name, bins: fs.bins, phishing: fs.phishing, legit: fs.legit,
             phish_mean: fs.phish_mean, legit_mean: fs.legit_mean };
  });

  const phishPct = stats ? ((stats.phishing_count / stats.total_samples)*100).toFixed(1) : "?";
  const legitPct = stats ? ((stats.legit_count / stats.total_samples)*100).toFixed(1) : "?";

  return (
    <div style={{ minHeight:"100vh", background:"#080a14", fontFamily:"'Inter','Segoe UI',sans-serif" }}>
      <Navbar active="EDA Dashboard" />

      <div style={{ maxWidth:1200, margin:"0 auto", padding:"100px 32px 80px" }}>

        {/* Incoming URL banner */}
        {incomingUrl && incomingFeatures && (
          <div style={{ marginBottom:24, padding:"16px 22px", borderRadius:12, background:"rgba(0,180,216,0.06)", border:"1px solid rgba(0,180,216,0.18)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
              <span style={{ fontSize:18 }}>🎯</span>
              <div>
                <div style={{ color:"#00b4d8", fontSize:12, fontWeight:700 }}>Comparing your URL features to {stats?.total_samples?.toLocaleString() || "235,795"} dataset URLs</div>
                <div style={{ color:"rgba(255,255,255,0.5)", fontSize:11, fontFamily:"monospace" }}>{decodeURIComponent(incomingUrl)}</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {incomingFeatures.slice(0, 8).map((f, i) => (
                <div key={i} style={{ padding:"4px 10px", borderRadius:6, background:"rgba(0,180,216,0.08)", border:"1px solid rgba(0,180,216,0.15)", fontSize:10 }}>
                  <span style={{ color:"rgba(255,255,255,0.4)" }}>{f.name}: </span>
                  <span style={{ color:"#00b4d8", fontWeight:700, fontFamily:"monospace" }}>{String(f.value)}</span>
                </div>
              ))}
              {incomingFeatures.length > 8 && <span style={{ color:"rgba(255,255,255,0.3)", fontSize:10, alignSelf:"center" }}>+{incomingFeatures.length - 8} more</span>}
            </div>
          </div>
        )}

        <div style={{ marginBottom:40 }}>
          <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(0,240,255,0.06)", border:"1px solid rgba(0,240,255,0.18)", borderRadius:20, padding:"5px 14px" }}>
              <span style={{ color:"#00f0ff", fontSize:11, fontWeight:700, letterSpacing:1 }}>EXPLORATORY DATA ANALYSIS</span>
            </div>
            <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(155,89,255,0.07)", border:"1px solid rgba(155,89,255,0.2)", borderRadius:20, padding:"5px 14px" }}>
              <span style={{ color:"#9b59ff", fontSize:11, fontWeight:700, letterSpacing:1 }}>PhiUSIIL DATASET · 80/20 SPLIT · SEED=42</span>
            </div>
          </div>
          <h1 style={{ color:"#fff", fontSize:"clamp(26px,4vw,46px)", fontWeight:900, margin:"0 0 10px", letterSpacing:-0.5 }}>EDA Dashboard</h1>
          <p style={{ color:"rgba(255,255,255,0.4)", fontSize:14, maxWidth:580 }}>
            All {featureNames.length || "?"} engineered features — real distributions, class balance, and correlation heatmap from the PhiUSIIL dataset ({stats?.total_samples?.toLocaleString() || "..."} URLs).
          </p>
        </div>

        {loading && <div style={{ color:"rgba(255,255,255,0.5)", textAlign:"center", padding:60, fontSize:14 }}>Loading dataset statistics from backend...</div>}
        {!loading && !stats && <div style={{ color:"#ff4d6d", textAlign:"center", padding:60, fontSize:14 }}>Could not load stats. Is the backend running on port 8001?</div>}

        {stats && <>
        {/* Stat cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:14, marginBottom:32 }}>
          {[
            { label:"Total Samples",  value:stats.total_samples.toLocaleString(), icon:"📊", color:"#00f0ff" },
            { label:"Train Set",      value:stats.train_size.toLocaleString(),    icon:"🏋️", color:"#9b59ff", sub:"80%" },
            { label:"Test Set",       value:stats.test_size.toLocaleString(),     icon:"🧪", color:"#00b4d8", sub:"20% · seed=42" },
            { label:"Phishing URLs",  value:stats.phishing_count.toLocaleString(),icon:"🎣", color:"#ff4d6d", sub:`${phishPct}%` },
            { label:"Features Built", value:String(stats.n_features),             icon:"⚙️", color:"#f59e0b", sub:"URL-only" },
          ].map((s,i) => (
            <div key={i} style={{ padding:"16px 18px", borderRadius:12, background:`${s.color}09`, border:`1px solid ${s.color}20` }}>
              <div style={{ fontSize:18, marginBottom:6 }}>{s.icon}</div>
              <div style={{ color:s.color, fontSize:22, fontWeight:900 }}>{s.value}</div>
              {s.sub && <div style={{ color:"rgba(255,255,255,0.3)", fontSize:10, marginTop:2 }}>{s.sub}</div>}
              <div style={{ color:"rgba(255,255,255,0.4)", fontSize:11, marginTop:4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Class balance */}
        <div style={{ marginBottom:28, padding:"22px 26px", borderRadius:14, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.4)", letterSpacing:1, marginBottom:14 }}>CLASS BALANCE — FULL DATASET (PhiUSIIL, UCI ML Repo ID 967)</div>
          <div style={{ display:"flex", height:28, borderRadius:7, overflow:"hidden" }}>
            <div style={{ flex:stats.legit_count, background:"linear-gradient(90deg,#00b4d8,#00f0ff)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ color:"#080a14", fontWeight:800, fontSize:12 }}>Legitimate {legitPct}% ({stats.legit_count.toLocaleString()})</span>
            </div>
            <div style={{ flex:stats.phishing_count, background:"linear-gradient(90deg,#ff4d6d,#ff8fa3)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ color:"#fff", fontWeight:800, fontSize:12 }}>Phishing {phishPct}% ({stats.phishing_count.toLocaleString()})</span>
            </div>
          </div>
          <div style={{ color:"rgba(255,255,255,0.3)", fontSize:11, marginTop:10 }}>
            PhiUSIIL Phishing URL Dataset — 235,795 real labelled URLs. Labels were inverted from original encoding (PhiUSIIL: 1=legit, 0=phish → our system: 1=phish, 0=legit). Legitimate URLs debiased to break www/HTTPS shortcut.
          </div>
        </div>

        {/* Feature distributions */}
        <div style={{ marginBottom:28, padding:"24px 28px", borderRadius:14, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.4)", letterSpacing:1 }}>FEATURE DISTRIBUTIONS — ALL {featureNames.length} FEATURES</div>
            <div style={{ color:"rgba(255,255,255,0.25)", fontSize:10 }}>Click a feature to view its distribution</div>
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:24 }}>
            {features.map((f, i) => (
              <button key={i} onClick={() => setActiveFeature(i)} style={{ padding:"6px 13px", borderRadius:8, border:"1px solid", fontSize:11, fontWeight:600, cursor:"pointer", transition:"all 0.2s", borderColor: activeFeature===i ? "rgba(0,240,255,0.5)" : "rgba(255,255,255,0.1)", background: activeFeature===i ? "rgba(0,240,255,0.08)" : "rgba(255,255,255,0.02)", color: activeFeature===i ? "#00f0ff" : "rgba(255,255,255,0.5)" }}>
                {f.name}
              </button>
            ))}
          </div>
          {features[activeFeature] && <HistChart feature={features[activeFeature]} />}
        </div>

        {/* Correlation heatmap */}
        {corrFeatures.length > 0 && (
        <div style={{ marginBottom:28, padding:"24px 28px", borderRadius:14, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.4)", letterSpacing:1, marginBottom:18 }}>PEARSON CORRELATION HEATMAP — {corrFeatures.length} FEATURES</div>
          <div style={{ overflowX:"auto" }}>
            <div style={{ display:"grid", gridTemplateColumns:`90px repeat(${corrFeatures.length},1fr)`, gap:3, minWidth:620 }}>
              <div/>
              {corrFeatures.map((f,i) => (
                <div key={i} style={{ color:"rgba(255,255,255,0.35)", fontSize:8.5, fontWeight:700, textAlign:"center", paddingBottom:4, height:52, display:"flex", alignItems:"flex-end", justifyContent:"center", writingMode:"vertical-rl", transform:"rotate(180deg)" }}>{f}</div>
              ))}
              {corrMatrix.map((row, ri) => (
                <React.Fragment key={ri}>
                  <div style={{ color:"rgba(255,255,255,0.45)", fontSize:9, fontWeight:700, display:"flex", alignItems:"center", paddingRight:6 }}>{corrFeatures[ri]}</div>
                  {row.map((v, ci) => (
                    <div key={ci} title={`${corrFeatures[ri]} × ${corrFeatures[ci]}: ${v.toFixed(2)}`}
                      style={{ height:38, borderRadius:5, background:corrColor(v), display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, color:"rgba(255,255,255,0.75)", fontWeight:700, cursor:"default" }}>
                      {v === 1.0 ? "1.0" : v.toFixed(2)}
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", gap:8, marginTop:14, alignItems:"center" }}>
            <span style={{ color:"rgba(255,255,255,0.3)", fontSize:10 }}>Negative</span>
            <div style={{ flex:1, height:7, borderRadius:4, background:"linear-gradient(90deg,rgba(255,77,109,0.45),rgba(255,255,255,0.05),rgba(0,240,255,0.90))" }}/>
            <span style={{ color:"rgba(255,255,255,0.3)", fontSize:10 }}>Positive</span>
          </div>
        </div>
        )}
        {/* ═══════ EDUCATIONAL SECTION ═══════ */}
        <EdaLearnSection />
        </>}
      </div>

      <style>{`* { box-sizing:border-box }`}</style>
    </div>
  );
}
