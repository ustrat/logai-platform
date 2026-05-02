
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowRight, Check, ShieldCheck, LockKeyhole, Star, Heart, MessageCircle, Send, Repeat2 } from "lucide-react";
import { products, addOns, plans, featureRows, safeArchitecture, imageRequirements, imageMap } from "./data/siteData";
import { ProductIcon, palette } from "./components/ProductIcon";
import "./styles.css";

function ImgSlot({src, alt, product, className=""}) {
  const [ok, setOk] = useState(true);
  if (!src || !ok) {
    return (
      <div className={`image-fallback ${className}`}>
        <div>
          <ProductIcon name={product?.icon || "commandGrid"} color={product?.color || "blue"} />
          <h3 style={{marginTop:14}}>{alt}</h3>
          <p>Place image file at:<br/><b>{src || "reserved image path"}</b></p>
        </div>
      </div>
    );
  }
  return <img className={className} src={src} alt={alt} onError={() => setOk(false)} />;
}

function App(){
  return (
    <>
      <Nav/>
      <Hero/>
      <Products/>
      <Segments/>
      <Architecture/>
      <ProductDepth/>
      <AddOns/>
      <Pricing/>
      <ExecutePilot/>
      <FeatureMatrix/>
      <SelectionFlow/>
      <VisualAssetMap/>
      <FinalCTA/>
      <Footer/>
    </>
  );
}

function Nav(){
  return (
    <header className="nav">
      <div className="nav-inner">
        <a href="#home" className="brand"><span className="brand-mark">VP</span> ValuePilot™</a>
        <nav className="links">
          <a href="#products">Products</a>
          <a href="#pricing">Pricing</a>
          <a href="#business">Business</a>
          <a href="#enterprise">Enterprise</a>
          <a href="#executepilot">ExecutePilot™</a>
          <a href="#visuals">Images</a>
        </nav>
        <a className="btn secondary" href="#pricing">Choose plan</a>
      </div>
    </header>
  );
}

function Hero(){
  const renewal = products.find(p=>p.slug==="renewalguard");
  const refund = products.find(p=>p.slug==="refundpilot");
  return (
    <section id="home" className="hero">
      <div className="container hero-grid">
        <div>
          <span className="badge"><Star size={14}/> Governed financial execution</span>
          <h1>Your money has a memory. ValuePilot helps you act on it.</h1>
          <p className="lead">A public-facing financial intelligence ecosystem for consumers, businesses, and enterprises — built to detect waste, recover value, automate decisions, and keep execution controlled.</p>
          <div className="actions">
            <a className="btn green" href="#products">Explore products <ArrowRight size={18}/></a>
            <a className="btn secondary" href="#pricing">Compare plans</a>
            <a className="btn secondary" href="#executepilot">Business command center</a>
          </div>
          <div className="trust">
            <span>✓ Renewal prevention</span>
            <span>✓ Refund recovery</span>
            <span>✓ BoarderPilot™ for everyone</span>
            <span>✓ ExecutePilot™ for Business+</span>
          </div>
        </div>
        <div className="device-showcase">
          <img
            src={imageMap.heroShowcase}
            alt="RenewalGuard and RefundPilot — Now Available"
            style={{
              width: "100%",
              height: "100%",
              maxHeight: 570,
              objectFit: "contain",
              objectPosition: "center",
              borderRadius: 20,
              display: "block",
            }}
          />
        </div>
      </div>
    </section>
  );
}

