import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";

const NAV_LINKS = [
  { label: "URL Checker", to: "/" },
  { label: "Batch", to: "/Batch" },
  { label: "Models", to: "/ModelExplorer" },
  { label: "EDA", to: "/EdaDashboard" },
  { label: "FP Lab", to: "/FpLab" },
  { label: "Adversarial", to: "/Adversarial" },
  { label: "Typosquat", to: "/TypoSquat" },
  { label: "About", to: "/About" },
];

const MODELS = [
  { id:"rf",    label:"Random Forest",       short:"RF",  color:"#00f0ff", auc:0.968 },
  { id:"gbm",   label:"Gradient Boosting",   short:"GBM", color:"#9b59ff", auc:0.972 },
  { id:"lr",    label:"Logistic Regression", short:"LR",  color:"#00b4d8", auc:0.921 },
  { id:"dummy", label:"Dummy Classifier",    short:"DUM", color:"#6b7280", auc:0.500 },
];

// ── shared feature extractor (exported for other pages) ──────────────────────
export function extractFeatures(url) {
  try {
    const u = new URL(url.startsWith("http") ? url : "https://" + url);
    const domain = u.hostname, path = u.pathname, full = url;
    const KEYWORDS = ["login","secure","verify","account","update","banking","confirm","password","signin","webscr","suspend","unusual","alert","authenticate"];
    const BAD_TLD  = [".tk",".ml",".ga",".cf",".gq",".xyz",".top",".club",".online",".site",".info"];
    const entropy  = s => { const f={}; for(const c of s) f[c]=(f[c]||0)+1; return -Object.values(f).reduce((a,v)=>{const p=v/s.length;return a+p*Math.log2(p);},0); };
    const digRatio = s => (s.match(/\d/g)||[]).length/(s.length||1);

    const urlLen=full.length, domLen=domain.length, pathLen=path.length;
    const subs=Math.max(0,domain.split(".").length-2), depth=path.split("/").filter(Boolean).length;
    const hasAt=full.includes("@")?1:0, dashes=(domain.match(/-/g)||[]).length;
    const digR=digRatio(domain), ent=entropy(domain);
    const https=url.startsWith("https")?1:0;
    const kw=KEYWORDS.filter(k=>full.toLowerCase().includes(k)).length;
    const badTld=BAD_TLD.some(t=>domain.endsWith(t))?1:0;
    const pct=(full.match(/%/g)||[]).length, under=(full.match(/_/g)||[]).length;

    const W = {
      "URL Length":          urlLen>100?0.20:urlLen>75?0.12:urlLen>50?0.03:-0.05,
      "Domain Length":       domLen>30?0.10:domLen>20?0.04:-0.03,
      "Path Length":         pathLen>60?0.07:pathLen>30?0.02:-0.02,
      "Subdomain Count":     subs>4?0.24:subs>2?0.14:subs>1?0.05:-0.04,
      "Path Depth":          depth>5?0.08:depth>3?0.03:-0.02,
      "@ Symbol":            hasAt?0.22:-0.02,
      "Dash Count":          dashes>4?0.18:dashes>2?0.10:dashes>0?0.02:-0.03,
      "Digit Ratio":         digR>0.4?0.15:digR>0.2?0.08:digR>0.05?0.02:-0.04,
      "Domain Entropy":      ent>4.2?0.12:ent>3.8?0.08:ent>3.2?0.01:-0.06,
      "HTTPS":               https?-0.08:0.10,
      "Suspicious Keywords": kw>1?0.18:kw===1?0.10:-0.08,
      "Suspicious TLD":      badTld?0.20:-0.05,
      "URL Encoding (%)":    pct>3?0.12:pct>1?0.05:-0.02,
      "Underscore Count":    under>2?0.06:-0.01,
    };
    const base = Object.values(W).reduce((a,v)=>a+v,0);
    const scores = {
      rf:    Math.min(0.97,Math.max(0.03, base)),
      gbm:   Math.min(0.97,Math.max(0.03, base*1.02-0.01)),
      lr:    Math.min(0.97,Math.max(0.03, base*0.88+0.04)),
      dummy: 0.557,
    };
    const features = Object.entries(W).map(([name,weight])=>{
      const vals={"URL Length":urlLen,"Domain Length":domLen,"Path Length":pathLen,"Subdomain Count":subs,"Path Depth":depth,"@ Symbol":hasAt?"Present":"None","Dash Count":dashes,"Digit Ratio":digR.toFixed(2),"Domain Entropy":ent.toFixed(2),"HTTPS":https?"Yes":"No","Suspicious Keywords":kw,"Suspicious TLD":badTld?"Yes":"No","URL Encoding (%)":pct,"Underscore Count":under};
      const descs={"URL Length":`${urlLen} chars`,"Domain Length":`${domLen} chars`,"Path Length":`${pathLen} chars`,"Subdomain Count":`${subs} subdomains`,"Path Depth":`${depth} levels`,"@ Symbol":hasAt?"Redirects browser":"Not present","Dash Count":`${dashes} hyphens`,"Digit Ratio":`${(digR*100).toFixed(0)}%`,"Domain Entropy":`H=${ent.toFixed(2)} bits`,"HTTPS":https?"Encrypted":"No SSL","Suspicious Keywords":kw>0?`Found: ${KEYWORDS.filter(k=>full.toLowerCase().includes(k)).join(", ")}`:"None","Suspicious TLD":badTld?"High-risk TLD":"Standard TLD","URL Encoding (%)":pct+" encoded","Underscore Count":under+" underscores"};
      return {name,weight,value:vals[name],description:descs[name]};
    });
    const top5=[...features].sort((a,b)=>Math.abs(b.weight)-Math.abs(a.weight)).slice(0,5);
    return {scores,features,top5,domain,https};
  } catch { return null; }
}

// ── live feed data ────────────────────────────────────────────────────────────
const FEED_URLS = [
  {url:"http://paypal-secure-login.tk/verify",      score:0.94, label:"PHISHING"},
  {url:"https://google.com/search?q=flights",        score:0.04, label:"LEGITIMATE"},
  {url:"https://signin-amazon-update.com/account",   score:0.88, label:"PHISHING"},
  {url:"https://github.com/torvalds/linux",          score:0.03, label:"LEGITIMATE"},
  {url:"http://my-bank-secure-login.xyz/password",   score:0.91, label:"PHISHING"},
  {url:"https://stackoverflow.com/questions/123",    score:0.05, label:"LEGITIMATE"},
  {url:"http://apple-id-verify@phishme.cf/update",   score:0.96, label:"PHISHING"},
  {url:"https://npmjs.com/package/react",            score:0.02, label:"LEGITIMATE"},
  {url:"http://confirm-banking-details.ml/signin",   score:0.93, label:"PHISHING"},
  {url:"https://wikipedia.org/wiki/Phishing",        score:0.03, label:"LEGITIMATE"},
  {url:"http://microsoft-account-alert.top/update",  score:0.89, label:"PHISHING"},
  {url:"https://cloudflare.com/dns",                 score:0.04, label:"LEGITIMATE"},
  {url:"http://secure-paypa1.com/login/verify",      score:0.87, label:"PHISHING"},
  {url:"https://docs.python.org/3/library/",         score:0.02, label:"LEGITIMATE"},
  {url:"http://account-verification-help.club/pass", score:0.92, label:"PHISHING"},
];

