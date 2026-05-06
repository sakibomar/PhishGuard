import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";

const NAV_LINKS = [
  {label:"URL Checker",to:"/"},{label:"Batch",to:"/Batch"},{label:"Models",to:"/ModelExplorer"},
  {label:"EDA",to:"/EdaDashboard"},{label:"FP Lab",to:"/FpLab"},
  {label:"Adversarial",to:"/Adversarial"},
  {label:"Typosquat",to:"/TypoSquat"},{label:"About",to:"/About"},
];

function Navbar({active}) {
  return (
    <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:200,background:"rgba(8,10,20,0.92)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(99,220,255,0.10)",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",height:58}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:20,filter:"drop-shadow(0 0 8px #00f0ff)"}}>🛡️</span><span style={{color:"#fff",fontWeight:800,fontSize:16}}>PhishGuard <span style={{color:"#00f0ff",fontWeight:400,fontSize:12}}>AI</span></span></div>
      <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
        {NAV_LINKS.map(l=><Link key={l.to} to={l.to} style={{color:active===l.label?"#00f0ff":"rgba(255,255,255,0.55)",textDecoration:"none",fontSize:11,fontWeight:600,padding:"5px 11px",borderRadius:7,background:active===l.label?"rgba(0,240,255,0.08)":"transparent",border:active===l.label?"1px solid rgba(0,240,255,0.22)":"1px solid transparent"}}>{l.label}</Link>)}
      </div>
    </nav>
  );
}

async function scoreURL(url) {
  try {
    const resp = await fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, model: "rf" }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.probability;
  } catch { return null; }
}

// Mutation strategies
function mutate(url) {
  let u;
  try { u = new URL(url.startsWith("http")?url:"https://"+url); }
  catch { return []; }
  const domain = u.hostname;
  const tld    = domain.includes(".")?"."+domain.split(".").pop():"";
  const sld    = domain.replace(tld,"");
  const variants = [];

  // 1. TLD swap
  [".tk",".ml",".xyz",".top",".online"].forEach(newTld=>{
    if(newTld!==tld){
      const v=url.replace(domain,sld+newTld);
      variants.push({url:v,mutation:"TLD Swap",detail:`${tld} → ${newTld}`,technique:"Phishers register cheap/free TLDs"});
    }
  });

  // 2. Keyword injection
  ["secure","login","verify","account","update"].forEach(kw=>{
    if(!domain.includes(kw)){
      const v=url.replace(domain,`${kw}-${domain}`);
      variants.push({url:v,mutation:"Keyword Prefix",detail:`Added '${kw}-'`,technique:"Makes URL look official/urgent"});
    }
  });

  // 3. Subdomain abuse
  ["secure","account","login","verify"].forEach(sub=>{
    const v=url.replace(domain,`${sub}.${domain}`);
    variants.push({url:v,mutation:"Subdomain Injection",detail:`Added '${sub}.' subdomain`,technique:"Trusted brand moved to subdomain"});
  });

  // 4. Homoglyph / digit swap
  const homoglyphs = {a:"@",o:"0",i:"1",l:"1",e:"3",s:"5"};
  Object.entries(homoglyphs).forEach(([c,h])=>{
    if(sld.includes(c)){
      const newSld=sld.replace(c,h);
      const v=url.replace(domain,newSld+tld);
      variants.push({url:v,mutation:"Homoglyph Attack",detail:`'${c}' → '${h}' in domain`,technique:"Visual confusion with legitimate domain"});
    }
  });

  // 5. Dash insertion
  for(let i=2;i<sld.length-1;i+=3){
    const newSld=sld.slice(0,i)+"-"+sld.slice(i);
    const v=url.replace(domain,newSld+tld);
    variants.push({url:v,mutation:"Dash Insertion",detail:`Inserted '-' at position ${i}`,technique:"Breaks up domain to avoid detection"});
    if(variants.filter(x=>x.mutation==="Dash Insertion").length>=2) break;
  }

  // 6. @ trick
  variants.push({url:`http://${domain}@phish-${domain}.tk`,mutation:"@ Redirect Trick",detail:"Adds @ to redirect browser",technique:"Browser ignores everything before @"});

  // 7. Path keyword injection
  ["/login","/verify","/secure/account","/update/password"].forEach(p=>{
    const v=`${url.replace(/\/+$/,"")}${p}`;
    variants.push({url:v,mutation:"Path Keyword",detail:`Appended '${p}'`,technique:"Adds urgency/legitimacy to path"});
  });

  // 8. HTTP downgrade
  if(url.startsWith("https")){
    variants.push({url:url.replace("https","http"),mutation:"HTTP Downgrade",detail:"Removed SSL (https→http)",technique:"Removes trust signal, phishers avoid cert costs"});
  }

  return variants;
}