function AdCard({product}){
  const green = product.slug === "renewalguard";
  return (
    <div className="ad-card">
      <div className="ad-top">
        <div className="stars">★★★★★</div>
        <div className="small" style={{color:"#fff",fontWeight:950}}>1M+ ACTIVE USERS</div>
        <div className="ad-headline">
          {green ? <>Cancel before<br/><span className="script" style={{color:palette.green}}>you’re charged.</span></> : <>Get back money<br/><span className="script" style={{color:palette.blue}}>you didn’t know<br/>you were owed.</span></>}
        </div>
      </div>
      <div className="device-img">
        <ImgSlot src={imageMap[product.imageKey]} alt={`${product.name} phone image`} product={product}/>
      </div>
      <div style={{position:"absolute",right:14,top:276,color:"white",display:"grid",gap:12,justifyItems:"center"}}><Heart/><span>15</span><MessageCircle/><Repeat2/><Send/></div>
      <div className="learn-bar" style={{background: green ? palette.green : palette.blue}}>Learn more <ArrowRight size={22}/></div>
    </div>
  );
}

function Products(){
  return (
    <section id="products" className="section">
      <div className="container">
        <div className="center">
          <span className="badge">Complete public product system</span>
          <h2>Products people understand. Controls businesses trust.</h2>
          <p>The site presents ValuePilot as a powerful consumer, business, and enterprise ecosystem without disclosing protected internal architecture.</p>
        </div>
        <div className="product-grid">
          {products.map(p=>(
            <a className="product-card" href={`#${p.slug}`} key={p.slug}>
              <div className="icon-wrap"><ProductIcon name={p.icon} color={p.color}/></div>
              <h3>{p.name}</h3>
              <span className="badge">{p.availability}</span>
              <p>{p.summary}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function Segments(){
  return (
    <section id="business" className="section soft">
      <div className="container">
        <div className="center">
          <span className="badge">Market segmentation</span>
          <h2>Consumers buy tools. Businesses buy execution. Enterprises buy control.</h2>
        </div>
        <div className="segment-grid">
          <div className="segment">
            <h3>Consumers</h3>
            <p>Prevent unwanted charges, recover missed money, track commitments, improve travel awareness, and see financial outcomes clearly.</p>
            <div className="pill-row"><span className="pill">RenewalGuard™</span><span className="pill">RefundPilot™</span><span className="pill">BoarderPilot™</span><span className="pill">DrivePilot™</span></div>
          </div>
          <div className="segment">
            <h3>Businesses</h3>
            <p>Manage multiple bank, merchant, card, vendor, or payment accounts with workflow visibility, approvals, and controlled action.</p>
            <div className="pill-row"><span className="pill">ExecutePilot™ Core</span><span className="pill">SpendAnalyzer™</span><span className="pill">ContractWatch™</span><span className="pill">LeakageIndex™</span></div>
          </div>
          <div className="segment dark-card" id="enterprise">
            <h3>Enterprise</h3>
            <p>Govern execution across teams, portfolios, vendors, policies, and outcomes with command-center oversight.</p>
            <div className="pill-row"><span className="pill">EnterprisePilot™</span><span className="pill">Full ExecutePilot™</span><span className="pill">Command Center</span><span className="pill">Governance</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Architecture(){
  return (
    <section className="section">
      <div className="container">
        <div className="center">
          <span className="badge"><LockKeyhole size={14}/> Public-safe architecture</span>
          <h2>Show the architecture without revealing the engine.</h2>
          <p>Public messaging uses a safe model that communicates outcomes and trust while protecting proprietary mechanics, thresholds, and orchestration logic.</p>
        </div>
        <div className="arch-grid">
          {safeArchitecture.map((x,i)=>(
            <div className="arch-card" key={x.label}>
              <div className="num">{i+1}</div>
              <h3>{x.label}</h3>
              <p>{x.text}</p>
            </div>
          ))}
        </div>
        <div className="safe-box">
          <b>Public disclosure rule:</b> The website may show “Detect → Validate → Act → Prove.” It must not expose internal confidence thresholds, policy compilation logic, internal event fabric, protected audit mechanics, or patent/trade-secret mappings.
        </div>
      </div>
    </section>
  );
}

function ProductDepth(){
  return (
    <section className="section soft">
      <div className="container">
        <div className="center">
          <span className="badge">Product capability pages</span>
          <h2>Expanded features, presented safely.</h2>
          <p>Each product includes detection, action, control, and measurement layers, but avoids reverse-engineerable internal details.</p>
        </div>
        {products.map(p=>(
          <section className="product-section" id={p.slug} key={p.slug}>
            <div className="product-head">
              <div>
                <div className="icon-wrap"><ProductIcon name={p.icon} color={p.color}/></div>
                <span className="badge">{p.type} • {p.availability}</span>
                <h2 style={{marginTop:14}}>{p.name}</h2>
                <p className="lead">{p.headline}</p>
                <p>{p.summary}</p>
                <div className="pill-row">{p.buyerValue.map(v=><span className="pill" key={v}>{v}</span>)}</div>
              </div>
              <div className="product-media">
                <ImgSlot src={imageMap[p.imageKey]} alt={`${p.name} product visual`} product={p}/>
              </div>
            </div>
            <div className="cap-grid">
              <Cap title="Detect" items={p.publicCapabilities.detect}/>
              <Cap title="Act" items={p.publicCapabilities.act}/>
              <Cap title="Control" items={p.publicCapabilities.control}/>
              <Cap title="Measure" items={p.publicCapabilities.measure}/>
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function Cap({title, items}){
  return <div className="cap-card"><h3>{title}</h3><ul>{items.map(x=><li key={x}>{x}</li>)}</ul></div>
}

function AddOns(){
  return (
    <section className="section">
      <div className="container">
        <div className="center">
          <span className="badge">Add-on modules</span>
          <h2>Attach deeper capability without confusing the product story.</h2>
        </div>
        <div className="addon-grid">
          {addOns.map(a=>(
            <div className="addon-card" key={a.name}>
              {a.imageKey && <div style={{marginBottom:18,borderRadius:14,overflow:"hidden",background:"#07111f",height:300}}><ImgSlot src={imageMap[a.imageKey]} alt={`${a.name} dashboard`} product={{icon:a.icon,color:a.color}} className="addon-img"/></div>}
              <div className="icon-wrap"><ProductIcon name={a.icon} color={a.color}/></div>
              <h3>{a.name}</h3>
              <p><b>Connects to:</b> {a.host}</p>
              <p>{a.summary}</p>
              <div className="pill-row">{a.capabilities.map(c=><span className="pill" key={c}>{c}</span>)}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing(){
  return (
    <section id="pricing" className="section soft">
      <div className="container">
        <div className="center">
          <span className="badge">Account-based pricing</span>
          <h2>Plans scale by account coverage and execution control.</h2>
          <p>Base price is tied to connected bank, merchant, card, vendor, or payment accounts. ExecutePilot™ is available only for Business and Enterprise plans.</p>
        </div>
        <div className="price-grid">
          {plans.map((p,i)=>(
            <div className={`price-card ${i===2 || i===4 ? "featured":""}`} key={p.name}>
              {i===2 || i===4 ? <span className="badge">Recommended</span> : null}
              <h3 style={{marginTop:12}}>{p.name}</h3>
              <p>{p.audience}</p>
              <div className="price">{p.price}</div>
              <p><b>{p.accounts}</b></p>
              <ul>{p.include.map(x=><li key={x}><span className="check">✓</span> {x}</li>)}</ul>
              <p className="small">{p.note}</p>
              <a className="btn secondary" href="#selection">Select {p.name}</a>
            </div>
          ))}
        </div>
        <div style={{marginTop:30,borderRadius:26,overflow:"hidden",background:"#07111f"}}>
          <ImgSlot src={imageMap.pricing} alt="Pricing cards visual" product={{icon:"commandGrid",color:"blue"}}/>
        </div>
      </div>
    </section>
  );
}

function ExecutePilot(){
  return (
    <section id="executepilot" className="section dark">
      <div className="container command-grid">
        <div>
          <span className="badge">Business & Enterprise only</span>
          <h2 style={{marginTop:16}}>ExecutePilot™ is the control layer for business action.</h2>
          <p>ExecutePilot™ is not sold to individual consumers. It is available where organizations need controlled execution: approvals, policy enforcement, exception handling, recovery controls, and audit visibility.</p>
          <div className="actions">
            <a className="btn blue" href="#pricing">View business plans</a>
            <a className="btn secondary" href="#features">Compare features</a>
          </div>
        </div>
        <div className="command-ui">
          <div className="dash-top"><span>ExecutePilot™ Command Center</span><span>Live Control</span></div>
          <div className="metric-row">
            <div className="metric"><b>23</b><p>Pending</p></div>
            <div className="metric"><b>17</b><p>In progress</p></div>
            <div className="metric"><b>89</b><p>Complete</p></div>
            <div className="metric"><b>2</b><p>Review</p></div>
          </div>
          <div className="lane"><b>Approval Queue</b><p>Business actions awaiting validation.</p><div className="bar"><span style={{width:"78%",background:palette.blue}}/></div></div>
          <div className="lane"><b>Policy Check</b><p>Actions validated before release.</p><div className="bar"><span style={{width:"91%",background:palette.green}}/></div></div>
          <div className="lane"><b>Audit Record</b><p>Outcomes visible and traceable.</p><div className="bar"><span style={{width:"86%",background:palette.orange}}/></div></div>
        </div>
      </div>
      <div className="container" style={{marginTop:36,borderRadius:28,overflow:"hidden",background:"#07111f"}}>
        <ImgSlot src={imageMap.executepilot} alt="ExecutePilot command center image" product={products.find(p=>p.slug==="executepilot")}/>
      </div>
    </section>
  );
}

function FeatureMatrix(){
  return (
    <section id="features" className="section">
      <div className="container">
        <div className="center">
          <span className="badge">Feature matrix</span>
          <h2>Shortform table up front. Expanded capability sections underneath.</h2>
        </div>
        <div className="feature-wrap">
          <table className="feature-table">
            <thead><tr><th>Capability</th><th>Starter</th><th>Plus</th><th>Pro</th><th>Business</th><th>Enterprise</th></tr></thead>
            <tbody>{featureRows.map(row=><tr key={row[0]}>{row.map((cell,i)=><td key={i}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <div style={{marginTop:30,borderRadius:26,overflow:"hidden",background:"#07111f"}}>
          <ImgSlot src={imageMap.featureMatrix} alt="Feature matrix visual" product={{icon:"commandGrid",color:"blue"}}/>
        </div>
      </div>
    </section>
  );
}

function SelectionFlow(){
  const steps = ["Choose user type", "Choose goal", "Select products", "Choose account scale", "Add modules", "Business+ execution level"];
  return (
    <section id="selection" className="section soft">
      <div className="container">
        <div className="center">
          <span className="badge">Calendly-inspired product selection</span>
          <h2>Simple decision flow for a large ecosystem.</h2>
        </div>
        <div className="flow-grid">
          {steps.map((s,i)=><div className="flow-card" key={s}><div className="flow-num">{i+1}</div><h3>{s}</h3><p>{i===5 ? "Shown only for Business and Enterprise." : "Guided selection without overwhelming the buyer."}</p></div>)}
        </div>
      </div>
    </section>
  );
}

function VisualAssetMap(){
  const gallery = [
    { key: "renewalguard",      label: "RenewalGuard™",       file: "renewalguard-phone.png" },
    { key: "refundpilot",       label: "RefundPilot™",        file: "refundpilot-phone.png" },
    { key: "boarderpilot",      label: "BoarderPilot™",       file: "boarderpilot-phone.png" },
    { key: "followup",          label: "FollowUp™",           file: "followup-phone.png" },
    { key: "drivepilot",        label: "DrivePilot™",         file: "drivepilot-phone.png" },
    { key: "leakageindex",      label: "LeakageIndex™",       file: "leakageindex-dashboard.png" },
    { key: "enterprisepilot",   label: "EnterprisePilot™",    file: "enterprisepilot-dashboard.png" },
    { key: "executepilot",      label: "ExecutePilot™",       file: "executepilot-command-center.png" },
    { key: "spendanalyzer",     label: "SpendAnalyzer™",      file: "spendanalyzer-dashboard.png" },
    { key: "contractwatch",     label: "ContractWatch™",      file: "contractwatch-dashboard.png" },
    { key: "smartreminder",     label: "SmartReminder™",      file: "smartreminder-dashboard.png" },
    { key: "autodraft",         label: "AutoDraft™",          file: "autodraft-dashboard.png" },
    { key: "currencyguard",     label: "CurrencyGuard™",      file: "currencyguard-dashboard.png" },
    { key: "taxnormalizer",     label: "TaxNormalizer™",      file: "taxnormalizer-dashboard.png" },
    { key: "pricing",           label: "Pricing Cards",       file: "pricing-cards.png" },
    { key: "ecosystem",         label: "Ecosystem Diagram",   file: "ecosystem-public-diagram.png" },
    { key: "featureMatrix",     label: "Feature Matrix",      file: "feature-matrix.png" },
    { key: "logoAssets",        label: "Logo Assets",         file: "valuepilot-logo-assets.png" },
  ];
  return (
    <section id="visuals" className="section soft">
      <div className="container">
        <div className="center">
          <span className="badge">Visual asset gallery</span>
          <h2>Product visuals and marketing assets.</h2>
          <p>All images deployed and live. Click any image to view full size.</p>
        </div>
        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",
          gap:24,
          marginTop:32
        }}>
          {gallery.map(({key, label, file})=>(
            <a
              key={key}
              href={imageMap[key]}
              target="_blank"
              rel="noopener noreferrer"
              style={{textDecoration:"none"}}
            >
              <div style={{
                background:"#07111f",
                borderRadius:16,
                overflow:"hidden",
                border:"1px solid rgba(255,255,255,0.08)",
                transition:"transform 0.2s,box-shadow 0.2s",
                cursor:"pointer",
              }}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow="0 12px 40px rgba(0,0,0,0.4)";}}
                onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}
              >
                <ImgSlot
                  src={imageMap[key]}
                  alt={label}
                  product={products.find(p=>p.slug===key) || {icon:"commandGrid",color:"blue"}}
                  className="visual-thumb"
                />
                <div style={{padding:"12px 16px",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
                  <div style={{fontWeight:700,color:"#fff",fontSize:14}}>{label}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:3,fontFamily:"monospace"}}>{file}</div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA(){
  return (
    <section className="section dark">
      <div className="container center">
        <h2>Stop leaving money behind. Start acting with control.</h2>
        <p>ValuePilot is designed to support individual savings, business operations, and enterprise-grade governed execution — while keeping protected architecture behind the right boundary.</p>
        <div className="actions" style={{justifyContent:"center"}}>
          <a className="btn green" href="#pricing">Choose your plan</a>
          <a className="btn secondary" href="#products">Explore products</a>
        </div>
      </div>
    </section>
  );
}

function Footer(){
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <div className="brand"><span className="brand-mark">VP</span> ValuePilot™</div>
          <p>Governed financial execution for consumers, businesses, and enterprises.</p>
          <p className="small">Public website version. Proprietary architecture details reserved for NDA-governed review.</p>
        </div>
        <div><b>Products</b><p>RenewalGuard™<br/>RefundPilot™<br/>BoarderPilot™<br/>FollowUp™</p></div>
        <div><b>Business</b><p>Pricing<br/>ExecutePilot™<br/>EnterprisePilot™<br/>Security</p></div>
        <div><b>Deploy</b><p>Run npm build. Upload dist contents to GoDaddy public_html.</p></div>
      </div>
    </footer>
  );
}

createRoot(document.getElementById("root")).render(<App />);