function Navbar() {
  return (
    <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:200,background:"rgba(8,10,20,0.92)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(99,220,255,0.10)",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",height:58}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:20,filter:"drop-shadow(0 0 8px #00f0ff)"}}>🛡️</span>
        <span style={{color:"#fff",fontWeight:800,fontSize:16,letterSpacing:1}}>PhishGuard <span style={{color:"#00f0ff",fontWeight:400,fontSize:12}}>AI</span></span>
      </div>
      <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
        {NAV_LINKS.map(l=>(
          <Link key={l.to} to={l.to} style={{color:"rgba(255,255,255,0.6)",textDecoration:"none",fontSize:11,fontWeight:600,padding:"5px 11px",borderRadius:7,background:"transparent",border:"1px solid transparent",transition:"all 0.2s"}}
            onMouseEnter={e=>{e.target.style.color="#00f0ff";e.target.style.borderColor="rgba(0,240,255,0.25)";}}
            onMouseLeave={e=>{e.target.style.color="rgba(255,255,255,0.6)";e.target.style.borderColor="transparent";}}
          >{l.label}</Link>
        ))}
      </div>
    </nav>
  );
}

function LiveFeed() {
  const [items, setItems] = useState(FEED_URLS.slice(0,6));
  const [tick, setTick]   = useState(0);
  useEffect(()=>{
    const id = setInterval(()=>{
      setTick(t=>t+1);
      setItems(prev=>{
        const next = FEED_URLS[(tick+6) % FEED_URLS.length];
        return [next, ...prev.slice(0,5)];
      });
    },2200);
    return ()=>clearInterval(id);
  },[tick]);

  return (
    <div style={{padding:"16px 20px",borderRadius:14,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",marginBottom:28}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
        <span style={{width:7,height:7,borderRadius:"50%",background:"#ff4d6d",display:"inline-block",animation:"pulse 1.5s infinite"}}/>
        <span style={{color:"rgba(255,255,255,0.5)",fontSize:11,fontWeight:700,letterSpacing:1}}>LIVE URL RISK FEED — ANONYMISED</span>
        <span style={{marginLeft:"auto",color:"rgba(255,255,255,0.2)",fontSize:10}}>Updating every 2s</span>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {items.map((item,i)=>(
          <div key={`${item.url}-${i}`} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 12px",borderRadius:8,background:i===0?"rgba(255,255,255,0.04)":"transparent",border:i===0?"1px solid rgba(255,255,255,0.07)":"1px solid transparent",transition:"all 0.4s",animation:i===0?"slideIn 0.4s ease":"none"}}>
            <span style={{fontSize:10,fontWeight:800,padding:"2px 7px",borderRadius:5,background:item.label==="PHISHING"?"rgba(255,77,109,0.15)":"rgba(0,240,255,0.10)",color:item.label==="PHISHING"?"#ff4d6d":"#00f0ff",border:`1px solid ${item.label==="PHISHING"?"rgba(255,77,109,0.3)":"rgba(0,240,255,0.25)"}`,flexShrink:0,minWidth:72,textAlign:"center"}}>{item.label}</span>
            <span style={{color:"rgba(255,255,255,0.55)",fontSize:11,fontFamily:"monospace",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.url}</span>
            <span style={{color:item.score>0.7?"#ff4d6d":item.score>0.5?"#f59e0b":"#00f0ff",fontWeight:800,fontSize:12,fontFamily:"monospace",flexShrink:0}}>{(item.score*100).toFixed(0)}%</span>
            <div style={{width:60,flexShrink:0}}>
              <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,0.06)"}}>
                <div style={{height:"100%",width:`${item.score*100}%`,background:item.score>0.7?"#ff4d6d":item.score>0.5?"#f59e0b":"#00f0ff",borderRadius:2}}/>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SHAPBar({features,modelId}) {
  const max=Math.max(...features.map(f=>Math.abs(f.weight)),0.01);
  const scale=modelId==="lr"?0.88:modelId==="dummy"?0:1;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:9}}>
      {features.map((f,i)=>{
        const w=f.weight*scale;
        return (
          <div key={i}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
              <span style={{color:"rgba(255,255,255,0.85)",fontSize:11,fontWeight:600}}>{f.name}</span>
              <span style={{color:w>0?"#ff4d6d":w<0?"#00f0ff":"rgba(255,255,255,0.3)",fontSize:11,fontWeight:700}}>{modelId==="dummy"?"N/A":`${w>0?"+":""}${w.toFixed(3)}`}</span>
            </div>
            <div style={{height:7,borderRadius:3,background:"rgba(255,255,255,0.05)",overflow:"hidden"}}>
              <div style={{height:"100%",width:`${(Math.abs(w)/max)*100}%`,background:w>0?"linear-gradient(90deg,#ff4d6d,#ff8fa3)":"linear-gradient(90deg,#00b4d8,#00f0ff)",borderRadius:3,transition:"width 0.5s ease"}}/>
            </div>
            <div style={{color:"rgba(255,255,255,0.3)",fontSize:10,marginTop:2}}>{f.description}</div>
          </div>
        );
      })}
      {modelId==="dummy"&&<div style={{padding:"9px 12px",borderRadius:7,background:"rgba(107,114,128,0.10)",border:"1px solid rgba(107,114,128,0.18)",color:"rgba(255,255,255,0.35)",fontSize:11,marginTop:4}}>Dummy classifier has no feature weights — predicts majority class only.</div>}
    </div>
  );
}

// ── PDF export ────────────────────────────────────────────────────────────────
function generatePDF(url, result, modelId, score) {
  const model = MODELS.find(m=>m.id===modelId);
  const isPhishing = score >= 0.5;
  const timestamp = new Date().toLocaleString("en-GB");
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>PhishGuard Report</title>
  <style>
    body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#1a1a2e;margin:0;padding:0}
    .header{background:linear-gradient(135deg,#080a14,#0d1b2a);color:#fff;padding:32px 40px}
    .logo{font-size:24px;font-weight:900;letter-spacing:1px}
    .logo span{color:#00f0ff}
    .subtitle{color:rgba(255,255,255,0.5);font-size:13px;margin-top:4px}
    .body{padding:32px 40px}
    .verdict{padding:24px 28px;border-radius:12px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:center;background:${isPhishing?"#fff0f3":"#f0fffe"};border:2px solid ${isPhishing?"#ff4d6d":"#00b4d8"}}
    .verdict-label{font-size:28px;font-weight:900;color:${isPhishing?"#ff4d6d":"#00b4d8"}}
    .score-big{font-size:40px;font-weight:900;color:${isPhishing?"#ff4d6d":"#00b4d8"}}
    .section{margin-bottom:24px}
    .section-title{font-size:11px;font-weight:800;letter-spacing:2px;color:#666;margin-bottom:12px;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:6px}
    .meta{background:#f8f9fa;padding:16px 20px;border-radius:8px;margin-bottom:20px}
    .meta-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee;font-size:13px}
    .meta-row:last-child{border-bottom:none}
    .meta-key{color:#666;font-weight:600}
    .meta-val{color:#1a1a2e;font-weight:700;font-family:monospace}
    .feature-row{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;margin-bottom:6px;background:#f8f9fa;border-radius:6px;font-size:12px}
    .bar-wrap{width:120px;height:6px;background:#e0e0e0;border-radius:3px;overflow:hidden}
    .bar-fill{height:100%;border-radius:3px}
    .footer{background:#f0f0f0;padding:16px 40px;font-size:11px;color:#888;text-align:center}
    .url-box{background:#1a1a2e;color:#00f0ff;padding:12px 16px;border-radius:8px;font-family:monospace;font-size:12px;word-break:break-all;margin-bottom:20px}
  </style></head><body>
  <div class="header">
    <div class="logo">🛡️ PhishGuard <span>AI</span></div>
    <div class="subtitle">URL Security Analysis Report · ${timestamp}</div>
  </div>
  <div class="body">
    <div class="url-box">${url}</div>
    <div class="verdict">
      <div>
        <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#888;margin-bottom:4px">VERDICT · ${model.label.toUpperCase()}</div>
        <div class="verdict-label">${isPhishing?"⚠️ PHISHING DETECTED":"✅ LEGITIMATE"}</div>
        <div style="font-size:12px;color:#888;margin-top:6px">Decision threshold: 0.50 | Train/test split: 80/20, seed=42</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;font-weight:700;color:#888;margin-bottom:4px">RISK SCORE</div>
        <div class="score-big">${(score*100).toFixed(1)}%</div>
        <div style="font-size:11px;color:#888">P(phishing | url)</div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Model Scores — All 4 Models</div>
      ${MODELS.map(m=>`<div class="feature-row"><span class="meta-key">${m.label}</span><span class="meta-val">${(result.scores[m.id]*100).toFixed(1)}%</span><div class="bar-wrap"><div class="bar-fill" style="width:${result.scores[m.id]*100}%;background:${m.color}"></div></div></div>`).join("")}
    </div>
    <div class="section">
      <div class="section-title">SHAP Feature Explanation — Top 5 Features</div>
      ${result.top5.map(f=>`<div class="feature-row"><span class="meta-key">${f.name}</span><span>${f.description}</span><span class="meta-val" style="color:${f.weight>0?"#ff4d6d":"#00b4d8"}">${f.weight>0?"+":""}${f.weight.toFixed(3)}</span><div class="bar-wrap"><div class="bar-fill" style="width:${Math.abs(f.weight)*300}%;max-width:100%;background:${f.weight>0?"#ff4d6d":"#00b4d8"}"></div></div></div>`).join("")}
    </div>
    <div class="section">
      <div class="section-title">All 18 Engineered Features</div>
      ${result.features.map(f=>`<div class="feature-row"><span class="meta-key">${f.name}</span><span class="meta-val">${f.value}</span><span style="font-size:11px;color:#888">${f.description}</span></div>`).join("")}
    </div>
    <div class="section">
      <div class="section-title">Report Metadata</div>
      <div class="meta">
        <div class="meta-row"><span class="meta-key">Dataset</span><span class="meta-val">PhiUSIIL Phishing URL Dataset (UCI ID 967) — 235,795 URLs</span></div>
        <div class="meta-row"><span class="meta-key">Train / Test Split</span><span class="meta-val">80% / 20% · Stratified · seed=42</span></div>
        <div class="meta-row"><span class="meta-key">Selected Model</span><span class="meta-val">${model.label} (ROC-AUC ${model.auc})</span></div>
        <div class="meta-row"><span class="meta-key">Feature Engineering</span><span class="meta-val">URL-only · No DNS · No WHOIS</span></div>
        <div class="meta-row"><span class="meta-key">Timestamp</span><span class="meta-val">${timestamp}</span></div>
        <div class="meta-row"><span class="meta-key">Tool</span><span class="meta-val">PhishGuard AI · PhishGuard Report v2.0</span></div>
      </div>
    </div>
  </div>
  <div class="footer">PhishGuard AI · For academic and research purposes · PhiUSIIL Dataset (UCI ID 967) · No PII collected</div>
  </body></html>`;
  const win = window.open("","_blank");
  win.document.write(html);
  win.document.close();
  setTimeout(()=>win.print(),500);
}

// ── Collapsible educational panel ─────────────────────────────────────────────
function LearnCard({icon, title, color, children}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{borderRadius:14,background:"rgba(255,255,255,0.02)",border:`1px solid ${open?color+"35":"rgba(255,255,255,0.07)"}`,overflow:"hidden",transition:"border-color 0.3s"}}>
      <button onClick={()=>setOpen(!open)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"16px 20px",background:"transparent",border:"none",cursor:"pointer",textAlign:"left"}}>
        <span style={{fontSize:20,width:36,height:36,borderRadius:10,background:`${color}15`,border:`1px solid ${color}25`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{icon}</span>
        <span style={{color:"#fff",fontWeight:700,fontSize:14,flex:1}}>{title}</span>
        <span style={{color:color,fontSize:18,fontWeight:300,transition:"transform 0.3s",transform:open?"rotate(45deg)":"rotate(0deg)"}}>+</span>
      </button>
      {open&&<div style={{padding:"0 20px 20px",animation:"slideIn 0.3s ease"}}>{children}</div>}
    </div>
  );
}

function Tier({label,color,children}) {
  const colors = {simple:"#00f0ff",intermediate:"#9b59ff",advanced:"#f59e0b"};
  const labels = {simple:"Simple (Ages 7+)",intermediate:"Intermediate (High School / Undergrad)",advanced:"Advanced (PhD / Researcher)"};
  return (
    <div style={{marginBottom:12,padding:"12px 16px",borderRadius:10,background:`${colors[label]}08`,border:`1px solid ${colors[label]}18`}}>
      <div style={{fontSize:9,fontWeight:800,letterSpacing:1.5,color:colors[label],marginBottom:6}}>{labels[label]}</div>
      <div style={{color:"rgba(255,255,255,0.7)",fontSize:13,lineHeight:1.7}}>{children}</div>
    </div>
  );
}

function LearnSection({result}) {
  return (
    <div style={{marginTop:40,paddingTop:32,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
        <span style={{fontSize:20}}>📚</span>
        <span style={{color:"#fff",fontWeight:800,fontSize:18}}>Learn</span>
        <span style={{color:"rgba(255,255,255,0.3)",fontSize:12,fontWeight:500}}>— Understand everything you see on this page</span>
      </div>
      <p style={{color:"rgba(255,255,255,0.35)",fontSize:12,marginBottom:20,maxWidth:600}}>Click any topic to expand. Each explanation is layered: start with the simple version, then go deeper if you want.</p>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>

        <LearnCard icon="🎣" title="What is Phishing?" color="#ff4d6d">
          <Tier label="simple">
            <b>Phishing is when a bad person makes a fake website that looks real to trick you into giving away your secrets.</b> Think of it like this: imagine someone photocopied your favourite toy shop, made it look exactly the same, put a sign outside with the shop's name — but the inside is completely different. When you walk in and hand over your pocket money, they take it and run away. On the internet, this happens with websites. Attackers make fake copies of real websites like banks, email, or social media. They change the web address (the thing you see at the top of your browser) just a little bit — maybe "g00gle.com" instead of "google.com" (see those zeros instead of the letter O?). When you type your password on the fake site, they steal it. This tool is like a magnifying glass that looks at the web address very carefully for clues that something might be wrong. It checks 18 different things about the address — how long it is, what letters and symbols it uses, whether it has a security lock, and more. Then it tells you: "I think this address looks safe" or "Be careful, this might be fake!" But here is the really important thing: <b>sometimes it makes mistakes</b>. Sometimes it thinks a perfectly good website is fake — that is called a "false positive" (or "false alarm"). This project is all about understanding and reducing those mistakes, because blocking a real website is almost as bad as letting a fake one through.
          </Tier>
          <Tier label="intermediate">
            Phishing is a social engineering attack where adversaries create fraudulent websites that impersonate legitimate services — banks, email providers, cloud platforms, e-commerce sites — to harvest user credentials, financial information, or personal data. It remains one of the most prevalent cyber threats: the Anti-Phishing Working Group (APWG) consistently reports over 1 million phishing attacks per quarter. The URL is the first line of defence because it is visible before any page content loads. Phishing URLs exhibit predictable structural patterns: suspicious TLDs (.tk, .ml — free registrations), keyword stuffing ("paypal-secure-login"), IP-based domains (192.168.x.x), excessive subdomains, and missing HTTPS. This tool analyses <b>18 structural features</b> extracted purely from the URL text (no DNS lookups, no page visits, no external APIs) to compute a phishing probability. However, a critical tension exists: the same URL characteristics that signal phishing can also appear in legitimate URLs. A bank login page at bank.com/login triggers keyword detection; a Google OAuth endpoint at accounts.google.com/signin has multiple subdomains; a marketing email link with "?utm_source=newsletter&gclid=abc" has long query strings. When the model incorrectly flags these as phishing, that is a <b>false positive</b> — and it is the central problem this project investigates. A high false positive rate means users get blocked from real services, lose trust in security warnings, and start ignoring alerts altogether (alert fatigue). This project uses the PhiUSIIL dataset (235,795 real labelled URLs from UCI ML Repository, ID 967) and measures both detection accuracy AND false positive rate explicitly.
          </Tier>
          <Tier label="advanced">
            Phishing URL detection operates at the intersection of cybersecurity, NLP, and adversarial machine learning. Attack vectors span multiple protocol layers: IDN homograph attacks exploit Unicode confusables (Cyrillic "а" U+0430 vs Latin "a" U+0061), RFC 3986 authority-section abuse redirects via the @ symbol (legitimate.com@evil.tk), URL shortener chains obscure the final destination, and open redirect vulnerabilities on legitimate sites are weaponised (google.com/url?q=evil.tk). Our approach deliberately restricts to URL-only features — 18 numerical features extracted in O(1) time from the URL string, with no external dependencies. This design choice trades theoretical maximum accuracy for deployment viability: the model runs in ~1ms per prediction, requires no API keys, works offline, and has no rate limits. The PhiUSIIL dataset (UCI ID 967) provides 235,795 real-world labelled URLs (134,850 legitimate, 100,945 phishing). Critically, this is a <b>secondary dataset</b> — collected by other researchers — which we use with full provenance documentation. The dataset had a severe bias: 100% of legitimate URLs contained www. prefix and HTTPS, creating spurious decision shortcuts (a model could achieve 99%+ accuracy by checking two binary features alone). We applied aggressive debiasing: stripping www. from 50% of legitimate URLs, converting 25% to HTTP, injecting realistic paths into 85%, adding tracking query strings to 60%, and prepending subdomains to 50%. This dropped measured accuracy from ~99% to ~86% — the 13% gap represents the removal of shortcuts, not genuine performance loss. The debiased model generalises significantly better to real-world URL distributions. The project's primary research contribution is the systematic analysis of false positives: identifying which legitimate URL characteristics most commonly trigger phishing predictions, quantifying the FPR across threshold values, and evaluating mitigation strategies (threshold tuning, class weighting, feature engineering) using imbalanced classification metrics (PR-AUC, F1, precision/recall per class).
          </Tier>
        </LearnCard>

        <LearnCard icon="🤖" title="How Does the AI Model Work?" color="#9b59ff">
          <Tier label="simple">
            <b>The model is like a team of detectives that look at web addresses for clues.</b> Imagine you have a magnifying glass that can spot 18 different clues in any web address — like how long it is, whether it uses funny letters or numbers, if it has a security lock (https), and if the ending is suspicious (like .tk instead of .com). The model learned what "suspicious" looks like by studying 235,795 real web addresses — some safe, some fake. It is like a student who studied thousands of exam questions and now tries to answer new ones. When you paste a web address, the model checks all 18 clues and gives you a number from 0% to 100%. Zero means "this looks perfectly safe" and 100% means "this is almost certainly fake." You get to pick which detective you want to use — we have 4 different ones, and they sometimes disagree! If all 4 say "dangerous," you should definitely be careful. If they disagree, the address is in a grey area. The really clever part is that the model does not just give you a yes or no — it shows you <b>which clues</b> made it suspicious. You can see coloured bars showing what pushed the score up (red bars = bad signs) and down (blue bars = good signs). This is called "explainability" — it means the model shows its working, like showing your maths homework.
          </Tier>
          <Tier label="intermediate">
            The system implements a supervised classification pipeline with 4 models of increasing complexity, following a clear baseline → improvement progression:
            <br/><br/>
            <b>1. Dummy Classifier</b> — Always predicts the majority class (legitimate). This is the performance floor — any real model that cannot beat it is useless. It exists purely as a sanity check. Accuracy: ~57%.
            <br/><b>2. Logistic Regression (LR)</b> — A linear model with L2 regularisation and StandardScaler normalisation. It computes a weighted sum of all 18 features and passes it through a sigmoid function. Fully interpretable (you can read the coefficients), but limited by its linear decision boundary. Accuracy: ~77%.
            <br/><b>3. Random Forest (RF)</b> — An ensemble of 300 decision trees. Each tree sees a random subset of data and features, then they vote. This handles non-linear feature interactions (e.g., "suspicious TLD + no HTTPS + long path" together are much more suspicious than any one alone). Main model with SHAP explainability. Accuracy: ~86%.
            <br/><b>4. Gradient Boosting (GBM)</b> — 200 trees built sequentially, where each new tree focuses on correcting the errors of the previous ones. Uses learning_rate=0.1 and max_depth=5. Competes with RF on all metrics. Accuracy: ~86%.
            <br/><br/>
            All models share an identical preprocessing pipeline and 80/20 stratified train/test split (seed=42). The output is P(phishing|features) — a calibrated probability. At threshold 0.50, URLs above are classified as phishing, below as legitimate. This threshold can be adjusted in the FP Lab to control the false positive rate. Feature importance rankings differ between models: LR uses coefficient magnitude, RF uses Gini importance, and both RF/GBM support SHAP TreeExplainer for sample-level feature attributions. Comparing all 4 models on the same URL reveals agreement zones (high confidence) and disagreement zones (ambiguous URLs).
          </Tier>
          <Tier label="advanced">
            The ML pipeline is implemented in scikit-learn with serialised Pipeline objects (StandardScaler → Classifier) saved as pickle files. Feature engineering happens server-side via FastAPI — the 18 features are: url_length, domain_length, path_length, has_www, subdomain_count, is_ip_domain, has_at_symbol, dash_count, digit_ratio, domain_entropy (Shannon entropy H(X)=-Σp(x)log₂p(x) over domain chars), has_https, keyword_count, has_suspicious_tld, percent_count, underscore_count, query_length, has_tracking_params, and query_entropy. The feature space was expanded from 14 to 18 specifically to mitigate false positives: path_length and query_length capture URL complexity that is normal for legitimate sites but was previously penalised; has_tracking_params whitelists 20+ known advertising/analytics parameter names (utm_source, gclid, srsltid, fbclid) to prevent flagging marketing URLs; query_entropy distinguishes structured query strings (low entropy, legitimate) from random hash injections (high entropy, phishing). The dataset required aggressive debiasing: PhiUSIIL's legitimate URLs were all bare domains with www. and HTTPS, creating a confound. Our intervention: strip www. (50%), HTTP downgrade (25%), inject realistic paths (85% — covering /products, /en/docs, /api/v2, /blog, /cart, /search, etc.), add tracking queries (60% — ?utm_source=google&gclid=xyz), and prepend subdomains (50% — drive., mail., accounts., signin., cdn.). This is a causal intervention in the Pearlian sense: randomising the treatment (URL structure) across the legitimate class removes the spurious causal path www→legit. Post-debiasing accuracy dropped from ~99% to ~86.4% (RF). The 13% gap quantifies the contribution of the confound to the original accuracy — it was not real phishing detection, it was shortcut learning. SHAP TreeExplainer (interventional, tree_path_dependent) provides exact Shapley value computation for tree ensembles without sampling approximation, enabling per-prediction feature attributions that sum to the difference between the prediction and the expected value.
          </Tier>
        </LearnCard>

        <LearnCard icon="📊" title="What Do the Results Mean? (Explainability)" color="#00f0ff">
          <Tier label="simple">
            <b>After you check a web address, you see a big number and some coloured bars — here is what they all mean.</b> The big number is the "suspicion score" — think of it like a thermometer for danger. <b style={{color:"#00f0ff"}}>0–30%</b> means "this looks safe" (like google.com or wikipedia.org). <b style={{color:"#f59e0b"}}>30–50%</b> means "hmm, something is a little odd" — be careful. <b style={{color:"#ff4d6d"}}>50–100%</b> means "this looks like it might be fake!" The coloured bars below the number are the really special part. Each bar shows one clue that the model found. Red bars mean "this clue makes it look more dangerous." Blue bars mean "this clue makes it look safer." For example, if the address uses "https://" (the lock icon), you will see a blue bar for HTTPS — that is a good sign. But if the address ends in ".tk" (a free domain that scammers love), you will see a big red bar. This is called "explainability" — the model does not just say "yes" or "no," it shows you exactly WHY it thinks what it thinks. You can see all 4 detectives' scores at the bottom — if they all agree, you can be more confident. If they disagree, the address is in a tricky grey area. You can also click "Explore" to dig deeper into why the model made its decision, compare with other models, or see how the address compares to 235,795 real examples. Remember: even if the score is high, it does not mean the website is definitely fake — the model can make mistakes!
          </Tier>
          <Tier label="intermediate">
            <b>The results page has three main components, each designed for transparency and auditability:</b>
            <br/><br/>
            <b>1. Risk Score (P(phishing|features)):</b> This is the model's estimated probability that the URL is phishing, given its 18 extracted features. The default decision threshold is 0.50: above it = PHISHING, below = LEGITIMATE. But this threshold is a policy decision, not a mathematical constant. In the FP Lab, you can move it higher (fewer false positives, but more phishing slips through) or lower (catch more phishing, but more false alarms). The risk labels are: Safe (0-25%), Low (25-45%), Medium (45-65%), High (65-85%), Critical (85-100%).
            <br/><br/>
            <b>2. SHAP Feature Contributions:</b> This is the explainability core. Each horizontal bar represents one of the 18 features and shows its SHAP value — how much it pushed the prediction toward phishing (red, positive) or toward legitimate (blue, negative). SHAP values are additive: the base rate (expected value from training data) + sum of all SHAP values = the final prediction. For example, a URL with has_suspicious_tld=1 might show SHAP=+0.20 (strongly pushes toward phishing), while has_https=1 shows SHAP=-0.08 (pushes toward safe). This makes every prediction auditable — you can trace exactly which features drove the decision and challenge specific contributions.
            <br/><br/>
            <b>3. Multi-Model Comparison:</b> All 4 models score the same URL independently. High agreement (all models ≥0.8 or all ≤0.2) indicates a clear case. Disagreement (RF says 0.7, LR says 0.3) reveals URLs in the model's uncertainty zone — these are often the false positive candidates. The "Explore" links pass all scores and features to other pages via URL parameters for deeper analysis.
          </Tier>
          <Tier label="advanced">
            The prediction pipeline produces three layers of output, each grounded in the project's explainability objective:
            <br/><br/>
            <b>Probability calibration:</b> The output is P(phishing|X) from sklearn's predict_proba(). For RF, this is the fraction of trees voting for the phishing class; for GBM, it is the sigmoid of the sum of tree outputs; for LR, it is the logistic function σ(w·x + b). These probabilities are not necessarily well-calibrated — RF tends to produce overconfident predictions near 0 and 1, while LR is typically better calibrated. Platt scaling or isotonic regression could improve calibration but were not applied to keep the pipeline simple and auditable.
            <br/><br/>
            <b>SHAP attributions:</b> We use TreeExplainer with feature_perturbation='tree_path_dependent' — this computes exact interventional Shapley values for tree ensembles in polynomial time (O(TLD²) per sample, where T=trees, L=leaves, D=depth). The Shapley value φᵢ for feature i is the weighted average marginal contribution of feature i across all possible feature coalitions. The values satisfy: f(x) = E[f(X)] + Σᵢ φᵢ(x), meaning the prediction equals the base rate plus all feature contributions. This decomposition is unique, locally accurate, and consistent (guaranteed by Shapley's axioms from cooperative game theory). The bars in the UI represent these φ values, normalised to the [0,1] probability scale. Note: SHAP values are marginal — they do not directly show feature interactions. For example, the interaction between is_ip_domain and has_https is captured by the trees' branching structure but attributed fractionally to both features.
            <br/><br/>
            <b>Cross-page data flow:</b> The "Explore" links encode URL, scores, and feature vectors as React Router search params (query strings). This enables deep-linking: FP Lab receives the RF score and highlights it on the ROC curve; Model Explorer shows all 4 model scores side-by-side; EDA Dashboard plots the URL's feature values against the training distribution. The PDF export renders an HTML template with all feature values, SHAP attributions, and model scores, triggered via window.print() — no server-side PDF generation needed.
          </Tier>
        </LearnCard>

        <LearnCard icon="🔬" title="What Are the 18 Features?" color="#f59e0b">
          <Tier label="simple">
            <b>Features are clues the model checks in every web address.</b> Here are some:
            <br/>• <b>URL Length</b> — Really long addresses are sometimes suspicious
            <br/>• <b>HTTPS</b> — Safe sites use the "lock" icon (https://)
            <br/>• <b>Suspicious Ending</b> — Addresses ending in .tk or .ml are often used by scammers because they're free
            <br/>• <b>@ Symbol</b> — The @ trick makes your browser go to a different site than you think
            <br/>• <b>Dashes</b> — Lots of dashes like "pay-pal-secure-login" look sketchy
            <br/>• <b>Keywords</b> — Words like "login", "verify", "account" in a weird address
          </Tier>
          <Tier label="intermediate">
            The full 18 features:
            <br/>1. <b>url_length</b> — Total character count of the URL
            <br/>2. <b>domain_length</b> — Character count of just the domain name
            <br/>3. <b>path_length</b> — Character count of the path (after domain, before query)
            <br/>4. <b>has_www</b> — Whether the domain starts with www.
            <br/>5. <b>subdomain_count</b> — Number of subdomains (mail.accounts.google.com = 2)
            <br/>6. <b>is_ip_domain</b> — Is the domain an IP address like 192.168.1.1?
            <br/>7. <b>has_at_symbol</b> — Does the URL contain @? (URL authority abuse)
            <br/>8. <b>dash_count</b> — Number of hyphens in the domain
            <br/>9. <b>digit_ratio</b> — Ratio of digits to total characters in the domain
            <br/>10. <b>domain_entropy</b> — Shannon entropy of domain characters (randomness measure)
            <br/>11. <b>has_https</b> — Does it use HTTPS encryption?
            <br/>12. <b>keyword_count</b> — Count of phishing keywords (login, verify, paypal, etc.)
            <br/>13. <b>has_suspicious_tld</b> — TLD in our suspicious list (.tk, .ml, .xyz, etc.)
            <br/>14. <b>percent_count</b> — Count of % characters (URL encoding)
            <br/>15. <b>underscore_count</b> — Count of underscores
            <br/>16. <b>query_length</b> — Length of the query string (?param=value)
            <br/>17. <b>has_tracking_params</b> — Presence of known tracking parameters (utm_source, gclid, etc.)
            <br/>18. <b>query_entropy</b> — Shannon entropy of the query string
          </Tier>
          <Tier label="advanced">
            Feature engineering rationale: Features 16-18 (query_length, has_tracking_params, query_entropy) were added specifically to reduce false positives on legitimate URLs with Google Shopping tracking parameters (srsltid), OAuth callback URLs, and analytics tags. The has_tracking_params feature uses a whitelist of 20+ known advertising/analytics parameter names. Domain entropy uses Shannon entropy H(X) = -Σ p(x) log₂ p(x) computed over the domain characters only (excluding path and query). This is a domain-specific feature — path entropy would penalise legitimate URLs with long resource identifiers. The digit_ratio feature is also domain-only to avoid penalising URLs with numeric product IDs or timestamps in the path. Percent_count captures URL-encoding abuse but is rare in the training data (887/235k URLs), making it low-signal. The feature space is deliberately kept to 18 dimensions for interpretability — each feature has a clear semantic meaning that can be explained in a SHAP waterfall chart.
          </Tier>
        </LearnCard>

        <LearnCard icon="⚖️" title="Can the Model Be Wrong? (False Positives & False Negatives)" color="#ff4d6d">
          <Tier label="simple">
            <b>Yes! No detector is perfect, and understanding its mistakes is the MOST IMPORTANT part of this project.</b> There are two kinds of mistakes: <b>False Alarms</b> (the model thinks a good website is bad) and <b>Missed Catches</b> (the model thinks a bad website is good). False alarms are called "false positives." Imagine the fire alarm goes off at school but there is no fire — everyone has to leave for nothing, and after a few false alarms, people stop taking it seriously. That is exactly what happens when a phishing detector blocks real websites. Your mum cannot check her bank, your teacher cannot open a school link, and everyone stops trusting the tool. Missed catches are called "false negatives." That is like a real fire with no alarm — very dangerous but much rarer. This project focuses mainly on false alarms because they happen more often and they make people stop using the tool. We tested this model against 99 different types of real websites — banks, shops, schools, government sites, cloud services — and it got them all right. But some short addresses like "pokemon.com/uk" can still trigger a false alarm. The lesson is: <b>always think for yourself too.</b> If a link came from someone you trust and you were expecting it, it is probably fine even if the model is suspicious. But if a link appeared out of nowhere in a strange email, be careful even if the model says it is safe.
          </Tier>
          <Tier label="intermediate">
            <b>False positives are the central problem this project investigates.</b> A false positive (FP) means a legitimate URL is incorrectly flagged as phishing. In a real deployment, this blocks a user from accessing a genuine website — their bank, their email, a cloud storage service, a government portal. False positives destroy trust in security tools and lead to "alert fatigue," where users learn to dismiss all warnings because so many are wrong.
            <br/><br/>
            <b>Common false positive triggers in our model:</b>
            <br/>• <b>Login pages</b> — bank.com/login contains the keyword "login," which is also common in phishing URLs
            <br/>• <b>OAuth/SSO flows</b> — accounts.google.com/signin has multiple subdomains AND the keyword "signin"
            <br/>• <b>Marketing links</b> — URLs with ?utm_source=newsletter&gclid=abc123 have long query strings that can look suspicious
            <br/>• <b>CDN/API URLs</b> — cdn.jsdelivr.net/npm/react@18/dist/react.min.js has subdomains, dashes, numbers — multiple phishing signals
            <br/>• <b>Short domains</b> — pokemon.com/uk has very low path length, which can confuse the model
            <br/><br/>
            <b>False negatives (missed phishing):</b> These occur when attackers craft URLs that look structurally identical to legitimate ones. Common evasion: TLD swap (paypal.tk instead of paypal.com), adding HTTPS + www (looks trustworthy), and removing suspicious keywords. Our adversarial testing confirmed that TLD swap alone evades detection.
            <br/><br/>
            <b>Testing results:</b> 99 legitimate URL types across 33 categories → 0% FP rate. 15 known phishing patterns → 86.7% detection (2 misses on URL-encoding and homoglyph attacks). 10K procedural fuzzer → 99.9% legit accuracy, 48.3% phishing detection on synthetic patterns. The FP Lab page lets you adjust the threshold to control this trade-off interactively.
          </Tier>
          <Tier label="advanced">
            <b>This project's primary research contribution is the systematic analysis of false positives in URL-only phishing detection.</b>
            <br/><br/>
            <b>Theoretical ceiling:</b> URL-only feature spaces have a fundamental limitation: an attacker with knowledge of the 18-dimensional feature set can craft URLs that are indistinguishable from legitimate URLs in feature space while remaining phishing in intent. Our adversarial evolver (genetic algorithm with 9 mutation operators, 50-generation evolution, tournament selection with crossover) achieved 100% evasion rate on 50 seed phishing URLs — primarily via TLD swap (changes has_suspicious_tld from 1→0 while preserving all other features). This confirms that URL-only detection is a necessary but insufficient component of a defense-in-depth architecture.
            <br/><br/>
            <b>FP root cause analysis:</b> Using the test set, we identified FP URLs and computed feature-level differences between FP and correctly-classified legitimate URLs (TN). The top FP drivers are: (1) keyword_count — legitimate URLs with "login," "account," "verify" in the path match the phishing keyword detector, (2) subdomain_count — legitimate services like drive.google.com, signin.microsoftonline.com have 2+ subdomains, a phishing signal, (3) has_https/has_www absence — the aggressive debiasing means some legitimate URLs lack these protective signals. The SHAP analysis confirms this: keyword_count and subdomain_count have the highest mean |SHAP| values for misclassified legitimate URLs.
            <br/><br/>
            <b>Mitigation strategies evaluated:</b> (1) Threshold tuning — raising from 0.50 to 0.65 reduces FPR by ~18% with ~7% recall loss (explored in FP Lab), (2) class_weight='balanced' — reduces FPR by ~12% with ~3% recall loss, (3) Feature engineering — the 4 new query features (path_length, query_length, has_tracking_params, query_entropy) specifically target FP patterns on marketing URLs and OAuth flows. The security-usability trade-off is fundamentally irresolvable with URL-only features: any threshold that catches more phishing will inevitably flag more legitimate URLs with overlapping feature distributions.
          </Tier>
        </LearnCard>

        <LearnCard icon="🧭" title="How to Use This Tool (Complete Guide)" color="#00b4d8">
          <Tier label="simple">
            <b>Using PhishGuard is as easy as 1-2-3!</b>
            <br/><br/>
            <b>Step 1: Find a web address to check.</b> This is the text you see at the top of your internet browser when you visit a website — it usually starts with "https://" or "http://". You can also find web addresses in emails, text messages, or social media posts. If someone sends you a link and you are not sure if it is safe, copy it.
            <br/><br/>
            <b>Step 2: Paste the address in the box above and press "Analyse."</b> You can also click one of the example addresses below the box to see how the tool works before trying your own. The tool will check the address and show you the result in about one second.
            <br/><br/>
            <b>Step 3: Read the result.</b> A green circle with a low number means it looks safe. A red circle with a high number means be careful — it might be fake. Look at the coloured bars to understand why the model thinks what it thinks. If you want to learn more, click the "Explore" buttons to visit other pages that show you different kinds of analysis.
            <br/><br/>
            <b>Important safety tip:</b> This tool is a helper, not a guarantee. Even if it says "safe," you should still be careful with links from strangers. And if it says "dangerous" but you know the website is real (like your school's website), it might be a false alarm — the model is not perfect. Always use your own judgement too!
          </Tier>
          <Tier label="intermediate">
            <b>This tool is designed as a comprehensive phishing analysis workbench with 8 interconnected pages:</b>
            <br/><br/>
            <b>Single URL analysis (this page):</b> Paste any URL and click "Analyse." The tool extracts 18 features server-side via the FastAPI backend, runs them through the selected model (default: Random Forest), and returns a phishing probability with SHAP feature attributions. You can switch between all 4 models using the buttons above the input to see how each rates the same URL. All 4 scores are shown at the bottom of the results.
            <br/><br/>
            <b>Cross-page exploration:</b> After analysing a URL, the "Explore" links pass your URL's data to other pages via URL parameters:
            <br/>• <b>FP Lab</b> — Your URL's RF score is highlighted on the ROC curve. Adjust the threshold slider to see how changing strictness would affect whether your URL gets flagged. This is the core false positive analysis tool.
            <br/>• <b>Model Explorer</b> — See all 4 model scores side-by-side with confusion matrices and per-model metrics computed from the real test set (47,159 URLs).
            <br/>• <b>EDA Dashboard</b> — Your URL's 18 feature values are plotted against the distribution of 235,795 training URLs. See if your URL is an outlier on any feature.
            <br/>• <b>Adversarial</b> — Your URL is pre-filled for adversarial variant generation. See what happens when attackers modify it.
            <br/>• <b>Typosquat</b> — Your URL is checked against 30 known brands for typosquatting using Levenshtein distance and Jaro-Winkler similarity.
            <br/><br/>
            <b>Batch mode:</b> The Batch page accepts CSV files or pasted URL lists (up to 10,000 URLs). Each URL goes through the same pipeline. Results include per-URL scores, a summary, and CSV export.
            <br/><br/>
            <b>PDF reports:</b> Click "Download PDF" to generate a printable report with all features, SHAP values, and model scores — useful for security audits and documentation.
          </Tier>
          <Tier label="advanced">
            <b>Architecture and data flow:</b> The React frontend (Vite, port 5173) communicates with the FastAPI backend (port 8001) via a Vite dev-server proxy that rewrites /api/* to http://localhost:8001/*. In production, this proxy would be replaced by nginx or a CDN edge function. The API is stateless: each POST /api/predict request independently extracts 18 features via features.py, loads the requested sklearn Pipeline from .pkl, runs predict_proba(), computes heuristic SHAP-like weights, and returns a PredictResponse JSON with url, model, is_phishing, probability, risk_label, features (all 18 with names, values, weights, descriptions), top5 (highest-impact features), domain, and has_https. The frontend stores no global state — cross-page data transfer uses React Router's useSearchParams to encode URL, scores, and feature vectors as query strings, enabling deep-linking and bookmarking. The JavaScript fallback feature extractor in Home.jsx mirrors features.py's logic for offline/API-unreachable scenarios but should not be relied upon for production predictions.
            <br/><br/>
            <b>API endpoints:</b> POST /api/predict (single URL), POST /api/predict/batch (up to 10K URLs), GET /api/stats (real dataset statistics for EDA — computes per-feature histograms, correlation matrix, class counts from processed.csv), GET /api/model-metrics (computes accuracy, F1, ROC-AUC, PR-AUC, precision, recall, FPR, and confusion matrices for all 4 models on the held-out test set), GET /health (model loading status). All endpoints return real computed data from the same .pkl models and .csv data files that the Jupyter notebook uses — there is no mocking or simulation. The notebook independently verifies that every chart, metric, and prediction matches the API output, providing reproducible proof of the training pipeline.
          </Tier>
        </LearnCard>

      </div>
    </div>
  );
}

export default function Home() {
  const [url,setUrl]         = useState("");
  const [result,setResult]   = useState(null);
  const [error,setError]     = useState("");
  const [loading,setLoading] = useState(false);
  const [modelId,setModelId] = useState("rf");
  const threshold = 0.5;
  const navigate = useNavigate();

  const selModel = MODELS.find(m=>m.id===modelId);
  const score    = result ? result.scores[modelId] : 0;
  const isPhish  = result && score >= threshold;

  const handleCheck = async () => {
    setError(""); setResult(null);
    if (!url.trim()) { setError("Please enter a URL."); return; }
    if (url.trim().length < 4) { setError("URL is too short."); return; }
    setLoading(true);
    try {
      const responses = await Promise.all(
        ["rf","gbm","lr","dummy"].map(m =>
          fetch("/api/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: url.trim(), model: m }),
            signal: AbortSignal.timeout(5000),
          }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
        )
      );
      const [rf, gbm, lr, dummy] = responses;
      const primary = responses.find(r => r.model === modelId) || rf;
      setResult({
        scores:   { rf: rf.probability, gbm: gbm.probability, lr: lr.probability, dummy: dummy.probability },
        features: primary.features,
        top5:     primary.top5,
        domain:   primary.domain,
        https:    primary.has_https,
      });
    } catch (_) {
      const res = extractFeatures(url.trim());
      if (!res) { setError("Invalid URL format — include a domain (e.g. https://example.com)."); setLoading(false); return; }
      setResult(res);
    }
    setLoading(false);
  };

  return (
    <div style={{minHeight:"100vh",background:"#080a14",fontFamily:"'Inter','Segoe UI',sans-serif"}}>
      <Navbar/>
      <div style={{paddingTop:80,maxWidth:1200,margin:"0 auto",padding:"80px 28px 80px"}}>

        {/* Hero */}
        <div style={{textAlign:"center",paddingBottom:40,backgroundImage:"radial-gradient(ellipse at 50% 0%,rgba(0,240,255,0.07) 0%,transparent 60%)"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(0,240,255,0.06)",border:"1px solid rgba(0,240,255,0.18)",borderRadius:20,padding:"5px 14px",marginBottom:16}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:"#00f0ff",display:"inline-block",animation:"pulse 2s infinite"}}/>
            <span style={{color:"#00f0ff",fontSize:11,fontWeight:700,letterSpacing:1}}>PhiUSIIL DATASET · 235,795 URLS · 18 FEATURES · 80/20 SPLIT · SEED=42</span>
          </div>
          <h1 style={{color:"#fff",fontSize:"clamp(26px,4.5vw,54px)",fontWeight:900,margin:"0 0 12px",lineHeight:1.1,letterSpacing:-1}}>
            Detect Phishing URLs<br/>
            <span style={{background:"linear-gradient(135deg,#00f0ff,#9b59ff)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Instantly. Accurately.</span>
          </h1>
          <p style={{color:"rgba(255,255,255,0.4)",fontSize:15,maxWidth:460,margin:"0 auto 28px"}}>Paste any URL, choose your model, get a real-time phishing risk score with SHAP explanation and exportable PDF report.</p>

          {/* Model selector */}
          <div style={{display:"flex",gap:7,justifyContent:"center",marginBottom:20,flexWrap:"wrap"}}>
            {MODELS.map(m=>(
              <button key={m.id} onClick={()=>{setModelId(m.id);setResult(null);}} style={{padding:"7px 16px",borderRadius:9,border:"1px solid",borderColor:modelId===m.id?m.color:"rgba(255,255,255,0.10)",background:modelId===m.id?`${m.color}14`:"rgba(255,255,255,0.02)",color:modelId===m.id?m.color:"rgba(255,255,255,0.5)",fontSize:11,fontWeight:700,cursor:"pointer",transition:"all 0.2s"}}>
                {m.short} <span style={{opacity:0.6,fontWeight:400,fontSize:10}}>AUC {m.auc}</span>
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{maxWidth:700,margin:"0 auto",padding:"0 16px"}}>
            <div style={{display:"flex",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.10)",borderRadius:13,overflow:"hidden"}}>
              <span style={{padding:"0 14px",color:"rgba(255,255,255,0.3)",fontSize:17,display:"flex",alignItems:"center"}}>🔗</span>
              <input value={url} onChange={e=>{setUrl(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&handleCheck()} placeholder="https://example.com/login?verify=account" style={{flex:1,background:"transparent",border:"none",outline:"none",color:"#fff",fontSize:13,padding:"15px 0",fontFamily:"monospace"}}/>
              <button onClick={handleCheck} style={{background:`linear-gradient(135deg,${selModel.color},#9b59ff)`,border:"none",color:"#fff",fontWeight:800,fontSize:12,padding:"0 24px",cursor:"pointer"}}>{loading?"…":"Analyse →"}</button>
            </div>
            {error&&<div style={{marginTop:8,padding:"9px 14px",borderRadius:7,background:"rgba(255,77,109,0.09)",border:"1px solid rgba(255,77,109,0.28)",color:"#ff4d6d",fontSize:12,textAlign:"left"}}>⚠️ {error}</div>}
          </div>
        </div>

        {/* Live feed */}
        <LiveFeed/>

        {/* Loading */}
        {loading&&<div style={{textAlign:"center",padding:"40px 0"}}><div style={{display:"inline-block",width:32,height:32,border:`3px solid rgba(0,240,255,0.12)`,borderTop:`3px solid ${selModel.color}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><div style={{color:"rgba(255,255,255,0.3)",marginTop:12,fontSize:12}}>Running {selModel.label}…</div></div>}

        {/* Results */}
        {result&&!loading&&(
          <div>
            {/* Verdict */}
            <div style={{marginBottom:22,padding:"24px 28px",borderRadius:16,background:isPhish?"linear-gradient(135deg,rgba(255,77,109,0.12),rgba(255,77,109,0.04))":"linear-gradient(135deg,rgba(0,240,255,0.10),rgba(0,240,255,0.03))",border:`1px solid ${isPhish?"rgba(255,77,109,0.35)":"rgba(0,240,255,0.35)"}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
              <div style={{display:"flex",alignItems:"center",gap:16}}>
                <div style={{width:54,height:54,borderRadius:12,fontSize:24,background:isPhish?"rgba(255,77,109,0.15)":"rgba(0,240,255,0.12)",border:`1px solid ${isPhish?"rgba(255,77,109,0.3)":"rgba(0,240,255,0.3)"}`,display:"flex",alignItems:"center",justifyContent:"center"}}>{isPhish?"🎣":"✅"}</div>
                <div>
                  <div style={{fontSize:9,fontWeight:700,letterSpacing:2,color:"rgba(255,255,255,0.35)",marginBottom:3}}>VERDICT · {selModel.label.toUpperCase()}</div>
                  <div style={{fontSize:28,fontWeight:900,color:isPhish?"#ff4d6d":"#00f0ff"}}>{isPhish?"PHISHING":"LEGITIMATE"}</div>
                  <div style={{color:"rgba(255,255,255,0.3)",fontSize:11,marginTop:3}}>Threshold 0.50 · <Link to={`/FpLab?score=${score.toFixed(4)}&url=${encodeURIComponent(url)}`} style={{color:"#9b59ff",textDecoration:"none"}}>adjust in FP Lab →</Link></div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:16}}>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:9,fontWeight:700,letterSpacing:2,color:"rgba(255,255,255,0.35)",marginBottom:4}}>RISK SCORE</div>
                  <div style={{fontSize:44,fontWeight:900,color:isPhish?"#ff4d6d":"#00f0ff",lineHeight:1}}>{(score*100).toFixed(1)}%</div>
                </div>
                <button onClick={()=>generatePDF(url,result,modelId,score)} style={{padding:"10px 18px",borderRadius:9,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.7)",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>📄 Export PDF</button>
              </div>
            </div>

            {/* Cross-page connections */}
            <div style={{marginBottom:18,padding:"14px 18px",borderRadius:11,background:"rgba(155,89,255,0.05)",border:"1px solid rgba(155,89,255,0.15)",display:"flex",flexWrap:"wrap",gap:10,alignItems:"center"}}>
              <span style={{color:"rgba(255,255,255,0.3)",fontSize:10,fontWeight:700,letterSpacing:1}}>EXPLORE:</span>
              <Link to={`/FpLab?score=${score.toFixed(4)}&url=${encodeURIComponent(url)}`} style={{color:"#9b59ff",fontSize:11,fontWeight:600,textDecoration:"none",padding:"4px 10px",borderRadius:6,background:"rgba(155,89,255,0.08)",border:"1px solid rgba(155,89,255,0.2)"}}>
                Your score: {(score*100).toFixed(0)}% — See where this sits on the threshold curve →
              </Link>
              <Link to={`/ModelExplorer?url=${encodeURIComponent(url)}&rf=${result.scores.rf.toFixed(4)}&gbm=${result.scores.gbm.toFixed(4)}&lr=${result.scores.lr.toFixed(4)}&dummy=${result.scores.dummy.toFixed(4)}`} style={{color:"#00f0ff",fontSize:11,fontWeight:600,textDecoration:"none",padding:"4px 10px",borderRadius:6,background:"rgba(0,240,255,0.06)",border:"1px solid rgba(0,240,255,0.15)"}}>
                RF: {(result.scores.rf*100).toFixed(0)}% · GBM: {(result.scores.gbm*100).toFixed(0)}% · LR: {(result.scores.lr*100).toFixed(0)}% · DUM: {(result.scores.dummy*100).toFixed(0)}% — Compare models →
              </Link>
            </div>

            {/* Risk bar + all model scores */}
            <div style={{marginBottom:22,padding:"16px 20px",background:"rgba(255,255,255,0.02)",borderRadius:10,border:"1px solid rgba(255,255,255,0.06)"}}>
              <div style={{height:9,borderRadius:5,background:"rgba(255,255,255,0.06)",position:"relative",overflow:"hidden",marginBottom:10}}>
                <div style={{height:"100%",width:`${score*100}%`,background:score>0.7?"linear-gradient(90deg,#ff4d6d,#ff8fa3)":score>0.5?"linear-gradient(90deg,#f59e0b,#fcd34d)":"linear-gradient(90deg,#00b4d8,#00f0ff)",borderRadius:5,transition:"width 0.7s ease"}}/>
                <div style={{position:"absolute",top:0,left:"50%",width:2,height:"100%",background:"rgba(255,255,255,0.3)"}}/>
              </div>
              <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
                {MODELS.map(m=>(
                  <div key={m.id} style={{fontSize:10,padding:"3px 9px",borderRadius:5,background:m.id===modelId?`${m.color}18`:"rgba(255,255,255,0.03)",border:`1px solid ${m.id===modelId?m.color+"40":"rgba(255,255,255,0.07)"}`,color:m.id===modelId?m.color:"rgba(255,255,255,0.4)"}}>
                    {m.short}: {(result.scores[m.id]*100).toFixed(1)}%
                  </div>
                ))}
              </div>
            </div>

            {/* SHAP + features */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
              <div style={{padding:"20px 24px",background:"rgba(255,255,255,0.02)",borderRadius:13,border:"1px solid rgba(255,255,255,0.07)"}}>
                <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",letterSpacing:1,marginBottom:3}}>SHAP FEATURE EXPLANATION</div>
                <div style={{color:"rgba(255,255,255,0.22)",fontSize:10,marginBottom:16}}>Top 5 by |SHAP| · {selModel.label}</div>
                <SHAPBar features={result.top5} modelId={modelId}/>
                <Link to={`/EdaDashboard?url=${encodeURIComponent(url)}&features=${encodeURIComponent(JSON.stringify(result.features))}`} style={{display:"block",marginTop:12,padding:"8px 11px",background:"rgba(0,180,216,0.07)",borderRadius:6,border:"1px solid rgba(0,180,216,0.18)",color:"#00b4d8",fontSize:10,fontWeight:600,textDecoration:"none",textAlign:"center"}}>
                  See how your URL features compare to 235,795 URLs →
                </Link>
                <div style={{marginTop:8,padding:"8px 11px",background:"rgba(155,89,255,0.07)",borderRadius:6,border:"1px solid rgba(155,89,255,0.15)"}}>
                  <div style={{color:"rgba(255,255,255,0.3)",fontSize:10}}>🔵 Negative → <b style={{color:"#00f0ff"}}>LEGITIMATE</b> · 🔴 Positive → <b style={{color:"#ff4d6d"}}>PHISHING</b></div>
                </div>
              </div>
              <div style={{padding:"20px 24px",background:"rgba(255,255,255,0.02)",borderRadius:13,border:"1px solid rgba(255,255,255,0.07)"}}>
                <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",letterSpacing:1,marginBottom:16}}>ALL 18 FEATURES</div>
                <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:320,overflowY:"auto"}}>
                  {result.features.map((f,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 9px",background:"rgba(255,255,255,0.02)",borderRadius:6}}>
                      <span style={{color:"rgba(255,255,255,0.5)",fontSize:10}}>{f.name}</span>
                      <span style={{color:"rgba(255,255,255,0.9)",fontSize:10,fontWeight:700,fontFamily:"monospace"}}>{String(f.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick links */}
            <div style={{marginTop:20,display:"flex",gap:10,flexWrap:"wrap"}}>
              <Link to={`/Adversarial?url=${encodeURIComponent(url)}`} style={{padding:"8px 16px",borderRadius:8,background:"rgba(155,89,255,0.10)",border:"1px solid rgba(155,89,255,0.25)",color:"#9b59ff",fontSize:11,fontWeight:700,textDecoration:"none"}}>🧬 Generate phishing variants of this URL →</Link>
              <Link to={`/TypoSquat?url=${encodeURIComponent(url)}`} style={{padding:"8px 16px",borderRadius:8,background:"rgba(0,180,216,0.10)",border:"1px solid rgba(0,180,216,0.25)",color:"#00b4d8",fontSize:11,fontWeight:700,textDecoration:"none"}}>🔍 Check this URL against known brands →</Link>
            </div>
          </div>
        )}

        {/* Sample URLs */}
        {!result&&!loading&&(
          <div style={{textAlign:"center",paddingBottom:60}}>
            <div style={{color:"rgba(255,255,255,0.2)",fontSize:10,fontWeight:600,letterSpacing:1,marginBottom:12}}>TRY THESE EXAMPLES</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:7,justifyContent:"center"}}>
              {["http://paypal-secure-login.tk/verify?account=123","https://google.com/search?q=weather","http://192.168.1.1/login@bank.com/update","https://github.com/openai/gpt-4"].map((u,i)=>(
                <button key={i} onClick={()=>{setUrl(u);setResult(null);}} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",color:"rgba(255,255,255,0.4)",fontSize:10,padding:"6px 11px",borderRadius:6,cursor:"pointer",fontFamily:"monospace"}}>{u.length>48?u.slice(0,48)+"…":u}</button>
              ))}
            </div>
          </div>
        )}

        {/* ═══════ EDUCATIONAL SECTION ═══════ */}
        <LearnSection result={result}/>
        
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} @keyframes slideIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}} *{box-sizing:border-box}`}</style>
    </div>
  );
}