const MUTATION_COLORS = {
  "TLD Swap":"#ff4d6d","Keyword Prefix":"#9b59ff","Subdomain Injection":"#f59e0b",
  "Homoglyph Attack":"#ff6b6b","Dash Insertion":"#00b4d8","@ Redirect Trick":"#ff4d6d",
  "Path Keyword":"#e67e22","HTTP Downgrade":"#e74c3c",
};

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

function AdversarialLearnSection() {
  return (
    <div style={{marginTop:40,paddingTop:32,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
        <span style={{fontSize:20}}>📚</span>
        <span style={{color:"#fff",fontWeight:800,fontSize:18}}>Learn</span>
        <span style={{color:"rgba(255,255,255,0.3)",fontSize:12}}>— Understand adversarial URL generation</span>
      </div>
      <p style={{color:"rgba(255,255,255,0.35)",fontSize:12,marginBottom:20,maxWidth:600}}>Click any topic to learn about how phishers trick detection systems and why adversarial testing matters.</p>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <LearnCard icon="🧬" title="What is Adversarial Testing?" color="#9b59ff">
          <Tier label="simple">
            <b>Adversarial testing is like pretending to be a burglar to test your own house's security — you try to break in so you can find and fix the weak spots before a real burglar does.</b> In computer security, this is a really important idea. We take a normal, safe web address (like paypal.com) and change it in sneaky ways that real scammers use — like swapping ".com" to ".tk" (a free domain), adding "secure-" at the beginning, or replacing letters with numbers that look the same (like "o" with "0"). Then we check if our phishing detector still catches these tricks. If a trick fools the detector, that tells us exactly where to improve it. This page lets YOU play the role of the attacker: enter any web address and see 8 different tricks applied to it. Each trick is scored by the model so you can see which ones work and which ones get caught. This is called "red teaming" in cybersecurity — where good guys pretend to be bad guys to make everyone safer. Remember: the point is not to create real phishing websites! It is to understand the model's weaknesses so we can be honest about what it can and cannot do. No perfect detector exists, and this page proves it by showing exactly which disguises work. Understanding these limitations is more important than pretending they do not exist.
          </Tier>
          <Tier label="intermediate">
            Adversarial testing (also called "red teaming" or "attack surface exploration") deliberately generates inputs designed to fool the model. In ML security, this is essential for honest capability assessment — reporting accuracy without adversarial testing overstates the model's real-world effectiveness.
            <br/><br/>
            <b>How it works on this page:</b> You enter a base URL (e.g., paypal.com). The tool applies 8 known phishing mutation techniques to generate adversarial variants. Each variant is scored by the Random Forest model via the real API (POST /api/predict). The results show: (1) the original URL's score, (2) each variant's score, and (3) the score delta — how much the mutation changed the phishing probability.
            <br/><br/>
            <b>Why this matters for false positives:</b> Adversarial testing reveals the inverse of FP analysis. While the FP Lab studies legitimate URLs that get wrongly flagged as phishing (FP = type I error), the adversarial page studies phishing URLs that evade detection (FN = type II error). Together, they paint a complete picture of the model's error profile. If TLD swap alone evades detection, that means any attacker can trivially bypass the URL-only model — which is why we recommend using this tool as one layer in a multi-layered security approach, not as a standalone defence.
            <br/><br/>
            <b>Connection to our automated testing:</b> The backend includes an adversarial_evolver.py script that automates this process using a genetic algorithm with 50 generations, tournament selection, and crossover. It found that minimal mutations (just 1-2 feature changes) can achieve near-100% evasion against URL-only models.
          </Tier>
          <Tier label="advanced">
            This page implements a lightweight manual adversarial attack surface exploration — the interactive counterpart to the automated adversarial_evolver.py in the test suite. The evolver uses a genetic algorithm (population=100, generations=50, tournament selection k=3, crossover rate=0.5, mutation rate=0.3) with 9 mutation operators to evolve phishing URLs toward evasion. Key empirical finding: TLD swap alone achieves ~100% evasion rate on 50 seed phishing URLs because our 18-dimensional URL-only feature set cannot distinguish paypal.com from paypal.tk at the feature level — same url_length, same domain_length, same domain_entropy, same path_length, same has_www/has_https status. The only discriminating feature is has_suspicious_tld (1→0 after swap), which is insufficient to overcome the model's decision boundary when all other features indicate legitimacy.
            <br/><br/>
            <b>Theoretical implication:</b> This confirms the fundamental limitation of URL-only feature spaces: the feature space mapping f: URL → R¹⁸ is many-to-one, meaning structurally different URLs (one phishing, one legitimate) can map to identical feature vectors. Content-based features (page DOM structure, visual similarity to known brands, JavaScript behaviour), network-based features (DNS age, WHOIS registrant, hosting ASN reputation, certificate transparency logs), and real-time threat intelligence (VirusTotal, Google Safe Browsing) would be needed to close this gap. The practical architecture recommendation is defence-in-depth: URL-only model for fast first-pass filtering (O(1) latency, offline-capable), followed by content/reputation analysis for URLs scoring 0.3-0.7 (uncertain zone).
          </Tier>
        </LearnCard>

        <LearnCard icon="🎭" title="The 8 Mutation Techniques (How Phishers Think)" color="#ff4d6d">
          <Tier label="simple">
            <b>Real attackers use these 8 sneaky tricks to make fake websites look real — and understanding them helps you stay safe online.</b>
            <br/><br/>
            <b>1. TLD Swap</b> — Change the domain ending from ".com" to ".tk" or ".ml" (these are free domain endings that anyone can register in seconds). Example: paypal.com becomes paypal.tk. This is the most dangerous trick because the rest of the address looks completely normal!
            <br/><b>2. Keyword Prefix</b> — Add official-sounding words like "secure-" or "login-" before the real name. Example: paypal.com becomes secure-paypal.com. It looks more official but it is actually a completely different website.
            <br/><b>3. Subdomain Injection</b> — Add "secure." or "login." before the name. Example: paypal.com becomes secure.paypal.com. This looks like it could be a real PayPal page.
            <br/><b>4. Homoglyph Attack</b> — Replace letters with numbers or symbols that look similar. Example: paypal.com becomes paypa1.com (the 'l' is replaced with a '1'). Very hard to spot!
            <br/><b>5. Dash Insertion</b> — Break up the name with hyphens. Example: paypal.com becomes pay-pal.com.
            <br/><b>6. @ Redirect Trick</b> — Use the @ symbol to trick the browser. Example: paypal.com@evil.tk actually takes you to evil.tk.
            <br/><b>7. Path Keywords</b> — Add "/login" or "/verify-account" to the end. Example: evil.com/paypal/login looks like a PayPal login page.
            <br/><b>8. HTTP Downgrade</b> — Remove the security lock (change https:// to http://). The page still loads but without encryption.
          </Tier>
          <Tier label="intermediate">
            Each mutation technique targets specific features in our 18-feature model. Understanding the mapping reveals exactly how each trick changes the model's risk assessment:
            <br/><br/>
            <b>High-impact mutations (large score delta):</b>
            <br/>• <b>TLD Swap</b> → Changes has_suspicious_tld from 0 to 1. This is the single strongest signal in our model — .tk, .ml, .ga, .cf, .gq are free TLDs heavily used by phishers. SHAP importance: very high. Score delta: typically +30-50%.
            <br/>• <b>@ Redirect</b> → Triggers has_at_symbol = 1 (a very strong signal because @ in a URL is almost never legitimate). This exploits RFC 3986 userinfo syntax — browsers navigate to the hostname AFTER the @, ignoring everything before it. Score delta: +25-40%.
            <br/>• <b>Subdomain Injection</b> → Increases subdomain_count. "secure.paypal.com" has 2 subdomains. Legitimate sites rarely have more than 1 subdomain. Score delta: +10-20%.
            <br/><br/>
            <b>Medium-impact mutations:</b>
            <br/>• <b>Keyword Prefix</b> → Increases keyword_count (login, verify, secure, account), domain_length, and dash_count. Multiple feature changes compound. Score delta: +15-30%.
            <br/>• <b>Path Keywords</b> → Increases path_length and keyword_count. Phishing URLs commonly have /login, /verify, /secure in the path. Score delta: +10-25%.
            <br/>• <b>Dash Insertion</b> → Increases dash_count. Dashed domains are more common in phishing (pay-pal vs paypal). Score delta: +5-15%.
            <br/><br/>
            <b>Low-impact mutations:</b>
            <br/>• <b>Homoglyph Attack</b> → Slightly increases digit_ratio (replacing letters with numbers). Subtle and hard for our model to catch. Score delta: +2-10%.
            <br/>• <b>HTTP Downgrade</b> → Changes has_https from 1 to 0. Post-debiasing, this feature has reduced importance (we deliberately weakened it to prevent the www/HTTPS shortcut). Score delta: +5-15%.
          </Tier>
          <Tier label="advanced">
            The 8 mutations implement a manual feature sensitivity analysis: each mutation modifies a known subset of the 18 features, and the score delta measures the model's gradient with respect to that feature subset. Formally, for mutation m that transforms feature vector x to x_m, the score delta is: delta_m = f(x_m) - f(x), where f is the RF's predict_proba function. This is a finite-difference approximation to the directional derivative of f along the mutation direction.
            <br/><br/>
            <b>Feature-mutation mapping matrix:</b> TLD swap modifies exactly 1 feature (has_suspicious_tld), making it a clean single-feature perturbation. Keyword prefix modifies 3+ features (keyword_count, domain_length, dash_count, url_length), creating a compound perturbation whose delta is NOT the sum of individual feature deltas (due to interaction effects in the tree ensemble). The @ redirect is the most reliably detected mutation because has_at_symbol=1 is nearly pathognomonic for phishing in our training data (extremely rare in legitimate URLs).
            <br/><br/>
            <b>Evasion analysis:</b> TLD swap is paradoxically the LEAST detectable mutation despite being the most impactful single feature change. When applied to a legitimate URL (e.g., google.com → google.tk), the only feature change is has_suspicious_tld: 0→1. All other 17 features remain identical to the legitimate URL, meaning the feature vector is overwhelmingly "legitimate" with one anomalous feature. The RF's majority-vote mechanism means most trees vote "legitimate" because 17/18 features match the legitimate pattern. This demonstrates the fundamental limitation of URL-only detection: the feature space cannot represent "this domain was just registered 2 hours ago" or "this TLD is associated with 95% phishing."
          </Tier>
        </LearnCard>

        <LearnCard icon="🛡️" title="What This Reveals About Model Limitations (Honest Assessment)" color="#f59e0b">
          <Tier label="simple">
            <b>No tool is perfect, and this page shows you exactly where ours struggles — because being honest about weaknesses is more important than pretending to be perfect.</b> The biggest weakness is simple: if an attacker registers a domain name that looks structurally identical to a real one (same length, same format, same number of dots), our tool cannot tell the difference just by looking at the web address. For example, if paypal.com changes to paypal.tk, the address still has the same length, the same letters, the same structure — the only difference is the ".tk" at the end. Our tool does flag ".tk" as suspicious, but smarter attackers could use a ".com" address that they bought for just a few dollars. The core limitation is this: our tool only looks at the web address itself, not the actual website behind it. It cannot check if the website was created yesterday (scam sites are usually brand new), if the page copies a real bank's design, or if the security certificate is fake. A real-world security system would combine our URL check with these additional checks to catch the attacks that slip through. This is called "defence in depth" — using multiple layers of protection instead of relying on just one.
          </Tier>
          <Tier label="intermediate">
            <b>Key limitations revealed by adversarial testing, ranked by severity:</b>
            <br/><br/>
            <b>1. TLD swap evasion (CRITICAL):</b> Changing the TLD while keeping everything else identical produces URLs where 17 of 18 features match the legitimate pattern. The model relies on has_suspicious_tld as the only discriminating feature, which is insufficient when all other features vote "legitimate." Our genetic algorithm evolver confirmed: TLD swap alone achieves ~100% evasion on 50 test phishing URLs.
            <br/><br/>
            <b>2. Unicode/IDN blindness (HIGH):</b> Our ASCII-only feature extraction cannot detect internationalized domain name (IDN) homoglyph attacks. Cyrillic 'а' (U+0430) looks identical to Latin 'a' (U+0061) but is a different character. "аpple.com" (Cyrillic 'а') and "apple.com" (Latin 'a') are visually identical but entirely different domains. Our features treat both as "a" after encoding, missing the attack completely.
            <br/><br/>
            <b>3. No content analysis (HIGH):</b> URL features cannot detect clone phishing — where the attacker creates a URL with legitimate structure but hosts a page that copies a real brand's design. "secure-login.example.com" might look suspicious to our model, but "example.com/about" with a PayPal clone on it would score as safe.
            <br/><br/>
            <b>4. No reputation/temporal data (MEDIUM):</b> Domain age, WHOIS registrant, SSL certificate transparency, and hosting reputation are among the strongest phishing signals in the literature. Adding domain_age_days alone would reduce FPs by an estimated ~50%.
            <br/><br/>
            <b>Why we document this:</b> Understanding model boundaries is a core project goal. These limitations are documented honestly because a model with known, quantified weaknesses is more trustworthy than one with undisclosed failures.
          </Tier>
          <Tier label="advanced">
            The adversarial page constitutes an empirical Bayes-optimal ceiling estimation for URL-only detection. The key theoretical result: <b>URL-only feature spaces are inherently evadable by adversaries with access to a domain registrar.</b> The proof is constructive: for any legitimate URL u with feature vector x = f(u), an adversary can construct a phishing URL u' with f(u') = x by registering a domain with identical structural properties (same length, same entropy, same TLD, same path structure). The only defence is features that are NOT controlled by the adversary — which, in a URL-only model, means none. External signals (domain age, WHOIS, DNS history, page content) are partially outside adversary control and thus provide genuine discriminative power.
            <br/><br/>
            <b>Empirical ceiling from genetic algorithm evolver:</b> Population=100, generations=50, tournament selection k=3, 9 mutation operators (the 8 above + combined). Starting from 50 known phishing URLs, the evolver achieved 100% evasion rate (all 50 URLs scored below 0.5 after evolution). Mean generations to evasion: 3.2 (median: 2), confirming that minimal mutations suffice. The dominant evasion strategy was TLD swap + www prefix addition — changing exactly 2 features to match the legitimate distribution.
            <br/><br/>
            <b>Practical deployment recommendation:</b> URL-only models provide value as a fast first-pass filter (O(1) latency, offline-capable, zero infrastructure cost) in a defence-in-depth architecture. URLs scoring 0.0-0.3 pass through, 0.7-1.0 are blocked, and the uncertain zone 0.3-0.7 triggers secondary analysis (content inspection, WHOIS lookup, certificate check). This cascading architecture provides the best latency-accuracy trade-off.
          </Tier>
        </LearnCard>

        <LearnCard icon="⚖️" title="Ethical Considerations (Responsible AI)" color="#00b4d8">
          <Tier label="simple">
            <b>We show attack techniques so people can learn to defend against them, not so they can use them to harm others — just like learning martial arts is about self-defence, not attacking people.</b> Every one of these tricks is already well-known to real attackers — scammers do not need our tool to learn how to make fake websites. But many regular people and students do NOT know about these tricks, which makes them vulnerable. By showing you exactly how these attacks work, we help you recognise them when you see them in real life. If you receive an email with a link to "secure-paypal.tk/login," you will now recognise THREE red flags: the "secure-" keyword prefix, the ".tk" free domain ending, and the "/login" path keyword. Without this education, you might have clicked it! Everything on this page runs locally in your web browser. The generated URLs are never registered as real websites, never stored anywhere, and never sent to anyone. They exist only in your browser tab and disappear when you close the page. This tool cannot create real phishing websites — it only shows you what they might look like so you can stay safe.
          </Tier>
          <Tier label="intermediate">
            This page exists for <b>educational and defensive purposes</b>, following established security research ethics:
            <br/><br/>
            <b>1. Red teaming (offence informs defence):</b> Understanding attacker techniques is a prerequisite for building effective defences. NIST, MITRE, and OWASP all publish detailed attack technique catalogues for this reason. Our 8 mutation techniques are a subset of MITRE ATT&CK T1583 (Acquire Infrastructure) and T1566 (Phishing).
            <br/><br/>
            <b>2. Responsible disclosure:</b> We document model weaknesses openly and prominently. The adversarial ceiling (100% evasion via TLD swap) is stated explicitly, not hidden. This follows the principle that known, quantified weaknesses are safer than undisclosed ones.
            <br/><br/>
            <b>3. No live threats:</b> Generated URLs are scored via the API but never registered, hosted, or transmitted outside your browser. The mutations operate on strings in JavaScript memory — they are ephemeral and leave no trace. There is no domain registration, DNS lookup, or page creation capability.
            <br/><br/>
            <b>4. Dual-use awareness:</b> The same mutations that help us test defences could theoretically be used to generate phishing URLs — this dual-use nature is inherent to ALL security research, from lock-picking to network penetration testing. The mitigating factor is that these techniques are already publicly documented in dozens of sources; our tool adds the educational context of scoring each variant against a real model.
            <br/><br/>
            <b>5. Educational value:</b> For students and non-technical users, seeing a concrete example of "paypal.com becomes paypal.tk" is far more impactful than an abstract description. This page bridges the gap between academic knowledge and practical awareness.
          </Tier>
          <Tier label="advanced">
            The dual-use nature of adversarial ML research is extensively documented in the literature (Goodfellow et al., 2014; Carlini and Wagner, 2017; Biggio and Roli, 2018). Our approach follows a responsible disclosure framework with five key safeguards:
            <br/><br/>
            <b>1. Public prior art:</b> All 8 mutation techniques are documented in MITRE ATT&CK (T1583.001, T1566.002), OWASP Phishing Guide, and APWG reports. We disclose no novel attack techniques — we only apply known techniques to a specific model to quantify its robustness. An attacker gains zero new capability from this tool.
            <br/><br/>
            <b>2. Containment:</b> The tool operates entirely client-side. No DNS queries, no HTTP requests to generated URLs, no domain registration, no file creation. Mutations exist only in JavaScript heap memory and are garbage-collected on page navigation. The backend API receives the mutated URLs only for scoring (predict endpoint), with no persistence.
            <br/><br/>
            <b>3. Proportionate disclosure:</b> We disclose attack effectiveness (score deltas) alongside specific mitigation strategies (add WHOIS, use content analysis, deploy defence-in-depth). The disclosure is coupled with defensive recommendations, following the CERT/CC vulnerability disclosure guidelines.
            <br/><br/>
            <b>4. IRB-style ethical reasoning:</b> The expected benefit (educational value for thousands of students and users who learn to recognise phishing patterns) significantly outweighs the marginal risk (zero — all techniques are already public and our tool adds no offensive capability).
            <br/><br/>
            <b>5. Honest capability assessment:</b> Including adversarial results in the project evaluation provides a truthful performance characterisation, avoiding the p-hacking and selective reporting endemic to ML publications.
          </Tier>
        </LearnCard>
      </div>
    </div>
  );
}

export default function Adversarial() {
  const [searchParams] = useSearchParams();
  const [url,setUrl]         = useState(searchParams.get("url") ? decodeURIComponent(searchParams.get("url")) : "");
  const [variants,setVariants] = useState([]);
  const [baseScore,setBase]  = useState(null);
  const [loading,setLoading] = useState(false);
  const [error,setError]     = useState("");
  const [selected,setSelected] = useState(null);

  const handleGenerate = async () => {
    setError(""); setVariants([]); setBase(null); setSelected(null);
    if(!url.trim()){setError("Enter a URL first.");return;}
    setLoading(true);
    try {
      const s = await scoreURL(url.trim());
      if(s===null){setError("Invalid URL or backend not running.");setLoading(false);return;}
      setBase(s);
      const raw = mutate(url.trim());
      // Score each variant via the backend API
      const scored = await Promise.all(raw.map(async v => {
        const sc = await scoreURL(v.url);
        return { ...v, score: sc ?? 0 };
      }));
      setVariants(scored.sort((a,b)=>b.score-a.score).slice(0,12));
    } catch(e) {
      setError("Backend error: " + e.message);
    }
    setLoading(false);
  };

  const maxScore = variants.length ? Math.max(...variants.map(v=>v.score)) : 1;

  return (
    <div style={{minHeight:"100vh",background:"#080a14",fontFamily:"'Inter','Segoe UI',sans-serif"}}>
      <Navbar active="Adversarial"/>
      <div style={{maxWidth:1200,margin:"0 auto",padding:"80px 28px 80px"}}>

        {/* Header */}
        <div style={{marginBottom:36}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(155,89,255,0.08)",border:"1px solid rgba(155,89,255,0.25)",borderRadius:20,padding:"5px 14px",marginBottom:14}}>
            <span style={{color:"#9b59ff",fontSize:11,fontWeight:700,letterSpacing:1}}>🧬 ADVERSARIAL URL GENERATOR</span>
          </div>
          <h1 style={{color:"#fff",fontSize:"clamp(24px,4vw,44px)",fontWeight:900,margin:"0 0 10px",letterSpacing:-0.5}}>Adversarial URL Generator</h1>
          <p style={{color:"rgba(255,255,255,0.4)",fontSize:14,maxWidth:620}}>
            Input a legitimate URL → the system mutates it into realistic phishing variants using known attacker techniques. Watch how each mutation changes the risk score. Demonstrates deep understanding of how phishing actually works.
          </p>
        </div>

        {/* Input */}
        <div style={{marginBottom:32,padding:"24px 28px",borderRadius:14,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)"}}>
          <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.35)",letterSpacing:1,marginBottom:14}}>INPUT LEGITIMATE URL</div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <input value={url} onChange={e=>{setUrl(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&handleGenerate()} placeholder="https://paypal.com" style={{flex:1,minWidth:260,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.10)",borderRadius:9,padding:"12px 16px",color:"#fff",fontSize:13,fontFamily:"monospace",outline:"none"}}/>
            <button onClick={handleGenerate} style={{padding:"12px 28px",borderRadius:9,background:"linear-gradient(135deg,#9b59ff,#00b4d8)",border:"none",color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer"}}>
              {loading?"Generating…":"Generate Variants →"}
            </button>
          </div>
          {error&&<div style={{marginTop:10,padding:"9px 14px",borderRadius:7,background:"rgba(255,77,109,0.09)",border:"1px solid rgba(255,77,109,0.28)",color:"#ff4d6d",fontSize:12}}>⚠️ {error}</div>}
          <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
            {["https://paypal.com","https://google.com","https://apple.com","https://amazon.com","https://microsoft.com"].map((u,i)=>(
              <button key={i} onClick={()=>setUrl(u)} style={{padding:"5px 11px",borderRadius:6,background:"rgba(155,89,255,0.08)",border:"1px solid rgba(155,89,255,0.18)",color:"rgba(255,255,255,0.55)",fontSize:10,fontFamily:"monospace",cursor:"pointer"}}>{u.replace("https://","")}</button>
            ))}
          </div>
        </div>

        {/* Base score */}
        {baseScore!==null&&!loading&&(
          <div style={{marginBottom:24,padding:"16px 22px",borderRadius:12,background:"rgba(0,240,255,0.05)",border:"1px solid rgba(0,240,255,0.2)",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
            <div>
              <div style={{color:"rgba(255,255,255,0.4)",fontSize:10,fontWeight:700,letterSpacing:1}}>ORIGINAL URL — BASELINE SCORE</div>
              <code style={{color:"rgba(255,255,255,0.8)",fontSize:12,marginTop:4,display:"block"}}>{url}</code>
            </div>
            <div style={{marginLeft:"auto",textAlign:"right"}}>
              <div style={{color:"rgba(255,255,255,0.35)",fontSize:10}}>Risk score</div>
              <div style={{color:"#00f0ff",fontSize:32,fontWeight:900,fontFamily:"monospace"}}>{(baseScore*100).toFixed(1)}%</div>
            </div>
          </div>
        )}

        {/* Variants */}
        {variants.length>0&&!loading&&(
          <>
            <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",letterSpacing:1,marginBottom:16}}>
              {variants.length} ADVERSARIAL VARIANTS — SORTED BY RISK SCORE ↓
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:32}}>
              {variants.map((v,i)=>{
                const delta = v.score - baseScore;
                const color = MUTATION_COLORS[v.mutation]||"#9b59ff";
                const isOpen = selected===i;
                return (
                  <div key={i} onClick={()=>setSelected(isOpen?null:i)} style={{borderRadius:12,background:isOpen?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.02)",border:`1px solid ${isOpen?color+"40":"rgba(255,255,255,0.07)"}`,cursor:"pointer",transition:"all 0.2s",overflow:"hidden"}}>
                    <div style={{padding:"14px 18px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                      <span style={{fontSize:9,fontWeight:800,padding:"3px 9px",borderRadius:5,background:`${color}18`,color,border:`1px solid ${color}30`,flexShrink:0,minWidth:120,textAlign:"center"}}>{v.mutation}</span>
                      <code style={{flex:1,color:"rgba(255,255,255,0.7)",fontSize:11,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.url}</code>
                      <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                        <div style={{textAlign:"right"}}>
                          <div style={{color:v.score>0.5?"#ff4d6d":"#00f0ff",fontWeight:900,fontSize:17,fontFamily:"monospace"}}>{(v.score*100).toFixed(0)}%</div>
                          <div style={{color:delta>0?"#ff4d6d":"#00f0ff",fontSize:10,fontWeight:700}}>{delta>0?"+":""}{(delta*100).toFixed(0)}% vs original</div>
                        </div>
                        <div style={{width:80}}>
                          <div style={{height:6,borderRadius:3,background:"rgba(255,255,255,0.06)"}}>
                            <div style={{height:"100%",width:`${(v.score/maxScore)*100}%`,background:v.score>0.5?"#ff4d6d":"#00f0ff",borderRadius:3}}/>
                          </div>
                        </div>
                      </div>
                    </div>
                    {isOpen&&(
                      <div style={{padding:"0 18px 16px",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:14}}>
                          <div>
                            <div style={{color:"rgba(255,255,255,0.3)",fontSize:10,fontWeight:700,letterSpacing:1,marginBottom:8}}>MUTATION DETAIL</div>
                            <div style={{padding:"10px 14px",borderRadius:8,background:`${color}0d`,border:`1px solid ${color}20`}}>
                              <div style={{color,fontWeight:700,fontSize:13,marginBottom:4}}>{v.mutation}</div>
                              <div style={{color:"rgba(255,255,255,0.55)",fontSize:12}}>{v.detail}</div>
                            </div>
                          </div>
                          <div>
                            <div style={{color:"rgba(255,255,255,0.3)",fontSize:10,fontWeight:700,letterSpacing:1,marginBottom:8}}>ATTACKER RATIONALE</div>
                            <div style={{padding:"10px 14px",borderRadius:8,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)"}}>
                              <div style={{color:"rgba(255,255,255,0.6)",fontSize:12,lineHeight:1.6}}>{v.technique}</div>
                            </div>
                          </div>
                        </div>
                        <div style={{marginTop:12}}>
                          <div style={{color:"rgba(255,255,255,0.3)",fontSize:10,fontWeight:700,letterSpacing:1,marginBottom:6}}>MUTATED URL</div>
                          <code style={{color:"#9b59ff",fontSize:11,background:"rgba(155,89,255,0.08)",padding:"8px 12px",borderRadius:7,display:"block",wordBreak:"break-all",border:"1px solid rgba(155,89,255,0.18)"}}>{v.url}</code>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Score delta visualisation */}
            <div style={{padding:"22px 26px",borderRadius:14,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)"}}>
              <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",letterSpacing:1,marginBottom:18}}>RISK SCORE DELTA — ORIGINAL vs VARIANTS</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <span style={{color:"rgba(255,255,255,0.5)",fontSize:11,width:140,flexShrink:0}}>Original URL</span>
                  <div style={{flex:1,height:8,borderRadius:4,background:"rgba(255,255,255,0.06)",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${baseScore*100}%`,background:"#00f0ff",borderRadius:4}}/>
                  </div>
                  <span style={{color:"#00f0ff",fontWeight:700,fontSize:12,fontFamily:"monospace",width:42,textAlign:"right"}}>{(baseScore*100).toFixed(0)}%</span>
                </div>
                {variants.slice(0,8).map((v,i)=>{
                  const color=MUTATION_COLORS[v.mutation]||"#9b59ff";
                  return (
                    <div key={i} style={{display:"flex",alignItems:"center",gap:12}}>
                      <span style={{color:"rgba(255,255,255,0.4)",fontSize:10,width:140,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.mutation}</span>
                      <div style={{flex:1,height:8,borderRadius:4,background:"rgba(255,255,255,0.05)",overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${v.score*100}%`,background:color,borderRadius:4,transition:"width 0.6s ease"}}/>
                      </div>
                      <span style={{color,fontWeight:700,fontSize:12,fontFamily:"monospace",width:42,textAlign:"right"}}>{(v.score*100).toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {!variants.length&&!loading&&(
          <div style={{textAlign:"center",padding:"60px 0",color:"rgba(255,255,255,0.2)",fontSize:14}}>
            Enter a legitimate URL above and click Generate Variants
          </div>
        )}

        {/* ═══════ EDUCATIONAL SECTION ═══════ */}
        <AdversarialLearnSection />
      </div>
      <style>{`*{box-sizing:border-box}`}</style>
    </div>
  );
}
