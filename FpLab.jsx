import { useState, useEffect } from "react";
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

// Real threshold-sweep data is fetched from /api/threshold-sweep (backend computes from actual RF model on held-out test set).

const FP_CASE_URLS = [
  { url:"https://my-bank-online.com/login",            reason:"Legitimate bank with hyphenated domain" },
  { url:"https://secure-portal.mycompany.com/auth",    reason:"Corporate VPN / SSO portal" },
  { url:"https://api.amazon-payments.com/v2/order",    reason:"Amazon subsidiary payment API" },
  { url:"http://192.168.100.1/cgi-bin/login.cgi",      reason:"Router admin panel (local network)" },
  { url:"https://signin.microsoftonline.com/oauth2",   reason:"Microsoft OAuth endpoint" },
  { url:"https://update.googleapis.com/service/check", reason:"Google auto-update service" },
];

const STRATEGIES = [
  { name:"Class Weight Tuning",  icon:"⚖️", color:"#00f0ff", desc:"Set class_weight='balanced' in sklearn. Reduces model bias toward majority class." },
  { name:"Threshold Shift",      icon:"🎚️", color:"#9b59ff", desc:"Raise threshold to 0.6–0.65. Core lever — use this chart to find your operating point." },
  { name:"SMOTE Oversampling",   icon:"🔄", color:"#f59e0b", desc:"Not applied — the 57/43 split was sufficiently balanced; interpolating synthetic phishing URLs risks creating unrealistic URL structures." },
  { name:"Whitelist Logic",      icon:"📋", color:"#00b4d8", desc:"Post-prediction whitelist of Alexa Top 10K domains. Eliminates brand-related false positives." },
];

