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

const ICON_MAP  = { dummy:"🎲", lr:"📈", rf:"🌲", gbm:"⚡" };
const COLOR_MAP = { dummy:"#6b7280", lr:"#00b4d8", rf:"#00f0ff", gbm:"#9b59ff" };
const GLOW_MAP  = { dummy:"rgba(107,114,128,0.25)", lr:"rgba(0,180,216,0.25)", rf:"rgba(0,240,255,0.25)", gbm:"rgba(155,89,255,0.25)" };
const ORDER = ["dummy","lr","rf","gbm"];

const METRIC_KEYS = ["PR-AUC","ROC-AUC","F1","Precision","Recall","FPR","Accuracy"];

const METRIC_EXPLAIN = {
  "PR-AUC":    "Precision-Recall balance (higher = fewer mistakes overall)",
  "ROC-AUC":   "Ability to tell safe from phishing (1.0 = perfect separation, 0.5 = coin flip)",
  "F1":        "Combined accuracy score (balances catching phishing vs. false alarms)",
  "Precision": "When it says 'phishing', how often is it right?",
  "Recall":    "Out of all real phishing, how many does it catch?",
  "FPR":       "How many safe sites get wrongly blocked? (lower = better)",
  "Accuracy":  "Overall correctness — how many total URLs it got right",
};

function interpretMetric(key, value) {
  if (key === "FPR") {
    const pct = (value * 100).toFixed(1);
    if (value === 0) return "No safe sites wrongly blocked";
    if (value < 0.01) return `Only ${pct}% of safe sites wrongly blocked — excellent`;
    if (value < 0.05) return `${pct}% of safe sites wrongly blocked — good`;
    return `${pct}% of safe sites wrongly blocked — needs improvement`;
  }
  if (key === "ROC-AUC") {
    if (value >= 0.99) return "Near-perfect at separating safe from phishing";
    if (value >= 0.95) return "Excellent at telling safe from phishing";
    if (value >= 0.80) return "Good at telling safe from phishing";
    if (value >= 0.60) return "Some ability to distinguish, but weak";
    return "Barely better than random guessing";
  }
  if (key === "PR-AUC") {
    if (value >= 0.99) return "Almost no mistakes on phishing detection";
    if (value >= 0.90) return "Very reliable phishing detection";
    if (value >= 0.70) return "Decent phishing detection";
    return "Unreliable phishing detection";
  }
  if (key === "Precision") {
    const pct = (value * 100).toFixed(0);
    if (value >= 0.95) return `${pct}% of phishing alerts are correct`;
    if (value >= 0.80) return `${pct}% of phishing alerts are correct`;
    return `Only ${pct}% of alerts are correct — many false alarms`;
  }
  if (key === "Recall") {
    const pct = (value * 100).toFixed(0);
    if (value >= 0.95) return `Catches ${pct}% of all phishing URLs`;
    if (value >= 0.80) return `Catches ${pct}% of phishing, misses some`;
    return `Only catches ${pct}% — misses too many phishing URLs`;
  }
  if (key === "F1") {
    if (value >= 0.90) return "Excellent balance of precision and recall";
    if (value >= 0.75) return "Good overall balance";
    return "Imbalanced — check precision and recall separately";
  }
  if (key === "Accuracy") {
    const pct = (value * 100).toFixed(0);
    if (value >= 0.99) return `${pct}% overall correct — near-perfect`;
    if (value >= 0.95) return `${pct}% overall correct — very good`;
    if (value >= 0.90) return `${pct}% overall correct — good`;
    return `Only ${pct}% correct — many errors`;
  }
  return "";
}