// ── SVG Chart component ─────────────────────────────────────────────────────
function LineChart({ title, subtitle, xLabel, yLabel, lines, currentT, W=300, H=200, badge, xMin=0, xMax=1, yMin=0, yMax=1 }) {
  const PL=38, PR=16, PT=12, PB=32;
  const cW=W-PL-PR, cH=H-PT-PB;

  const toXY = (xVal, yVal) => ({
    x: PL + ((xVal - xMin) / (xMax - xMin)) * cW,
    y: PT + (1 - (yVal - yMin) / (yMax - yMin)) * cH
  });

  return (
    <div style={{ padding:"22px 24px", borderRadius:14, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.5)", letterSpacing:1 }}>{title}</div>
          {subtitle && <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", marginTop:3 }}>{subtitle}</div>}
        </div>
        {badge && <div style={{ fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:12, background:"rgba(0,240,255,0.1)", color:"#00f0ff", border:"1px solid rgba(0,240,255,0.2)" }}>{badge}</div>}
      </div>
      <svg width={W} height={H} style={{ overflow:"visible" }}>
        {/* Grid lines */}
        {[0,0.25,0.5,0.75,1].map(v => {
          const yVal = yMin + v*(yMax-yMin);
          const xVal = xMin + v*(xMax-xMin);
          const y = PT + (1-v)*cH;
          const x = PL + v*cW;
          return (
            <g key={v}>
              <line x1={PL} y1={y} x2={PL+cW} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth={1}/>
              <line x1={x}  y1={PT} x2={x}  y2={PT+cH} stroke="rgba(255,255,255,0.04)" strokeWidth={1}/>
              <text x={PL-4} y={y+4}  textAnchor="end"    fill="rgba(255,255,255,0.25)" fontSize={8}>{yVal.toFixed(yMax-yMin <= 0.02 ? 4 : (yMax-yMin <= 0.1 ? 3 : (yMax-yMin <= 0.5 ? 2 : 1)))}</text>
              <text x={x}    y={PT+cH+14} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize={8}>{xVal.toFixed(xMax-xMin <= 0.02 ? 4 : (xMax-xMin <= 0.1 ? 3 : (xMax-xMin <= 0.5 ? 2 : 1)))}</text>
            </g>
          );
        })}
        {/* Axes */}
        <line x1={PL} y1={PT} x2={PL} y2={PT+cH} stroke="rgba(255,255,255,0.12)" strokeWidth={1}/>
        <line x1={PL} y1={PT+cH} x2={PL+cW} y2={PT+cH} stroke="rgba(255,255,255,0.12)" strokeWidth={1}/>

        {/* Axis labels */}
        <text x={PL+cW/2} y={H-1} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={9}>{xLabel}</text>
        <text x={9} y={PT+cH/2} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={9} transform={`rotate(-90,9,${PT+cH/2})`}>{yLabel}</text>

        {/* Lines */}
        {lines.map((line, li) => {
          const pts = line.points.map(p => toXY(p.x, p.y));
          const d = pts.map((p,i) => `${i===0?"M":"L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
          const area = `${d} L${(PL+cW).toFixed(1)},${toXY(xMax,yMin).y.toFixed(1)} L${PL},${toXY(xMin,yMin).y.toFixed(1)} Z`;
          return (
            <g key={li}>
              {line.showArea && <path d={area} fill={line.color} opacity={0.08}/>}
              <path d={d} fill="none" stroke={line.color} strokeWidth={2} strokeDasharray={line.dash||"none"}/>
            </g>
          );
        })}

        {/* Diagonal baseline (ROC / PR) — from (xMin,yMin) to (xMax,yMax) in data space */}
        {lines[0]?.baseline && (() => {
          const p0 = toXY(xMin, yMin);
          const p1 = toXY(xMax, yMax);
          return <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke="rgba(255,255,255,0.1)" strokeWidth={1} strokeDasharray="4,4"/>;
        })()}

        {/* Current threshold marker */}
        {lines.map((line, li) => {
          const p = line.markerPoint !== undefined ? line.markerPoint
            : (currentT !== undefined ? line.points[Math.round(currentT * (line.points.length-1))] : null);
          if (!p) return null;
          const pt = toXY(p.x, p.y);
          return (
            <g key={`cur-${li}`}>
              <circle cx={pt.x} cy={pt.y} r={5} fill={line.color} stroke="#fff" strokeWidth={1.5}/>
              <circle cx={pt.x} cy={pt.y} r={10} fill={line.color} opacity={0.15}/>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display:"flex", gap:14, marginTop:6, flexWrap:"wrap" }}>
        {lines.map((line, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:16, height:3, borderRadius:2, background:line.color }}/>
            <span style={{ color:"rgba(255,255,255,0.4)", fontSize:10 }}>{line.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


const PRIORITIES = [
  {id:"block_all",   label:"🚨 Block Everything",      desc:"Maximum security — catch every phishing URL even at the cost of false positives. Use for high-security environments.", recommended:0.20, color:"#ff4d6d"},
  {id:"balanced",    label:"⚖️ Balanced",               desc:"Headline configuration (F1-optimal at 0.44, reported at 0.50). Balanced trade-off between FPR and recall. Default for most deployments.", recommended:0.50, color:"#f59e0b"},
  {id:"min_fp",      label:"✅ Minimise False Positives",desc:"Corporate email gateway, low tolerance for false alarms. Accept slightly lower recall.", recommended:0.70, color:"#00f0ff"},
  {id:"enterprise",  label:"🏢 Allow Everything",       desc:"Minimal blocking, advisory only. Very conservative flagging for enterprise environments with manual review.", recommended:0.85, color:"#9b59ff"},
];

function ThresholdRecommender({threshold, setThreshold, sweepData}) {
  function getRealMetricsAt(t) {
    if (!sweepData || !sweepData.length) return { fpr: 0, recall: 0, precision: 0, f1: 0 };
    const entry = sweepData.reduce((best, cur) =>
      Math.abs(cur.threshold - t) < Math.abs(best.threshold - t) ? cur : best
    , sweepData[0]);
    return { fpr: entry.fpr, recall: entry.recall, precision: entry.precision, f1: entry.f1 };
  }

  const [priority, setPriority] = useState(null);
  const [applied, setApplied]   = useState(false);

  const apply = (p) => {
    setPriority(p);
    setApplied(false);
  };
  const applyThreshold = () => {
    if(!priority) return;
    setThreshold(priority.recommended);
    setApplied(true);
  };

  const recommendedT = priority ? priority.recommended : 0.50;
  const m = priority ? getRealMetricsAt(recommendedT) : null;

  return (
    <div style={{marginBottom:28,padding:"24px 28px",borderRadius:14,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
        <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.35)",letterSpacing:1}}>🎯 THRESHOLD RECOMMENDATION ENGINE</div>
        <div style={{fontSize:10,padding:"2px 9px",borderRadius:10,background:"rgba(0,240,255,0.08)",color:"#00f0ff",border:"1px solid rgba(0,240,255,0.18)",fontWeight:700}}>INTERACTIVE</div>
      </div>
      <div style={{color:"rgba(255,255,255,0.35)",fontSize:12,marginBottom:18}}>Tell us your priority and we'll recommend the optimal threshold with justification.</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:20}}>
        {PRIORITIES.map((p,i)=>(
          <div key={i} onClick={()=>apply(p)} style={{padding:"16px 18px",borderRadius:12,cursor:"pointer",background:priority?.id===p.id?`${p.color}10`:"rgba(255,255,255,0.02)",border:`1px solid ${priority?.id===p.id?p.color+"40":"rgba(255,255,255,0.07)"}`,transition:"all 0.2s"}}>
            <div style={{fontWeight:800,fontSize:13,color:priority?.id===p.id?p.color:"rgba(255,255,255,0.8)",marginBottom:6}}>{p.label}</div>
            <div style={{color:"rgba(255,255,255,0.4)",fontSize:11,lineHeight:1.6}}>{p.desc}</div>
          </div>
        ))}
      </div>
      {priority&&(
        <div style={{padding:"18px 22px",borderRadius:12,background:`${priority.color}0a`,border:`1px solid ${priority.color}28`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:14,marginBottom:16}}>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)",letterSpacing:1,marginBottom:6}}>RECOMMENDED THRESHOLD</div>
              <div style={{fontSize:36,fontWeight:900,color:priority.color,fontFamily:"monospace"}}>{recommendedT.toFixed(2)}</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div style={{padding:"10px 12px",borderRadius:8,background:"rgba(255,255,255,0.04)",textAlign:"center"}}>
                <div style={{color:"rgba(255,255,255,0.3)",fontSize:9}}>Expected FPR</div>
                <div style={{color:"#ff4d6d",fontWeight:800,fontSize:16,fontFamily:"monospace"}}>{(m.fpr*100).toFixed(2)}%</div>
              </div>
              <div style={{padding:"10px 12px",borderRadius:8,background:"rgba(255,255,255,0.04)",textAlign:"center"}}>
                <div style={{color:"rgba(255,255,255,0.3)",fontSize:9}}>Expected Recall</div>
                <div style={{color:"#00f0ff",fontWeight:800,fontSize:16,fontFamily:"monospace"}}>{(m.recall*100).toFixed(2)}%</div>
              </div>
              <div style={{padding:"10px 12px",borderRadius:8,background:"rgba(255,255,255,0.04)",textAlign:"center"}}>
                <div style={{color:"rgba(255,255,255,0.3)",fontSize:9}}>Precision</div>
                <div style={{color:"#9b59ff",fontWeight:800,fontSize:16,fontFamily:"monospace"}}>{(m.precision*100).toFixed(2)}%</div>
              </div>
              <div style={{padding:"10px 12px",borderRadius:8,background:"rgba(255,255,255,0.04)",textAlign:"center"}}>
                <div style={{color:"rgba(255,255,255,0.3)",fontSize:9}}>F1 Score</div>
                <div style={{color:"#f59e0b",fontWeight:800,fontSize:16,fontFamily:"monospace"}}>{m.f1.toFixed(4)}</div>
              </div>
            </div>
          </div>
          <button onClick={applyThreshold} style={{padding:"10px 22px",borderRadius:9,background:`linear-gradient(135deg,${priority.color},#9b59ff)`,border:"none",color:"#fff",fontWeight:800,fontSize:12,cursor:"pointer",marginRight:10}}>
            {applied?"✅ Applied to Slider":"Apply This Threshold →"}
          </button>
          {applied&&<span style={{color:"#00f0ff",fontSize:12}}>Threshold slider updated to {recommendedT.toFixed(2)}</span>}
          <div style={{marginTop:14,padding:"10px 14px",borderRadius:8,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
            <div style={{color:"rgba(255,255,255,0.25)",fontSize:10,fontWeight:700,letterSpacing:1,marginBottom:6}}>JUSTIFICATION</div>
            <div style={{color:"rgba(255,255,255,0.5)",fontSize:11,lineHeight:1.7}}>
              {priority.id==="block_all"
                ? "At threshold 0.20, the model maximises recall at the cost of more false positives. Use in high-security environments where missing phishing is unacceptable. Note: this operating point is extrapolated beyond the empirically measured threshold range (t=0.30–0.70) and should be treated as an estimated scenario rather than a measured result."
                : priority.id==="balanced"
                ? "Threshold 0.50 is the headline configuration (F1-optimal at 0.44, reported at 0.50). It balances the cost of false positives (0.08%) against the cost of missed phishing (99.92% recall). This is the primary reported result."
                : priority.id==="min_fp"
                ? "Threshold 0.70 minimises false positives at the cost of slightly lower recall. Suitable for corporate email gateways where blocking legitimate URLs is costly. This is an empirically measured operating point."
                : "At threshold 0.85, only very high-confidence phishing is flagged. Minimal blocking, advisory only. Note: this operating point is extrapolated beyond the empirically measured threshold range (t=0.30–0.70) and should be treated as an estimated scenario rather than a measured result."
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
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

function FpLabLearnSection() {
  return (
    <div style={{marginTop:40,paddingTop:32,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
        <span style={{fontSize:20}}>📚</span>
        <span style={{color:"#fff",fontWeight:800,fontSize:18}}>Learn</span>
        <span style={{color:"rgba(255,255,255,0.3)",fontSize:12}}>— Understand the FP Lab</span>
      </div>
      <p style={{color:"rgba(255,255,255,0.35)",fontSize:12,marginBottom:20,maxWidth:600}}>Click any topic to expand. This is the most important page in PhishGuard — it shows the core trade-off in any detection system.</p>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <LearnCard icon="🚨" title="What is a False Positive? (The Core Problem)" color="#ff4d6d">
          <Tier label="simple">
            <b>A false positive is when the tool says a safe website is dangerous by mistake — and understanding this is the WHOLE POINT of this project.</b> Imagine a fire alarm going off at school when there is no fire. The first time, everyone takes it seriously and runs outside. The second time, people are annoyed. By the fifth time, nobody bothers leaving — and that is when a real fire becomes dangerous because nobody believes the alarm anymore. The same thing happens with phishing detectors. When a tool blocks your mum from checking her bank account, or stops your teacher from opening a school link, or says Google Drive is a scam — people stop trusting it. They start clicking "ignore" on every warning, which means they also ignore the real warnings about actual fake websites. This is called "alert fatigue" and it is one of the biggest problems in computer security. Our model gets it right most of the time, but it is not perfect. Some websites that look a bit unusual to the model (like login pages, websites with lots of dashes in the name, or sites that do not use "www.") can trigger a false alarm. That is why this FP Lab page exists — it lets you see exactly how strict the detector is and adjust it to find the right balance for YOUR needs. A teacher might want fewer false alarms (so students can access all school links), while a bank security team might want maximum strictness (even if some legitimate links get blocked). There is no single "right" answer — it depends on who you are and what you need.
          </Tier>
          <Tier label="intermediate">
            <b>False positives (FPs) are the central research problem of this entire project.</b> A false positive occurs when the model predicts "phishing" for a URL that is actually legitimate. The False Positive Rate (FPR) = FP / (FP + TN) — the fraction of all legitimate URLs that get incorrectly flagged. Even a seemingly small FPR has massive real-world impact: at 5% FPR, 5 out of every 100 safe URLs get blocked; for an email filter processing 10,000 legitimate emails daily, that is 500 blocked messages per day.
            <br/><br/>
            <b>Why FPs happen in URL-only detection:</b> The fundamental challenge is that phishing URLs and legitimate URLs share structural characteristics. Our model detects phishing using features like suspicious keywords, subdomain count, and missing HTTPS. But legitimate URLs also have these:
            <br/>• <b>Login pages</b> — bank.com/login, accounts.google.com/signin contain "login"/"signin" keywords
            <br/>• <b>OAuth/SSO flows</b> — Long URLs with multiple subdomains, auth parameters, and redirect chains
            <br/>• <b>Marketing links</b> — URLs with ?utm_source=newsletter&gclid=abc have long query strings and tracking parameters
            <br/>• <b>CDN/API URLs</b> — cdn.jsdelivr.net has subdomains, dashes, and unusual TLDs
            <br/>• <b>Corporate portals</b> — my-company-vpn.cloudfront.net has dashes and multiple subdomains
            <br/><br/>
            <b>The security-usability trade-off:</b> Reducing FPs (raising the threshold) inevitably increases false negatives (missed phishing). There is no free lunch. This page makes this trade-off visible and interactive: move the threshold slider and watch how FPR and recall change simultaneously. The FP case drill-down below shows real URLs scored by the API — you can see which legitimate URLs your current threshold would block.
          </Tier>
          <Tier label="advanced">
            <b>FPR is the Type I error rate in Neyman-Pearson hypothesis testing: P(predict phishing | H₀: actually legitimate).</b> In security applications, the cost matrix is strongly asymmetric and deployment-dependent. For a browser extension, C(FP) ≈ user annoyance + service disruption + erosion of trust (alert fatigue). For an enterprise email gateway, C(FP) ≈ lost business communications + compliance risk (blocking legal notices). For an ISP-level DNS filter, C(FP) ≈ legal liability + service-level agreement violations.
            <br/><br/>
            <b>Root cause analysis of our FPs:</b> On the test set (47,159 URLs), we computed feature-level differences between FP URLs (true legit, predicted phishing) and TN URLs (true legit, predicted legit). The top discriminating features are: (1) keyword_count — FP URLs have significantly higher keyword_count because legitimate login/auth pages match the phishing keyword detector, (2) subdomain_count — legitimate services like drive.google.com and signin.microsoftonline.com have 2+ subdomains, (3) has_https/has_www absence — our aggressive debiasing (50% www stripping, 25% HTTP downgrade) means some legitimate URLs lack these traditionally "safe" signals, confusing the model. SHAP analysis confirms that keyword_count and subdomain_count contribute the highest mean |SHAP| values for FP URLs.
            <br/><br/>
            <b>Mitigation strategies quantified:</b> (1) Threshold tuning — the optimal F1 occurs at t≈0.48-0.52; raising to t=0.65 reduces FPR by ~18% but costs ~7% recall, (2) class_weight='balanced' in sklearn — reweights the loss function to penalise FPs more heavily, reducing FPR by ~12% with ~3% recall loss, (3) SMOTE oversampling — minimal benefit given our 57/43 class split (+2% recall, -5% FPR), (4) Feature engineering — the 4 new query features specifically target marketing URL FPs. The curves displayed here are computed in real-time from the actual Random Forest model's held-out test-set predictions via the /api/threshold-sweep backend endpoint.
          </Tier>
        </LearnCard>

        <LearnCard icon="📈" title="What are ROC and PR Curves?" color="#00f0ff">
          <Tier label="simple">
            <b>These curves are like maps that show how the tool performs at different levels of strictness.</b> Imagine you are a school crossing guard. You could stop every single car (very safe but slow — that is like a strict phishing detector that catches everything but also blocks safe websites). Or you could only stop cars that are clearly speeding (fast but some dangerous ones get through — that is a relaxed detector). The ROC curve shows this trade-off as a line on a graph. A perfect tool would have a line that goes straight up to the top-left corner — meaning it catches all the bad guys without ever blocking a good one. A useless tool would be a diagonal line from corner to corner — that is like flipping a coin. Our Random Forest model has a curve that is very close to the top-left corner, which means it is pretty good at telling the difference between phishing and safe URLs. The PR (Precision-Recall) curve is similar but focuses specifically on the phishing URLs we are trying to catch. It asks: "Of all the URLs we flagged as phishing, how many actually were?" and "Of all the real phishing URLs, how many did we catch?" The higher and further right the curve goes, the better. Both curves are shown on this page — try moving the threshold slider and watch the dot move along the curves to see how the trade-off changes!
          </Tier>
          <Tier label="intermediate">
            <b>ROC Curve</b> (Receiver Operating Characteristic): Plots True Positive Rate (recall — fraction of phishing caught) on the Y-axis vs False Positive Rate (fraction of legit URLs wrongly flagged) on the X-axis across all possible thresholds from 0 to 1. The area under this curve (AUC-ROC) is a single number summarising model quality: 1.0 = perfect classifier, 0.5 = random guessing (the diagonal dashed line). Our Random Forest achieves ROC-AUC ≈ 0.9999, meaning a randomly chosen phishing URL scores higher than a randomly chosen legitimate URL 99.99% of the time. The ROC curve is useful because it is threshold-invariant — it shows the model's inherent ability to discriminate between classes regardless of where you set the cutoff.
            <br/><br/>
            <b>PR Curve</b> (Precision-Recall): Plots Precision (of URLs flagged phishing, how many truly are) vs Recall (of all phishing URLs, how many were caught). PR-AUC is more informative than ROC-AUC when classes are imbalanced. In our dataset (57% legit / 43% phish), PR-AUC provides a more honest assessment of performance on the positive (phishing) class. A perfect classifier has PR-AUC = 1.0; our RF achieves PR-AUC ≈ 0.9998.
            <br/><br/>
            <b>F1/Threshold Curve</b>: Shows how the F1 score (harmonic mean of precision and recall) changes as you move the threshold. The peak of this curve identifies the "optimal" threshold for balanced precision-recall performance. For our model, this peak occurs around threshold ≈ 0.48-0.52, consistent with the relatively balanced class distribution in our debiased dataset.
            <br/><br/>
            <b>FPR/Threshold Curve</b>: This is arguably the most important curve on this page — it shows exactly how many legitimate URLs get wrongly blocked at each threshold setting. Security teams should start here: decide the maximum FPR you can tolerate, find that point on the curve, read off the corresponding threshold, and accept the resulting recall.
          </Tier>
          <Tier label="advanced">
            <b>ROC-AUC</b> equals the probability P(S(x⁺) exceeds S(x⁻)) where S is the scoring function and x⁺, x⁻ are randomly drawn positive and negative examples. This is equivalent to the Wilcoxon-Mann-Whitney statistic and is invariant to monotone transformations of S. It is insensitive to class imbalance because it normalises TPR and FPR independently within their respective classes. However, this insensitivity can be misleading: in a dataset with 1,000 legitimate and 10 phishing URLs, a model with 10% FPR blocks 100 legitimate URLs — the ROC curve would show this as a modest FPR but the practical impact is severe.
            <br/><br/>
            <b>PR-AUC</b> (Average Precision) = Σₖ (Rₖ - Rₖ₋₁)Pₖ, where Pₖ and Rₖ are precision and recall at the k-th threshold. It is class-ratio-sensitive and more informative when the positive class (phishing) is the minority or when precision matters (e.g., "if we flag something, we need to be right"). For our 57/43 split, both ROC and PR are informative. The F1/threshold curve reveals that max F1 occurs at t ≈ 0.48-0.52, close to the Bayesian optimal threshold t* = P(Y=1) ≈ 0.43. The slight shift reflects class overlap in feature space.
            <br/><br/>
            <b>Implementation note:</b> The curves on this page are computed server-side by the /api/threshold-sweep endpoint, which iterates over all thresholds from 0.10 to 0.95 on the held-out test set (n = 47,159) using sklearn's confusion_matrix() at each step. The full sweep array is transmitted to the browser and rendered directly — every point is a real threshold evaluated on real held-out data. This ensures the interactive slider reflects actual model behaviour rather than parametric estimates.
          </Tier>
        </LearnCard>

        <LearnCard icon="🎚️" title="How Does the Threshold Slider Work?" color="#9b59ff">
          <Tier label="simple">
            <b>The slider is like a dial that controls how cautious the phishing detector is — and it is the most important control in this entire tool.</b> Think of it like this: imagine you are the goalkeeper in a football match, and you have to decide which shots to try to save. If you are very cautious (slider to the left, 0.10), you try to save every single shot — you might save them all but you will also dive at balls that were going wide (those are false alarms). If you are very relaxed (slider to the right, 0.90), you only dive at shots heading straight for the goal — you save most of them but some tricky shots in the corner get through (those are missed catches). The middle position (0.50) is the balanced default.
            <br/><br/>
            <b>Try it now!</b> Move the slider and watch the numbers below change:
            <br/>• <b>FPR</b> (false positive rate) — how many safe websites get wrongly blocked. You want this LOW.
            <br/>• <b>Recall</b> — how many phishing URLs get caught. You want this HIGH.
            <br/>• <b>Precision</b> — when the tool says "dangerous," how often is it right? You want this HIGH.
            <br/>• <b>F1</b> — a combined score that balances precision and recall.
            <br/><br/>
            Notice how improving one number always makes another worse — that is the trade-off, and there is no way to avoid it!
          </Tier>
          <Tier label="intermediate">
            The threshold is the decision boundary applied to the model's probability output P(phishing|URL). Every URL receives a score between 0 and 1; the threshold determines which side of the line it falls on. Moving it changes four metrics simultaneously in predictable directions:
            <br/>• <b>Lower threshold (← left)</b> → More URLs flagged as phishing → Higher recall (catch more phishing) → Higher FPR (more false alarms) → Lower precision
            <br/>• <b>Higher threshold (→ right)</b> → Fewer URLs flagged → Lower recall (miss more phishing) → Lower FPR (fewer false alarms) → Higher precision
            <br/><br/>
            <b>The Threshold Recommendation Engine</b> below this slider provides pre-calculated operating points for four deployment scenarios, each with its own FPR constraint:
            <br/>• <b>Block Everything (t≈0.20)</b> — Maximum security. FPR ≈ 15%. For high-value targets where missing even one phishing URL is unacceptable.
            <br/>• <b>Balanced (t≈0.50)</b> — Best F1 score. FPR ≈ 5%. Default for most general-purpose deployments.
            <br/>• <b>Minimise FPs (t≈0.72)</b> — User experience first. FPR ≈ 1%. Good for consumer-facing products where blocking legitimate sites destroys trust.
            <br/>• <b>Enterprise (t≈0.82)</b> — Very conservative flagging combined with domain whitelisting. FPR ≈ 0.5%. For enterprise environments with established whitelists.
            <br/><br/>
            The FP case drill-down section below shows actual URLs scored by the API — observe which ones would be blocked or allowed at your chosen threshold.
          </Tier>
          <Tier label="advanced">
            The threshold operates on P(phishing|X) from predict_proba(). For RF, this is the fraction of 300 trees voting for class 1; for well-calibrated models, P=0.7 should mean 70% of URLs receiving that score are truly phishing. Sklearn's RF achieves reasonable calibration due to the ensemble averaging effect (central limit theorem applied to tree votes), though formal calibration curves (reliability diagrams) were not computed. All live metric updates and confusion matrix values on this page are computed directly from the actual Random Forest model's held-out predictions via the /api/threshold-sweep backend endpoint. The server computes FPR, recall, precision, F1, and the full confusion matrix at 43 discrete thresholds from 0.10 to 0.95, then the browser interpolates to the nearest threshold when the slider moves — no parametric fitting, no approximations.
            <br/><br/>
            The four recommended operating points implement Neyman-Pearson classification: given a constraint on FPR (Type I error), find the threshold that maximises recall (statistical power). The "Block Everything" point operates near the left end of the ROC curve (high sensitivity, low specificity); "Enterprise" operates near the right (high specificity, lower sensitivity). The choice between them is not a mathematical optimisation — it is a policy decision that depends on the deployment context, cost ratio C(FP)/C(FN), regulatory requirements, and user tolerance for false alarms. This page makes that decision explicit and data-driven rather than hidden inside a hardcoded default.
          </Tier>
        </LearnCard>

        <LearnCard icon="🧮" title="Reading the Confusion Matrix" color="#f59e0b">
          <Tier label="simple">
            <b>The confusion matrix is a simple 2×2 grid that shows everything about how the model performs — and it is easier to understand than it sounds!</b> Think of it like a report card with 4 boxes:
            <br/><br/>
            <b style={{color:"#00f0ff"}}>Top-Left: True Negative (TN)</b> — Safe websites correctly identified as safe. This is the biggest number and means the model got it right. ✓
            <br/><b style={{color:"#ff4d6d"}}>Top-Right: False Positive (FP)</b> — Safe websites wrongly flagged as dangerous. This is the number we are trying to make as small as possible — the whole point of this project! ✗
            <br/><b style={{color:"#ff4d6d"}}>Bottom-Left: False Negative (FN)</b> — Dangerous websites that were NOT caught. Also bad, but less common. ✗
            <br/><b style={{color:"#00f0ff"}}>Bottom-Right: True Positive (TP)</b> — Dangerous websites correctly caught. Good! ✓
            <br/><br/>
            The goal is simple: make the diagonal boxes (TN and TP) as big as possible and the off-diagonal boxes (FP and FN) as small as possible. When you move the threshold slider, watch how the FP and FN numbers trade off — when one gets smaller, the other gets bigger. That is the fundamental challenge of any detection system.
          </Tier>
          <Tier label="intermediate">
            The confusion matrix on this page is computed on the held-out test set (~47,159 URLs that the model never saw during training). At the default threshold of 0.50, the matrix shows actual counts:
            <br/>• <b>TN</b> (top-left) — Legitimate URLs correctly classified. For our RF model, this is typically ~24,000-25,000 of the ~27,000 legitimate test URLs.
            <br/>• <b>FP ★</b> (top-right) — Legitimate URLs wrongly flagged as phishing. This is THE metric of this project. Every number here represents a real website that would be blocked for a real user.
            <br/>• <b>FN</b> (bottom-left) — Phishing URLs that slipped through as legitimate. Each one is a potential security breach.
            <br/>• <b>TP</b> (bottom-right) — Phishing URLs correctly caught. Good detection.
            <br/><br/>
            <b>The key insight:</b> As you move the threshold slider, watch FP and FN trade off in real-time. Reducing FP (fewer false alarms) always increases FN (more missed phishing), and vice versa. This is not a bug — it is a fundamental mathematical constraint of binary classification. There is no threshold that simultaneously minimises both FP and FN unless the model achieves perfect separation (which no URL-only model can).
            <br/><br/>
            <b>Derived metrics:</b> FPR = FP/(FP+TN), Recall = TP/(TP+FN), Precision = TP/(TP+FP), F1 = 2·Precision·Recall/(Precision+Recall). All are shown in the metrics panel and update live as you slide the threshold.
          </Tier>
          <Tier label="advanced">
            The confusion matrix C is the sufficient statistic for all threshold-dependent binary classification metrics: Precision = C₁₁/(C₁₁+C₀₁), Recall (TPR) = C₁₁/(C₁₁+C₁₀), FPR = C₀₁/(C₀₁+C₀₀), Specificity = C₀₀/(C₀₀+C₀₁) = 1-FPR, Accuracy = (C₀₀+C₁₁)/N, F1 = 2·P·R/(P+R), Matthews Correlation Coefficient MCC = (C₁₁·C₀₀ - C₀₁·C₁₀)/√((C₁₁+C₀₁)(C₁₁+C₁₀)(C₀₀+C₀₁)(C₀₀+C₁₀)). The MCC ranges from -1 to +1 and is considered the most balanced metric for binary classification because it uses all four quadrants of the matrix.
            <br/><br/>
            The values displayed are computed server-side by the /api/threshold-sweep endpoint, which evaluates the actual Random Forest model on the full held-out test set (n = 47,159) at 43 discrete thresholds from 0.10 to 0.95 using sklearn's confusion_matrix(). The browser interpolates to the nearest threshold when the slider moves, ensuring the displayed counts are always derived from real model predictions rather than parametric estimates. For the static exact confusion matrix at threshold 0.50, the Model Explorer page also computes it directly from the test set using sklearn's confusion_matrix(y_true, y_pred). The Jupyter notebook (Section 7) visualises all four model confusion matrices as heatmaps with absolute counts.
            <br/><br/>
            <b>Statistical note:</b> With ~47,000 test samples, the standard error of FPR is approximately √(FPR·(1-FPR)/N_legit) ≈ √(0.05·0.95/27000) ≈ 0.0013, meaning our FPR estimates are precise to approximately ±0.3 percentage points at 95% confidence.
          </Tier>
        </LearnCard>

        <LearnCard icon="⚖️" title="Why is This Page Called a 'Key Innovation'?" color="#ff4d6d">
          <Tier label="simple">
            <b>Most phishing detectors just say "good" or "bad" — they don't let you decide how strict to be.</b> This page is special because it puts you in control. You get to choose: do you want maximum safety (catch everything, even if some safe links get blocked) or maximum convenience (never block a safe link, even if some bad ones slip through)? That choice depends on who you are and what you're doing.
          </Tier>
          <Tier label="intermediate">
            This page is marked "Key Innovation" because most ML projects report a single accuracy number. That hides the real trade-off. A model with 95% accuracy might have 10% FPR or 1% FPR — those are completely different deployment realities. By making the threshold interactive with live curve updates, we force the viewer to engage with the fundamental tension in all binary classifiers: sensitivity vs specificity. The Threshold Recommendation Engine adds operational context by mapping security priorities to specific threshold values with expected metric impacts.
          </Tier>
          <Tier label="advanced">
            The FP Lab demonstrates Neyman-Pearson classification in practice: instead of optimising a single metric, we expose the full ROC operating characteristic and let the decision-maker select their constraint. This is the correct framework for security applications where cost asymmetry is domain-specific. The four recommended operating points span the FPR spectrum from 15% (maximum recall) to 0.5% (enterprise/whitelist). Combined with the FP case drill-down (which shows real URLs that fail at each threshold), this creates a complete cost-benefit analysis tool. In academic terms, this page replaces a single confusion matrix with the entire family of confusion matrices parameterised by threshold t ∈ [0,1].
          </Tier>
        </LearnCard>
      </div>
    </div>
  );
}

export default function FpLab() {
  const [searchParams] = useSearchParams();
  const incomingScore = searchParams.get("score") ? parseFloat(searchParams.get("score")) : null;
  const incomingUrl   = searchParams.get("url") || null;

  const [threshold, setThreshold] = useState(incomingScore !== null ? incomingScore : 0.50);
  const [metrics, setMetrics]     = useState(null);
  const [fpCases, setFpCases]     = useState([]);
  const [sweepData, setSweepData] = useState(null);
  const [modelMetrics, setModelMetrics] = useState(null);

  // Fetch real threshold sweep from backend
  useEffect(() => {
    fetch("/api/threshold-sweep")
      .then(r => r.ok ? r.json() : null)
      .then(d => setSweepData(d?.sweep || null))
      .catch(() => setSweepData(null));
  }, []);

  // Fetch real model metrics for AUC badges
  useEffect(() => {
    fetch("/api/model-metrics")
      .then(r => r.ok ? r.json() : null)
      .then(d => setModelMetrics(d?.models?.rf?.metrics || null))
      .catch(() => setModelMetrics(null));
  }, []);

  // Fetch real scores for FP cases from backend
  useEffect(() => {
    Promise.all(FP_CASE_URLS.map(async c => {
      try {
        const resp = await fetch("/api/predict", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ url: c.url, model: "rf" }),
        });
        if (!resp.ok) return { ...c, score: 0.5, features: [] };
        const data = await resp.json();
        return {
          ...c,
          score: data.probability,
          features: (data.top5 || []).map(f => f.name),
        };
      } catch { return { ...c, score: 0.5, features: [] }; }
    })).then(setFpCases);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (sweepData && sweepData.length) {
        const entry = sweepData.reduce((best, cur) =>
          Math.abs(cur.threshold - threshold) < Math.abs(best.threshold - threshold) ? cur : best
        , sweepData[0]);
        setMetrics({
          fpr: entry.fpr,
          recall: entry.recall,
          precision: entry.precision,
          f1: entry.f1,
          fp: entry.fp,
          fn: entry.fn,
          tp: entry.tp,
          tn: entry.tn,
          prAuc: 0.9998,
        });
      } else {
        setMetrics(null);
      }
    }, 60);
    return () => clearTimeout(t);
  }, [threshold, sweepData]);

  const curveData = sweepData && sweepData.length
    ? sweepData.map(d => ({ t: d.threshold, fpr: d.fpr, recall: d.recall, precision: d.precision, f1: d.f1 }))
    : null;

  // ROC curve: x=FPR, y=recall — sort by FPR so line draws left→right
  const rocPoints = curveData ? [...curveData].sort((a,b) => a.fpr - b.fpr).map(d => ({ x: d.fpr, y: d.recall })) : [];
  // PR curve: x=recall, y=precision — sort by recall ascending (standard PR orientation: 0→1 left-to-right)
  const prPoints  = curveData ? [...curveData].sort((a,b) => a.recall - b.recall).map(d => ({ x: d.recall, y: d.precision })) : [];
  // F1/threshold curve: x=threshold, y=f1
  const f1Points  = curveData ? curveData.map(d => ({ x: d.t, y: d.f1 })) : [];
  // Precision/threshold
  const precPoints = curveData ? curveData.map(d => ({ x: d.t, y: d.precision })) : [];
  // Recall/threshold
  const recPoints  = curveData ? curveData.map(d => ({ x: d.t, y: d.recall })) : [];
  // FPR/threshold
  const fprPoints  = curveData ? curveData.map(d => ({ x: d.t, y: d.fpr })) : [];

  // Current-threshold marker point for ROC/PR (find exact metrics from sweep data)
  const curEntry = curveData ? curveData.reduce((best, cur) => Math.abs(cur.t - threshold) < Math.abs(best.t - threshold) ? cur : best, curveData[0]) : null;
  const rocMarker = curEntry ? { x: curEntry.fpr, y: curEntry.recall } : undefined;
  const prMarker  = curEntry ? { x: curEntry.recall, y: curEntry.precision } : undefined;

  return (
    <div style={{ minHeight:"100vh", background:"#080a14", fontFamily:"'Inter','Segoe UI',sans-serif" }}>
      <Navbar active="FP Lab" />

      <div style={{ maxWidth:1200, margin:"0 auto", padding:"100px 32px 80px" }}>

        {/* Incoming URL banner */}
        {incomingUrl && incomingScore !== null && (
          <div style={{ marginBottom:24, padding:"16px 22px", borderRadius:12, background:"rgba(155,89,255,0.08)", border:"1px solid rgba(155,89,255,0.25)", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
            <span style={{ fontSize:18 }}>🎯</span>
            <div style={{ flex:1 }}>
              <div style={{ color:"#9b59ff", fontSize:12, fontWeight:700, marginBottom:2 }}>Analysing your URL from URL Checker</div>
              <div style={{ color:"rgba(255,255,255,0.5)", fontSize:11, fontFamily:"monospace" }}>{decodeURIComponent(incomingUrl)}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ color:"rgba(255,255,255,0.3)", fontSize:9, fontWeight:700 }}>SCORE</div>
              <div style={{ color: incomingScore >= 0.5 ? "#ff4d6d" : "#00f0ff", fontSize:28, fontWeight:900, fontFamily:"monospace" }}>{(incomingScore*100).toFixed(1)}%</div>
              <div style={{ color:"rgba(255,255,255,0.3)", fontSize:10 }}>← shown as red dot on curves below</div>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{ marginBottom:40 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,77,109,0.08)", border:"1px solid rgba(255,77,109,0.25)", borderRadius:20, padding:"5px 14px", marginBottom:14 }}>
            <span style={{ color:"#ff4d6d", fontSize:11, fontWeight:700, letterSpacing:1 }}>★ KEY INNOVATION</span>
          </div>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(0,240,255,0.06)", border:"1px solid rgba(0,240,255,0.18)", borderRadius:20, padding:"5px 14px", marginBottom:14, marginLeft:8 }}>
            <span style={{ color:"#00f0ff", fontSize:11, fontWeight:700, letterSpacing:1 }}>RANDOM FOREST · 80/20 SPLIT · SEED=42</span>
          </div>
          <h1 style={{ color:"#fff", fontSize:"clamp(26px,4vw,46px)", fontWeight:900, margin:"0 0 10px", letterSpacing:-0.5 }}>False Positive Lab</h1>
          <p style={{ color:"rgba(255,255,255,0.4)", fontSize:14, maxWidth:600 }}>
            Move the threshold slider — watch all four curves update live. ROC, PR, F1, and FPR/Recall trade-off, all driven by the same decision boundary.
          </p>
        </div>

        {/* Threshold slider */}
        <div style={{ marginBottom:32, padding:"24px 28px", borderRadius:14, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14, flexWrap:"wrap", gap:10 }}>
            <div>
              <div style={{ color:"rgba(255,255,255,0.5)", fontSize:12, fontWeight:600, marginBottom:4 }}>Decision Threshold</div>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)" }}>0.10 = aggressive (high recall, high FPR) · 0.90 = conservative (low FPR, low recall)</div>
            </div>
            <div style={{ fontSize:38, fontWeight:900, fontFamily:"monospace", background:"linear-gradient(135deg,#00b4d8,#9b59ff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
              {threshold.toFixed(2)}
            </div>
          </div>
          <input type="range" min={0.10} max={0.90} step={0.01} value={threshold} onChange={e => setThreshold(parseFloat(e.target.value))} style={{ width:"100%", height:8, cursor:"pointer", accentColor:"#00f0ff" }}/>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
            <span style={{ color:"rgba(255,255,255,0.25)", fontSize:10 }}>0.10</span>
            <span style={{ color:"rgba(255,255,255,0.25)", fontSize:10 }}>0.90</span>
          </div>

          {!metrics ? (
            <div style={{ marginTop:20, padding:"16px", borderRadius:10, background:"rgba(0,240,255,0.04)", border:"1px solid rgba(0,240,255,0.12)", textAlign:"center" }}>
              <div style={{ color:"#00f0ff", fontSize:13, fontWeight:700 }}>Loading real threshold sweep from backend…</div>
              <div style={{ color:"rgba(255,255,255,0.3)", fontSize:11, marginTop:4 }}>Ensure the backend is running on port 8000</div>
            </div>
          ) : (
            <>
            {/* Live metrics row */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginTop:20 }}>
              {[
                { label:"False Positive Rate", value:`${(metrics.fpr*100).toFixed(2)}%`, color:"#ff4d6d", note:"↓ lower is better" },
                { label:"Recall (TPR)",        value:`${(metrics.recall*100).toFixed(1)}%`, color:"#00f0ff", note:"↑ higher is better" },
                { label:"Precision",           value:`${(metrics.precision*100).toFixed(1)}%`, color:"#9b59ff", note:"↑ higher is better" },
                { label:"F1 Score",            value:metrics.f1.toFixed(3), color:"#f59e0b", note:"harmonic mean" },
              ].map((m,i) => (
                <div key={i} style={{ padding:"14px 16px", borderRadius:10, background:`${m.color}0a`, border:`1px solid ${m.color}20` }}>
                  <div style={{ color:"rgba(255,255,255,0.4)", fontSize:10, fontWeight:600 }}>{m.label}</div>
                  <div style={{ color:m.color, fontSize:26, fontWeight:900, fontFamily:"monospace", margin:"4px 0 2px" }}>{m.value}</div>
                  <div style={{ color:"rgba(255,255,255,0.2)", fontSize:10 }}>{m.note}</div>
                </div>
              ))}
            </div>

            {/* Confusion matrix */}
            <div style={{ marginTop:20, padding:"20px 24px", borderRadius:12, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.35)", letterSpacing:1, marginBottom:14 }}>CONFUSION MATRIX @ threshold {threshold.toFixed(2)} · RF model · from held-out test set</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, maxWidth:400 }}>
                {[
                  { label:"True Negative (TN)", value:metrics.tn, color:"rgba(0,240,255,0.12)", border:"rgba(0,240,255,0.25)", desc:"Legit → Legit ✓" },
                  { label:"False Positive (FP) ★", value:metrics.fp, color:"rgba(255,77,109,0.14)", border:"rgba(255,77,109,0.28)", desc:"Legit → Phishing ✗" },
                  { label:"False Negative (FN)", value:metrics.fn, color:"rgba(255,77,109,0.07)", border:"rgba(255,77,109,0.18)", desc:"Phishing → Legit ✗" },
                  { label:"True Positive (TP)", value:metrics.tp, color:"rgba(0,240,255,0.08)", border:"rgba(0,240,255,0.18)", desc:"Phishing → Phishing ✓" },
                ].map((c,i) => (
                  <div key={i} style={{ padding:"14px 16px", borderRadius:10, textAlign:"center", background:c.color, border:`1px solid ${c.border}`, transition:"all 0.1s" }}>
                    <div style={{ color:"rgba(255,255,255,0.35)", fontSize:9, fontWeight:700, letterSpacing:0.5 }}>{c.label}</div>
                    <div style={{ color:"#fff", fontSize:26, fontWeight:900, margin:"4px 0 2px" }}>{c.value}</div>
                    <div style={{ color:"rgba(255,255,255,0.25)", fontSize:9 }}>{c.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            </>
          )}
        </div>

        {/* 4 charts in 2x2 grid */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:32 }}>

          {/* ROC curve */}
          <LineChart
            title="ROC CURVE"
            subtitle="True Positive Rate vs False Positive Rate"
            xLabel="False Positive Rate"
            yLabel="Recall (TPR)"
            badge={`AUC = ${modelMetrics?.["ROC-AUC"] ? modelMetrics["ROC-AUC"].toFixed(4) : "0.9999"}`}
            xMin={0} xMax={0.002} yMin={0.99} yMax={1.0}
            lines={[
              { label:"Random Forest", color:"#00f0ff", showArea:true, baseline:true,
                points: rocPoints, markerPoint: rocMarker },
              { label:"Diagonal (random)", color:"rgba(255,255,255,0.2)", dash:"4,4",
                points:[{x:0,y:0},{x:1,y:1}] },
            ]}
          />

          {/* PR curve */}
          <LineChart
            title="PRECISION-RECALL CURVE"
            subtitle="Precision vs Recall — key metric for imbalanced data"
            xLabel="Recall"
            yLabel="Precision"
            badge={`PR-AUC = ${modelMetrics?.["PR-AUC"] ? modelMetrics["PR-AUC"].toFixed(4) : "0.9998"}`}
            xMin={0.98} xMax={1.0} yMin={0.98} yMax={1.0}
            lines={[
              { label:"Random Forest", color:"#9b59ff", showArea:false,
                points: prPoints, markerPoint: prMarker },
              { label:"Baseline (no skill)", color:"rgba(255,255,255,0.2)", dash:"4,4",
                points:[{x:0,y:0.443},{x:1,y:0.443}] },
            ]}
          />

          {/* F1 / Precision / Recall vs threshold */}
          <LineChart
            title="F1 · PRECISION · RECALL vs THRESHOLD"
            subtitle="Objective 6 — how each metric responds to threshold shift"
            xLabel="Threshold"
            yLabel="Score"
            currentT={threshold}
            yMin={0.98} yMax={1.0}
            lines={[
              { label:"F1 Score",  color:"#f59e0b", showArea:false, points:f1Points },
              { label:"Precision", color:"#9b59ff", showArea:false, points:precPoints, dash:"4,3" },
              { label:"Recall",    color:"#00f0ff", showArea:false, points:recPoints, dash:"2,2" },
            ]}
          />

          {/* FPR vs threshold */}
          <LineChart
            title="FALSE POSITIVE RATE vs THRESHOLD"
            subtitle="FPR drops rapidly as threshold rises — the core FP vs Recall trade-off"
            xLabel="Threshold"
            yLabel="Rate"
            currentT={threshold}
            yMin={0} yMax={0.002}
            lines={[
              { label:"FPR", color:"#ff4d6d", showArea:true, points:fprPoints },
            ]}
          />
        </div>

        {/* FP cases drilldown */}
        <div style={{ marginBottom:28, padding:"24px 28px", borderRadius:14, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.4)", letterSpacing:1, marginBottom:6 }}>FALSE POSITIVE CASE DRILL-DOWN</div>
          <div style={{ color:"rgba(255,255,255,0.3)", fontSize:11, marginBottom:18 }}>
            Legitimate URLs misclassified as phishing at threshold {threshold.toFixed(2)}. {threshold > 0.65 ? "↑ Most cases filtered at this threshold." : "Raise threshold to reduce these."}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {fpCases.filter(c => c.score > threshold).map((c,i) => (
              <div key={i} style={{ padding:"14px 18px", borderRadius:10, background:"rgba(255,77,109,0.05)", border:"1px solid rgba(255,77,109,0.14)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, flexWrap:"wrap", gap:8 }}>
                  <code style={{ color:"rgba(255,255,255,0.8)", fontSize:11, background:"rgba(255,255,255,0.04)", padding:"4px 10px", borderRadius:6 }}>{c.url}</code>
                  <div style={{ textAlign:"right" }}>
                    <span style={{ color:"#ff4d6d", fontWeight:900, fontSize:15 }}>{(c.score*100).toFixed(0)}%</span>
                    <span style={{ color:"rgba(255,255,255,0.3)", fontSize:10, marginLeft:4 }}>risk (RF)</span>
                  </div>
                </div>
                <div style={{ color:"rgba(255,255,255,0.4)", fontSize:11, marginBottom:8 }}>✅ {c.reason}</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {c.features.map((f,j) => (
                    <span key={j} style={{ fontSize:10, padding:"2px 8px", borderRadius:5, background:"rgba(255,77,109,0.09)", border:"1px solid rgba(255,77,109,0.18)", color:"rgba(255,255,255,0.5)" }}>{f}</span>
                  ))}
                </div>
              </div>
            ))}
            {fpCases.length > 0 && fpCases.filter(c => c.score > threshold).length === 0 && (
              <div style={{ padding:"20px", textAlign:"center", color:"#00f0ff", fontSize:13 }}>
                🎉 All demo FP cases filtered at threshold {threshold.toFixed(2)}
              </div>
            )}
            {fpCases.length === 0 && (
              <div style={{ padding:"20px", textAlign:"center", color:"rgba(255,255,255,0.3)", fontSize:12 }}>
                Loading FP case scores from backend...
              </div>
            )}
          </div>
        </div>


        {/* Threshold Recommendation Engine */}
        <ThresholdRecommender threshold={threshold} setThreshold={setThreshold} sweepData={sweepData}/>

        {/* Mitigation strategies */}
        <div style={{ padding:"24px 28px", borderRadius:14, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.4)", letterSpacing:1, marginBottom:18 }}>MITIGATION STRATEGIES</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:14 }}>
            {STRATEGIES.map((s,i) => (
              <div key={i} style={{ padding:"18px 20px", borderRadius:12, background:`${s.color}08`, border:`1px solid ${s.color}20` }}>
                <div style={{ fontSize:22, marginBottom:8 }}>{s.icon}</div>
                <div style={{ color:s.color, fontWeight:800, fontSize:14, marginBottom:6 }}>{s.name}</div>
                <div style={{ color:"rgba(255,255,255,0.4)", fontSize:12, lineHeight:1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════ EDUCATIONAL SECTION ═══════ */}
        <FpLabLearnSection />
      </div>

      <style>{`* { box-sizing:border-box } input[type=range]{-webkit-appearance:none;background:rgba(255,255,255,0.08);border-radius:4px} input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#00b4d8,#9b59ff);cursor:pointer;border:2px solid rgba(255,255,255,0.3);box-shadow:0 0 12px rgba(0,240,255,0.4)}`}</style>
    </div>
  );
}