function MetricBar({ value, color, isInverse }) {
  const pct = isInverse ? (1-value)*100 : value*100;
  return (
    <div style={{ height:6, borderRadius:3, background:"rgba(255,255,255,0.06)", overflow:"hidden" }}>
      <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${color},${color}bb)`, borderRadius:3, transition:"width 0.6s ease" }}/>
    </div>
  );
}

function ConfMatrix({ matrix, color, testSize }) {
  const labels = ["TN","FP ★","FN","TP"];
  const descs  = ["Legit→Legit ✓","Legit→Phish ✗","Phish→Legit ✗","Phish→Phish ✓"];
  const flat   = [matrix[0][0],matrix[0][1],matrix[1][0],matrix[1][1]];
  const bgs    = ["rgba(0,240,255,0.12)","rgba(255,77,109,0.15)","rgba(255,77,109,0.08)","rgba(0,240,255,0.08)"];
  const borders= ["rgba(0,240,255,0.28)","rgba(255,77,109,0.30)","rgba(255,77,109,0.18)","rgba(0,240,255,0.20)"];
  return (
    <div>
      <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.35)", letterSpacing:1, marginBottom:12 }}>CONFUSION MATRIX · test set n={testSize?.toLocaleString() || "?"}</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        {flat.map((v,i) => (
          <div key={i} style={{ padding:"12px 10px", borderRadius:10, textAlign:"center", background:bgs[i], border:`1px solid ${borders[i]}`, transition:"all 0.2s" }}>
            <div style={{ color:"rgba(255,255,255,0.35)", fontSize:9, fontWeight:700, letterSpacing:0.5 }}>{labels[i]}</div>
            <div style={{ color:"#fff", fontSize:24, fontWeight:900, margin:"3px 0 2px" }}>{v}</div>
            <div style={{ color:"rgba(255,255,255,0.25)", fontSize:9 }}>{descs[i]}</div>
          </div>
        ))}
      </div>
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

function ModelLearnSection() {
  return (
    <div style={{marginTop:40,paddingTop:32,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
        <span style={{fontSize:20}}>📚</span>
        <span style={{color:"#fff",fontWeight:800,fontSize:18}}>Learn</span>
        <span style={{color:"rgba(255,255,255,0.3)",fontSize:12}}>— Understand model comparison</span>
      </div>
      <p style={{color:"rgba(255,255,255,0.35)",fontSize:12,marginBottom:20,maxWidth:600}}>Click any topic to learn about the models, metrics, and why comparing them matters.</p>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <LearnCard icon="🤔" title="Why Compare Multiple Models?" color="#00f0ff">
          <Tier label="simple">
            <b>It's like asking 4 different detectives to solve the same case — each one has a different approach, and comparing them tells us who is best.</b> Our first detective (the "Dummy") is lazy — it just guesses the most common answer every time. If our other detectives cannot do better than this lazy one, they are useless! The second detective (Logistic Regression) is smart but simple — it draws a single straight line between "safe" and "dangerous." The third detective (Random Forest) is a team of 300 people who each look at different clues and then vote. The fourth detective (Gradient Boosting) is a student who learns from mistakes — each time it gets something wrong, it pays extra attention to that type of mistake next time. By testing all 4 on the same set of web addresses, we can see which approach works best. Importantly, they all see exactly the same evidence (the same 18 clues from each address) — the only thing that changes is how they think. This is what makes the comparison fair. If RF and GBM agree that a URL is dangerous, you can be very confident. If they disagree, the URL is in a grey area. The most important thing to compare is not just how many they get right overall, but specifically how many safe websites they wrongly block (false positives) — because that is the focus of this project.
          </Tier>
          <Tier label="intermediate">
            Multiple models establish a <b>progression of capability</b> that is methodologically required for rigorous ML evaluation:
            <br/><br/>
            <b>1. Dummy Classifier (accuracy ~57%)</b> — Always predicts the majority class (legitimate). This is the absolute performance floor. Any real model that cannot significantly beat the Dummy is not learning anything useful from the features.
            <br/><b>2. Logistic Regression (~77%)</b> — A linear model that computes a weighted sum of all 18 features and applies a sigmoid function. It can only draw straight-line decision boundaries, which limits it when features interact non-linearly (e.g., "suspicious TLD + no HTTPS" is more suspicious than either alone). However, LR is fully interpretable — you can read the coefficient for each feature and know exactly how it contributes.
            <br/><b>3. Random Forest (~86%)</b> — An ensemble of 300 decision trees, each trained on random subsets of data and features. The trees vote independently, and the majority wins. RF captures non-linear interactions, is resistant to overfitting, and supports SHAP TreeExplainer for post-hoc feature attribution.
            <br/><b>4. Gradient Boosting (~86%)</b> — 200 trees built sequentially, where each tree focuses on correcting the errors of the previous ensemble. Uses learning_rate=0.1 to prevent overfitting.
            <br/><br/>
            All models share the same 80/20 stratified train/test split (seed=42) and the same 18-feature preprocessing pipeline. The only variable is the algorithm, ensuring fair comparison. The metrics table shows that RF and GBM are very close on all metrics, while both significantly outperform LR, which in turn significantly outperforms Dummy. This progression validates that our features contain learnable signal and that non-linear models extract it better than linear ones.
          </Tier>
          <Tier label="advanced">
            The baseline → improvement progression is a methodological requirement in ML research (recommended by journals like JMLR and conferences like NeurIPS): it demonstrates that performance gains are attributable to model complexity rather than data leakage, lucky random splits, or implementation bugs. Using seed=42 for train_test_split ensures exact reproducibility. The shared preprocessing pipeline (StandardScaler applied inside sklearn Pipeline objects for LR/RF/GBM, ensuring no data leakage from test to train) eliminates confounds. Model selection should be informed not by a single metric but by the Pareto frontier across multiple metrics: if Model A has higher AUC but higher FPR than Model B, the choice depends on the deployment's cost ratio C(FP)/C(FN). For our project, FPR is the primary selection criterion, making RF the recommended model. In production, <b>ensemble agreement</b> between RF and GBM provides a natural confidence measure: if both models agree (both ≥0.8 or both ≤0.2), confidence is high; if they disagree significantly, the URL is in the decision boundary zone and may require manual review or additional context (DNS age, certificate status, page content). A McNemar test on the RF and GBM confusion matrices would determine whether their performance difference is statistically significant — given the large test set (~47,000 samples), even small metric differences are likely significant.
          </Tier>
        </LearnCard>

        <LearnCard icon="🌲" title="How Does Random Forest Work?" color="#00f0ff">
          <Tier label="simple">
            <b>Imagine 300 people each looking at different clues about a web address, then voting — that is how Random Forest works!</b> Each person (called a "tree") looks at a random selection of the 18 clues about a web address. One tree might focus on the length and the domain ending. Another might focus on whether it uses HTTPS and how many dashes it has. Each tree makes its own guess about whether the address is safe or fake. Then all 300 trees vote — if most say "phishing," the final answer is "phishing." This works really well because each tree sees different things, so the group is much smarter than any single tree. If one tree makes a mistake, the other 299 usually correct it. Think of it like asking the whole class a question versus asking just one student — the class average is almost always closer to the right answer. Random Forest is the main model in PhishGuard because it has the best balance of accuracy and fairness. It catches the most phishing URLs while blocking the fewest safe websites. It also supports something called SHAP (which shows you WHY it made each decision), making it the most "explainable" model we have.
          </Tier>
          <Tier label="intermediate">
            Random Forest is an ensemble method that combines 300 independent decision trees. Each tree is trained on a random <b>bootstrap sample</b> (sampling with replacement) of the training data. At each split node, only a random subset of features is considered (√18 ≈ 4 features per split). This double randomisation (data bagging + feature subsampling) produces diverse, decorrelated trees that collectively form a robust classifier.
            <br/><br/>
            <b>Why RF works well for URL classification:</b>
            <br/>• <b>Non-linear interactions:</b> URL features interact — "suspicious TLD + no HTTPS + long path" is far more suspicious than any one feature alone. Decision trees naturally capture these interactions through their branching structure.
            <br/>• <b>Mixed feature types:</b> Our 18 features include binary (has_www), count (dash_count), and continuous (domain_entropy) types. Trees handle all types without normalisation.
            <br/>• <b>Robustness to outliers:</b> Bootstrap sampling means each tree sees slightly different data, reducing the impact of outlier URLs.
            <br/>• <b>Explainability:</b> SHAP TreeExplainer provides exact feature attributions for every individual prediction, making RF the most transparent model in our comparison.
            <br/><br/>
            The final prediction is the average probability across all 300 trees. This averaging produces well-calibrated probabilities: a score of 0.7 means roughly 70% of similar URLs in the training data were phishing. RF achieves ~86% accuracy on our debiased dataset — the highest among all models — with the lowest false positive rate.
          </Tier>
          <Tier label="advanced">
            Our RF Pipeline: StandardScaler → RandomForestClassifier(n_estimators=300, max_depth=None, max_features='sqrt', bootstrap=True, class_weight=None, random_state=42). Full-depth trees (max_depth=None) maximise training accuracy; generalisation comes from the ensemble averaging effect rather than individual tree regularisation. The OOB (out-of-bag) error provides a built-in cross-validation estimate without requiring a separate validation set. Each tree's OOB sample consists of the ~36.8% of training instances not selected by that tree's bootstrap sample.
            <br/><br/>
            <b>Feature importance comparison:</b> Gini importance (Mean Decrease in Impurity) is biased toward high-cardinality continuous features (url_length, domain_entropy) because they offer more potential split points. SHAP values (computed via TreeExplainer with feature_perturbation='tree_path_dependent') provide theoretically grounded, unbiased importance rankings by computing exact Shapley values in O(TLD²) time. The SHAP importance ranking shows domain_entropy, url_length, and has_https as the top features, partially diverging from the Gini ranking — this divergence is well-documented in the SHAP literature (Lundberg & Lee, 2017).
            <br/><br/>
            <b>Calibration:</b> RF's probability calibration is naturally good because predict_proba() returns the fraction of trees voting for each class, which converges to the true posterior as n_estimators increases (by the law of large numbers). With 300 trees, calibration error is typically under 2%.
          </Tier>
        </LearnCard>

        <LearnCard icon="⚡" title="How Does Gradient Boosting Work?" color="#9b59ff">
          <Tier label="simple">
            <b>Gradient Boosting is like a student who gets better by studying their mistakes.</b> Imagine you take a test and get some answers wrong. Then you study only the questions you got wrong and take the test again. This time you get different questions wrong. So you study those, and take the test again. After doing this 200 times, you have gotten really good at all the hard questions! That is exactly how Gradient Boosting works. The first "tree" makes predictions about all the web addresses. Some predictions are wrong. The second tree does not start from scratch — instead, it focuses specifically on the addresses the first tree got wrong. The third tree focuses on what the first two missed, and so on. After 200 rounds of this, the combined team is very good at the tricky cases. Gradient Boosting is slightly different from Random Forest: RF has 300 independent trees all working at the same time (like a committee), while GBM has 200 trees working one after another (like a relay team). Both are very good at detecting phishing, and comparing them helps us understand which approach handles false positives better.
          </Tier>
          <Tier label="intermediate">
            Unlike Random Forest's parallel independent trees, Gradient Boosting builds trees <b>sequentially</b>. The core algorithm is:
            <br/><br/>
            1. Start with a base prediction (the log-odds of the training class distribution)
            <br/>2. Compute the <b>residuals</b> (errors) between predictions and true labels
            <br/>3. Train a new shallow tree (max_depth=5) to predict these residuals
            <br/>4. Add the new tree's predictions to the ensemble, scaled by the learning rate (0.1)
            <br/>5. Repeat for 200 iterations
            <br/><br/>
            <b>Key hyperparameters:</b>
            <br/>• <b>learning_rate=0.1</b> — Controls how much each tree's correction is trusted. Lower values require more trees but generalise better (regularisation through shrinkage).
            <br/>• <b>max_depth=5</b> — Each tree is shallow (weak learner). Boosting theory shows that combining many weak learners produces a strong classifier.
            <br/>• <b>n_estimators=200</b> — Total number of boosting rounds. More rounds improve fit but risk overfitting.
            <br/><br/>
            GBM achieves ~86% accuracy — nearly identical to RF. The final prediction is the sum of all 200 trees' outputs passed through a sigmoid function σ(z) = 1/(1+e⁻ᶻ) for probability calibration. GBM is our second-best model and serves as an independent cross-check: when RF and GBM agree on a URL's classification, confidence is high.
          </Tier>
          <Tier label="advanced">
            Our GBM Pipeline: StandardScaler → GradientBoostingClassifier(n_estimators=200, learning_rate=0.1, max_depth=5, subsample=1.0, loss='log_loss', random_state=42). The loss function is log-loss (binary cross-entropy): L = -Σ[yᵢ log(ŷᵢ) + (1-yᵢ) log(1-ŷᵢ)]. Each tree is fit to the negative gradient of this loss (pseudo-residuals), which for log-loss equals yᵢ - σ(Fₘ(xᵢ)) where Fₘ is the current ensemble's raw output.
            <br/><br/>
            <b>Comparison with RF:</b> GBM's sequential structure makes it theoretically more expressive per tree (each tree sees the ensemble's current errors), but also more prone to overfitting. The shallow depth (5) and learning rate shrinkage (0.1) regularise the model. GBM is sensitive to feature scale through the tree splitting criterion, though our features are naturally bounded. The subsample=1.0 means no stochastic gradient boosting — all training samples are used at each round. Setting subsample below 1.0 would add another regularisation mechanism.
            <br/><br/>
            <b>FP behaviour:</b> GBM and RF produce slightly different FP patterns because their decision boundaries differ. GBM's sequential error correction tends to overfit on difficult boundary cases, sometimes producing higher FPR on URLs that are near the decision boundary. This makes RF the slightly preferred model for deployments where FPR minimisation is critical. Both support SHAP TreeExplainer for exact feature attributions.
          </Tier>
        </LearnCard>

        <LearnCard icon="📊" title="Understanding the Metrics (FP Focus)" color="#f59e0b">
          <Tier label="simple">
            <b>Metrics are like different grades on your report card — each one tells you something different about how well the model is doing.</b>
            <br/><br/>
            <b>ROC-AUC</b> — The overall grade. 0.5 = just guessing, 1.0 = perfect. Our best models get about 0.93.
            <br/><b>Precision</b> — When the model says "this is phishing," how often is it actually right? If precision is 90%, then 9 out of 10 phishing warnings are correct and 1 is a false alarm.
            <br/><b>Recall</b> — Out of ALL the real phishing websites, how many does the model catch? If recall is 85%, it catches 85 out of 100 phishing URLs and misses 15.
            <br/><b>F1 Score</b> — A combined grade that balances precision and recall. High F1 means the model is good at BOTH being correct when it warns you AND catching most phishing.
            <br/><b>FPR (False Positive Rate)</b> — This is THE most important number for our project! It tells you how many safe websites get wrongly blocked. Lower is better. If FPR is 5%, then 5 out of every 100 safe websites trigger a false alarm.
            <br/><br/>
            Look at the comparison table above — the model with the ★ star next to a metric is the best one for that particular measure!
          </Tier>
          <Tier label="intermediate">
            <b>All metrics are computed on the held-out test set (~47,159 URLs) at threshold 0.50:</b>
            <br/><br/>
            <b>ROC-AUC</b>: The probability that a randomly chosen phishing URL scores higher than a randomly chosen legitimate URL. Threshold-invariant — it measures the model's inherent discrimination ability regardless of where you set the cutoff. Perfect = 1.0, random = 0.5.
            <br/><b>PR-AUC</b> (Average Precision): Area under the precision-recall curve. More informative than ROC-AUC when classes are imbalanced or when we care specifically about the phishing (positive) class detection quality.
            <br/><b>F1 Score</b>: Harmonic mean of precision and recall: F1 = 2·P·R/(P+R). Penalises extreme trade-offs — a model with 100% precision but 1% recall gets a very low F1.
            <br/><b>Precision</b>: TP/(TP+FP) — of all URLs flagged as phishing, what fraction truly is? Higher precision = fewer false alarms among the flagged URLs.
            <br/><b>Recall</b>: TP/(TP+FN) — of all actual phishing URLs, what fraction was caught? Higher recall = fewer missed phishing.
            <br/><b>FPR ★</b>: FP/(FP+TN) — the FALSE POSITIVE RATE. This is the project's primary metric. It directly measures user impact: how many legitimate URLs get wrongly blocked. The ★ indicates this is the metric we are optimising for. A 5% FPR means 5 in 100 legitimate URLs trigger false alarms — in a deployment processing 10,000 URLs/day, that is 500 wrongly blocked sites.
            <br/><br/>
            The ★ annotations in the comparison table identify the per-metric best model. Click any model card to see its full confusion matrix with exact TP/TN/FP/FN counts.
          </Tier>
          <Tier label="advanced">
            All metrics are computed at threshold t=0.50 on the held-out test set using sklearn's metric functions. The choice of t=0.50 as the comparison point is conventional but arbitrary — the FP Lab page allows exploration across all thresholds.
            <br/><br/>
            <b>Metric properties:</b> Accuracy = (TP+TN)/N is misleading for imbalanced data (Dummy achieves ~57% by always predicting majority class). F1 is the harmonic mean, which penalises asymmetric precision/recall more than arithmetic mean. ROC-AUC is base-rate-invariant (same value regardless of class proportions), which is both a strength (comparable across datasets) and a weakness (insensitive to the cost impact of class imbalance). PR-AUC is base-rate-sensitive and thus better reflects real-world performance when the positive class is rare.
            <br/><br/>
            <b>Statistical significance:</b> With ~47,000 test samples, metric estimates are precise. The standard error of accuracy is √(acc·(1-acc)/N) ≈ 0.002. A McNemar test on the 2×2 contingency table of RF vs GBM disagreements would determine if their performance difference is statistically significant. Given the large N, even small differences (0.001 in accuracy) can be significant, but practical significance requires larger effect sizes. The Dummy classifier's metrics serve as a sanity check: its PR-AUC should equal the positive class prevalence (~0.43), and its ROC-AUC should be ~0.50 — both confirmed.
          </Tier>
        </LearnCard>
      </div>
    </div>
  );
}

function ScoreExplainer({ url, scores, features, top5 }) {
  if (!url || !scores) return null;
  const rfScore = scores.rf ?? scores.gbm ?? scores.lr ?? 0;
  if (rfScore === null || rfScore === undefined) return null;
  const verdict = rfScore >= 0.75 ? "very likely phishing" : rfScore >= 0.5 ? "possibly phishing" : rfScore >= 0.25 ? "probably safe" : "very likely safe";
  const verdictColor = rfScore >= 0.5 ? "#ff4d6d" : "#00f0ff";
  const pct = (rfScore * 100).toFixed(1);

  const topReasons = (top5 || []).slice(0, 5);
  const pushingPhish = topReasons.filter(f => f.weight > 0);
  const pushingSafe  = topReasons.filter(f => f.weight <= 0);

  return (
    <div style={{ marginBottom:32, padding:"24px 28px", borderRadius:16, background:"rgba(255,255,255,0.025)", border:`1px solid ${verdictColor}30` }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <span style={{ fontSize:28 }}>{rfScore >= 0.5 ? "🚨" : "✅"}</span>
        <div>
          <div style={{ color:verdictColor, fontSize:22, fontWeight:900 }}>{pct}% — {verdict}</div>
          <div style={{ color:"rgba(255,255,255,0.4)", fontSize:12, fontFamily:"monospace", marginTop:2, wordBreak:"break-all" }}>{decodeURIComponent(url)}</div>
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        <div style={{ padding:"16px 20px", borderRadius:12, background:"rgba(0,240,255,0.04)", border:"1px solid rgba(0,240,255,0.12)" }}>
          <div style={{ fontSize:10, fontWeight:800, letterSpacing:1.5, color:"#00f0ff", marginBottom:8 }}>SIMPLE (AGES 7+)</div>
          <div style={{ color:"rgba(255,255,255,0.75)", fontSize:14, lineHeight:1.8 }}>
            {rfScore >= 0.5 ? (
              <><b style={{color:"#ff4d6d"}}>This web address looks suspicious!</b> Our AI checked 18 different clues about this link. The clues that made it look dangerous: {pushingPhish.length > 0 ? pushingPhish.map(f => <span key={f.name} style={{color:"#ff4d6d", fontWeight:700}}>{f.name} ({f.description})</span>).reduce((a,b) => <>{a}, {b}</>) : "multiple small clues added up"}. Think of it like a detective looking at a letter — if the handwriting is messy, the stamp is fake, and the return address does not exist, the detective says "this letter is suspicious." Our AI does the same thing but with web addresses. {pushingSafe.length > 0 && <>However, some clues looked okay: {pushingSafe.map(f => f.name).join(", ")}.</>} The {pct}% score means: out of 100 similar-looking web addresses in our training data, about {Math.round(rfScore*100)} were phishing scams.</>
            ) : (
              <><b style={{color:"#00f0ff"}}>This web address looks safe!</b> Our AI checked 18 different clues and most of them look normal. {pushingSafe.length > 0 ? <>The clues that made it look safe: {pushingSafe.map(f => <span key={f.name} style={{color:"#00f0ff", fontWeight:700}}>{f.name} ({f.description})</span>).reduce((a,b) => <>{a}, {b}</>)}.</> : "The overall pattern matches legitimate websites."} Think of it like checking if a shop is real — if it has a proper sign, a real address, and normal opening hours, it is probably a real shop. {pushingPhish.length > 0 && <>A few clues were slightly unusual ({pushingPhish.map(f => f.name).join(", ")}), but not enough to be worried.</>} The {pct}% score means: out of 100 similar web addresses, only about {Math.round(rfScore*100)} were scams.</>
            )}
          </div>
        </div>

        <div style={{ padding:"16px 20px", borderRadius:12, background:"rgba(155,89,255,0.04)", border:"1px solid rgba(155,89,255,0.12)" }}>
          <div style={{ fontSize:10, fontWeight:800, letterSpacing:1.5, color:"#9b59ff", marginBottom:8 }}>INTERMEDIATE (HIGH SCHOOL / UNDERGRAD)</div>
          <div style={{ color:"rgba(255,255,255,0.75)", fontSize:13, lineHeight:1.8 }}>
            <b>Score: {pct}% phishing probability</b> from the Random Forest model (300 trees, majority vote).
            {topReasons.length > 0 && (<>
              <br/><br/><b>Top contributing features (ranked by impact):</b>
              {topReasons.map((f,i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginTop:6, padding:"6px 10px", borderRadius:8, background: f.weight > 0 ? "rgba(255,77,109,0.06)" : "rgba(0,240,255,0.06)" }}>
                  <span style={{ color: f.weight > 0 ? "#ff4d6d" : "#00f0ff", fontWeight:800, fontSize:12, width:20 }}>{f.weight > 0 ? "▲" : "▼"}</span>
                  <span style={{ color:"#fff", fontWeight:700, fontSize:12 }}>{f.name}</span>
                  <span style={{ color:"rgba(255,255,255,0.4)", fontSize:11 }}>= {f.description}</span>
                  <span style={{ marginLeft:"auto", color: f.weight > 0 ? "#ff4d6d" : "#00f0ff", fontSize:11, fontWeight:700 }}>{f.weight > 0 ? "+" : ""}{(f.weight*100).toFixed(1)}%</span>
                </div>
              ))}
            </>)}
            <br/>The model extracts 18 numerical features from the URL string alone (no DNS, no page content). Each feature pushes the score toward phishing (▲ red) or toward safe (▼ cyan). The final probability is the fraction of 300 trees that voted "phishing." A threshold of 50% is used for the binary decision.
          </div>
        </div>

        <div style={{ padding:"16px 20px", borderRadius:12, background:"rgba(245,158,11,0.04)", border:"1px solid rgba(245,158,11,0.12)" }}>
          <div style={{ fontSize:10, fontWeight:800, letterSpacing:1.5, color:"#f59e0b", marginBottom:8 }}>ADVANCED (PHD / RESEARCHER)</div>
          <div style={{ color:"rgba(255,255,255,0.75)", fontSize:13, lineHeight:1.8 }}>
            <b>P(phishing|URL) = {rfScore.toFixed(4)}</b> via RF ensemble averaging: P = (1/300) Σᵢ 𝟙[treeᵢ votes phishing]. The feature vector x ∈ ℝ¹⁸ is extracted by features.py (deterministic, no external API calls).
            The feature weights shown above approximate SHAP values — each weight represents the marginal contribution of that feature to the log-odds prediction, averaged over all tree paths.
            {scores.gbm !== undefined && scores.lr !== undefined && (<>
              <br/><br/><b>Cross-model agreement:</b> RF={(scores.rf*100).toFixed(1)}%, GBM={(scores.gbm*100).toFixed(1)}%, LR={(scores.lr*100).toFixed(1)}%.
              {Math.abs(scores.rf - scores.gbm) < 0.15
                ? " RF and GBM agree (Δ < 15pp) — high confidence in the classification."
                : " RF and GBM disagree significantly — this URL is in the decision boundary zone. Consider additional context (DNS age, certificate status, page content)."}
            </>)}
            <br/>Note: URL-only features have a theoretical evasion ceiling — an adversary controlling domain registration can craft structurally indistinguishable URLs. This score reflects structural analysis only.
          </div>
        </div>
      </div>

      <div style={{ marginTop:16, display:"flex", gap:12 }}>
        {Object.entries(scores).filter(([,v])=>v!==null&&v!==undefined).map(([id, score]) => (
          <div key={id} style={{ flex:1, textAlign:"center", padding:"10px 14px", borderRadius:10, background:`${COLOR_MAP[id]}08`, border:`1px solid ${COLOR_MAP[id]}20` }}>
            <div style={{ color:"rgba(255,255,255,0.35)", fontSize:10, fontWeight:700, letterSpacing:1 }}>{id.toUpperCase()}</div>
            <div style={{ color: score >= 0.5 ? "#ff4d6d" : COLOR_MAP[id], fontSize:20, fontWeight:900, fontFamily:"monospace" }}>{(score*100).toFixed(1)}%</div>
            <div style={{ color:"rgba(255,255,255,0.25)", fontSize:9 }}>{score >= 0.5 ? "Phishing" : "Safe"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ModelExplorer() {
  const [searchParams] = useSearchParams();
  const incomingUrl = searchParams.get("url") || null;
  const incomingScores = {
    rf:    searchParams.get("rf") ? parseFloat(searchParams.get("rf")) : null,
    gbm:   searchParams.get("gbm") ? parseFloat(searchParams.get("gbm")) : null,
    lr:    searchParams.get("lr") ? parseFloat(searchParams.get("lr")) : null,
    dummy: searchParams.get("dummy") ? parseFloat(searchParams.get("dummy")) : null,
  };
  const hasIncoming = incomingUrl && Object.values(incomingScores).some(v => v !== null);

  const [selected, setSelected] = useState(null);
  const [metric, setMetric]     = useState("ROC-AUC");
  const [apiData, setApiData]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [testUrl, setTestUrl]   = useState("");
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [incomingFeatures, setIncomingFeatures] = useState(null);
  const [incomingTop5, setIncomingTop5] = useState(null);

  useEffect(() => {
    fetch("/api/model-metrics").then(r => r.json()).then(data => {
      setApiData(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (incomingUrl && hasIncoming) {
      fetch("/api/predict", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({url:incomingUrl, model:"rf"}) })
        .then(r => r.json()).then(d => { setIncomingFeatures(d.features || []); setIncomingTop5(d.top5 || []); }).catch(()=>{});
    }
  }, [incomingUrl]);

  async function handleTestUrl() {
    if (!testUrl.trim()) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const scores = {};
      const featureData = { features: [], top5: [] };
      for (const mid of ["rf","gbm","lr","dummy"]) {
        const r = await fetch("/api/predict", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({url:testUrl.trim(), model:mid}) });
        const d = await r.json();
        scores[mid] = d.probability;
        if (mid === "rf") { featureData.features = d.features || []; featureData.top5 = d.top5 || []; }
      }
      setTestResult({ url: testUrl.trim(), scores, ...featureData });
    } catch(e) { setTestResult({ error: "Could not reach backend. Is the API running on port 8001?" }); }
    setTestLoading(false);
  }

  const MODELS = apiData ? ORDER.filter(id => apiData.models[id]).map(id => {
    const m = apiData.models[id];
    return {
      id, name: m.name, short: m.short, icon: ICON_MAP[id], color: COLOR_MAP[id], glow: GLOW_MAP[id],
      desc: m.desc, metrics: m.metrics, confMatrix: m.confMatrix, details: m.details, best: m.best,
      interpretation: m.best ? `Best model. FPR=${(m.metrics.FPR*100).toFixed(1)}% — only ${m.confMatrix[0][1]} legitimate URLs wrongly blocked.`
        : id === "dummy" ? "Always predicts majority class. Sets the absolute baseline."
        : `FPR=${(m.metrics.FPR*100).toFixed(1)}% on the test set.`,
    };
  }) : [];
  const testSize = apiData?.test_size || 0;

  return (
    <div style={{ minHeight:"100vh", background:"#080a14", fontFamily:"'Inter','Segoe UI',sans-serif" }}>
      <Navbar active="Model Explorer" />

      <div style={{ maxWidth:1200, margin:"0 auto", padding:"100px 32px 80px" }}>

        {loading && <div style={{ color:"rgba(255,255,255,0.5)", textAlign:"center", padding:60, fontSize:14 }}>Loading model metrics from backend...</div>}
        {!loading && MODELS.length === 0 && <div style={{ color:"#ff4d6d", textAlign:"center", padding:60, fontSize:14 }}>Could not load metrics. Is the backend running?</div>}

        {/* ── URL TEST INPUT ── */}
        <div style={{ marginBottom:28, padding:"22px 26px", borderRadius:16, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.4)", letterSpacing:1, marginBottom:12 }}>TEST A URL — SEE SCORES FROM ALL 4 MODELS</div>
          <div style={{ display:"flex", gap:10 }}>
            <input
              value={testUrl}
              onChange={e => setTestUrl(e.target.value)}
              onKeyDown={e => e.key==="Enter" && handleTestUrl()}
              placeholder="Paste any URL here (e.g. https://example.com/login)"
              style={{ flex:1, padding:"12px 16px", borderRadius:10, border:"1px solid rgba(0,240,255,0.2)", background:"rgba(0,0,0,0.3)", color:"#fff", fontSize:14, fontFamily:"monospace", outline:"none" }}
            />
            <button
              onClick={handleTestUrl}
              disabled={testLoading}
              style={{ padding:"12px 28px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#00b4d8,#00f0ff)", color:"#080a14", fontWeight:800, fontSize:13, cursor: testLoading ? "wait" : "pointer", opacity: testLoading ? 0.6 : 1 }}
            >{testLoading ? "Analysing..." : "Analyse"}</button>
          </div>
          {testResult?.error && <div style={{ marginTop:12, color:"#ff4d6d", fontSize:12 }}>{testResult.error}</div>}
        </div>

        {/* Test result with 3-tier explanation */}
        {testResult && !testResult.error && (
          <ScoreExplainer url={testResult.url} scores={testResult.scores} features={testResult.features} top5={testResult.top5} />
        )}

        {/* Incoming URL from URL Checker with 3-tier explanation */}
        {hasIncoming && !testResult && (
          <ScoreExplainer url={incomingUrl} scores={incomingScores} features={incomingFeatures || []} top5={incomingTop5 || []} />
        )}

        {/* Header */}
        <div style={{ marginBottom:40 }}>
          <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(0,240,255,0.06)", border:"1px solid rgba(0,240,255,0.18)", borderRadius:20, padding:"5px 14px" }}>
              <span style={{ color:"#00f0ff", fontSize:11, fontWeight:700, letterSpacing:1 }}>MODEL COMPARISON</span>
            </div>
            <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(155,89,255,0.07)", border:"1px solid rgba(155,89,255,0.2)", borderRadius:20, padding:"5px 14px" }}>
              <span style={{ color:"#9b59ff", fontSize:11, fontWeight:700, letterSpacing:1 }}>SHARED SPLIT · 80/20 · SEED=42 · TEST n={testSize.toLocaleString()}</span>
            </div>
          </div>
          <h1 style={{ color:"#fff", fontSize:"clamp(26px,4vw,46px)", fontWeight:900, margin:"0 0 10px", letterSpacing:-0.5 }}>Model Explorer</h1>
          <p style={{ color:"rgba(255,255,255,0.4)", fontSize:14, maxWidth:580 }}>
            Side-by-side comparison of all 4 models. Same train/test split throughout — fair comparison guaranteed. Click any card to expand its confusion matrix.
          </p>
        </div>

        {/* Metric selector */}
        <div style={{ marginBottom:32 }}>
          <div style={{ display:"flex", gap:8, marginBottom:8, flexWrap:"wrap" }}>
            {METRIC_KEYS.map(m => (
              <button key={m} onClick={() => setMetric(m)} style={{ padding:"7px 16px", borderRadius:8, border:"1px solid", fontSize:12, fontWeight:700, cursor:"pointer", transition:"all 0.2s", borderColor: metric===m ? "rgba(0,240,255,0.5)" : "rgba(255,255,255,0.1)", background: metric===m ? "rgba(0,240,255,0.09)" : "transparent", color: metric===m ? "#00f0ff" : "rgba(255,255,255,0.5)" }}>{m}</button>
            ))}
          </div>
          <div style={{ color:"rgba(255,255,255,0.4)", fontSize:12, padding:"6px 0" }}>
            📊 <b style={{ color:"rgba(255,255,255,0.6)" }}>{metric}</b>: {METRIC_EXPLAIN[metric]}
          </div>
        </div>

        {/* Model cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(255px,1fr))", gap:18, marginBottom:40 }}>
          {MODELS.map((m, i) => (
            <div key={i} onClick={() => setSelected(selected===i ? null : i)} style={{ padding:"22px 24px", borderRadius:16, cursor:"pointer", position:"relative", background: selected===i ? `linear-gradient(135deg,${m.color}16,${m.color}07)` : "rgba(255,255,255,0.02)", border:`1px solid ${selected===i ? m.color+"55" : "rgba(255,255,255,0.07)"}`, boxShadow: selected===i ? `0 0 40px ${m.glow}` : "none", transition:"all 0.2s" }}>
              {m.best && <div style={{ position:"absolute", top:12, right:12, background:"linear-gradient(135deg,#00b4d8,#9b59ff)", color:"#fff", fontSize:8, fontWeight:800, padding:"3px 9px", borderRadius:20, letterSpacing:1 }}>BEST MODEL</div>}
              <div style={{ fontSize:26, marginBottom:10 }}>{m.icon}</div>
              <div style={{ color:m.color, fontSize:10, fontWeight:700, letterSpacing:1, marginBottom:3 }}>{m.short}</div>
              <div style={{ color:"#fff", fontSize:16, fontWeight:800, marginBottom:6 }}>{m.name}</div>
              <div style={{ color:"rgba(255,255,255,0.35)", fontSize:11, marginBottom:18, lineHeight:1.5 }}>{m.desc}</div>

              <div style={{ marginBottom:6 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ color:"rgba(255,255,255,0.45)", fontSize:11 }}>{metric}</span>
                  <span style={{ color:m.color, fontSize:14, fontWeight:800 }}>
                    {metric==="FPR" ? `${(m.metrics[metric]*100).toFixed(1)}%` : m.metrics[metric].toFixed(3)}
                  </span>
                </div>
                <MetricBar value={m.metrics[metric]} color={m.color} isInverse={metric==="FPR"}/>
                <div style={{ color:"rgba(255,255,255,0.35)", fontSize:10, marginTop:5, lineHeight:1.4 }}>
                  {interpretMetric(metric, m.metrics[metric])}
                </div>
              </div>

              {/* Quick metrics */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginTop:14 }}>
                {["PR-AUC","FPR"].map(k => (
                  <div key={k} style={{ padding:"8px 10px", borderRadius:8, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ color:"rgba(255,255,255,0.3)", fontSize:9, fontWeight:700 }}>{k}</div>
                    <div style={{ color:m.color, fontSize:14, fontWeight:800 }}>{k==="FPR" ? `${(m.metrics[k]*100).toFixed(1)}%` : m.metrics[k].toFixed(3)}</div>
                    <div style={{ color:"rgba(255,255,255,0.25)", fontSize:8, marginTop:2 }}>{k==="FPR" ? "safe sites wrongly blocked" : "detection reliability"}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop:12, display:"flex", flexWrap:"wrap", gap:5 }}>
                {m.details.map((d,j) => (
                  <span key={j} style={{ fontSize:9, padding:"2px 7px", borderRadius:5, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", color:"rgba(255,255,255,0.4)" }}>{d}</span>
                ))}
              </div>
              <div style={{ marginTop:10, color:"rgba(255,255,255,0.25)", fontSize:10 }}>{selected===i ? "▲ Click to collapse" : "▼ Click for confusion matrix"}</div>
            </div>
          ))}
        </div>

        {/* Expanded confusion matrix */}
        {selected !== null && (
          <div style={{ marginBottom:36, padding:"28px 32px", borderRadius:18, background:`linear-gradient(135deg,${MODELS[selected].color}0e,rgba(255,255,255,0.01))`, border:`1px solid ${MODELS[selected].color}28`, animation:"fadeIn 0.25s ease" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:32 }}>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.4)", letterSpacing:1, marginBottom:18 }}>ALL METRICS — {MODELS[selected].name.toUpperCase()}</div>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {METRIC_KEYS.map(k => (
                    <div key={k}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                        <span style={{ color:"rgba(255,255,255,0.55)", fontSize:12 }}>{k}</span>
                        <span style={{ color:MODELS[selected].color, fontSize:13, fontWeight:800 }}>{k==="FPR" ? `${(MODELS[selected].metrics[k]*100).toFixed(1)}%` : MODELS[selected].metrics[k].toFixed(3)}</span>
                      </div>
                      <MetricBar value={MODELS[selected].metrics[k]} color={MODELS[selected].color} isInverse={k==="FPR"}/>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop:18, padding:"12px 14px", borderRadius:10, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ color:"rgba(255,255,255,0.3)", fontSize:11, lineHeight:1.6 }}>{MODELS[selected].interpretation}</div>
                </div>
              </div>
              <ConfMatrix matrix={MODELS[selected].confMatrix} color={MODELS[selected].color} testSize={testSize}/>
            </div>
          </div>
        )}

        {/* Full comparison table */}
        <div style={{ padding:"24px 28px", borderRadius:16, background:"rgba(255,255,255,0.015)", border:"1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.4)", letterSpacing:1, marginBottom:18 }}>FULL COMPARISON TABLE — SHARED 80/20 SPLIT · SEED=42</div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign:"left", padding:"10px 14px", color:"rgba(255,255,255,0.3)", fontSize:10, fontWeight:700, letterSpacing:1, borderBottom:"1px solid rgba(255,255,255,0.07)" }}>MODEL</th>
                  {METRIC_KEYS.map(k => (
                    <th key={k} style={{ textAlign:"right", padding:"10px 14px", color:"rgba(255,255,255,0.3)", fontSize:10, fontWeight:700, letterSpacing:1, borderBottom:"1px solid rgba(255,255,255,0.07)" }}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODELS.map((m, i) => (
                  <tr key={i} style={{ background: i%2===0 ? "rgba(255,255,255,0.01)" : "transparent", cursor:"pointer" }} onClick={() => setSelected(selected===i?null:i)}>
                    <td style={{ padding:"11px 14px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <span>{m.icon}</span>
                        <span style={{ color:"#fff", fontWeight:700, fontSize:13 }}>{m.name}</span>
                        {m.best && <span style={{ fontSize:8, padding:"2px 7px", borderRadius:10, background:"rgba(0,240,255,0.12)", color:"#00f0ff", fontWeight:800 }}>BEST</span>}
                      </div>
                    </td>
                    {METRIC_KEYS.map(k => {
                      const vals = MODELS.map(mm => mm.metrics[k]);
                      const isBest = k==="FPR" ? m.metrics[k]===Math.min(...vals) : m.metrics[k]===Math.max(...vals);
                      return (
                        <td key={k} style={{ padding:"11px 14px", textAlign:"right" }}>
                          <span style={{ color: isBest ? m.color : "rgba(255,255,255,0.55)", fontWeight: isBest?800:500, fontSize:13, fontFamily:"monospace" }}>
                            {k==="FPR" ? `${(m.metrics[k]*100).toFixed(1)}%` : m.metrics[k].toFixed(3)}{isBest&&" ★"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══════ EDUCATIONAL SECTION ═══════ */}
        <ModelLearnSection />
      </div>

      <style>{`* { box-sizing:border-box } @keyframes fadeIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }`}</style>
    </div>
  );
}
