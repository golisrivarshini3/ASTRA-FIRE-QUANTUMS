"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Atom, BookOpen, BrainCircuit, Database, Flame, Gauge, Image as ImageIcon, Search, ShieldCheck, Upload, ChevronRight, ExternalLink, Orbit, Radio, Shield, Rocket, Target, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { getJSON, postJSON, postFile } from "@/lib/api";

type Investigation = {id:string; name:string; domain:string; objective:string; fuel_or_subject:string; hardware:string; conditions:string; measurements:string; evidence_status:string; source_url:string; notes:string};
type Overview = {investigation_count:number; domain_count:number; domains:Record<string,number>; partial_gravity_data:string};
type Ranked = Investigation & {rank:number; relevance_score:number; confidence:string; matched_topics:string[]; explanation:string};
type CVResult = {image_width:number;image_height:number;candidate_regions:number;largest_region_area_px:number;largest_region_perimeter_px:number;circularity:number|null;note:string};
type AssistantResult = {answer:string;sources:Investigation[]};

const nav = [
  ["Overview","overview",Activity],["PSI Explorer","explorer",Database],["AI Ranking","ranking",BrainCircuit],
  ["Atmosphere Lab","atmosphere",Gauge],["Computer Vision","cv",ImageIcon],["Research Assistant","assistant",BookOpen]
] as const;
const topics = ["Material flammability","Smoke detection","Flame suppression","Gaseous-fuel combustion","Liquid-fuel droplets"];
const missionScenarios = [
  { id:"spacecraft", title:"Crewed spacecraft", subtitle:"Cabin & station fire response", icon:Orbit, detail:"Prioritize material ignition, early smoke detection and suppression evidence in enclosed crew environments.", focus:["Material flammability","Smoke detection","Flame suppression"], pillar:"Prevention · Detection · Suppression", caveat:"Microgravity investigations are most directly relevant; verify cabin pressure, oxygen and airflow conditions." },
  { id:"lunar", title:"Lunar habitat", subtitle:"Surface base / pressurized module", icon:Rocket, detail:"Find material and combustion studies that can inform habitat design while making the partial-gravity evidence gap explicit.", focus:["Material flammability","Gaseous-fuel combustion","Flame suppression"], pillar:"Prevention · Suppression", caveat:"Do not treat microgravity as lunar gravity. Current catalog does not identify direct lunar partial-gravity measurements." },
  { id:"rover", title:"Pressurized rover", subtitle:"Confined mobile crew volume", icon:Radio, detail:"Emphasize smoke/aerosol sensing, material selection and practical suppression concepts for a compact crew volume.", focus:["Smoke detection","Material flammability","Flame suppression"], pillar:"Detection · Prevention · Suppression", caveat:"Rover-specific geometry and ventilation conditions need dedicated validation." },
  { id:"materials", title:"Material qualification", subtitle:"Compare fuels, samples & test conditions", icon:Shield, detail:"Explore solid-material flammability and combustion experiments; compare what was measured and under which atmosphere.", focus:["Material flammability","Gaseous-fuel combustion"], pillar:"Prevention", caveat:"A study's relevance depends on matching material, geometry, oxygen partial pressure and flow—not its title alone." }
];

export default function Home() {
  const [tab,setTab] = useState<string>("overview");
  const [scenario,setScenario] = useState("spacecraft");
  const [overview,setOverview] = useState<Overview|null>(null);
  const [records,setRecords] = useState<Investigation[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [query,setQuery] = useState("");
  const [domain,setDomain] = useState("All domains");
  const [focus,setFocus] = useState<string[]>(topics.slice(0,3));
  const [ranked,setRanked] = useState<Ranked[]>([]);
  const [oxygen,setOxygen] = useState(30);
  const [pressure,setPressure] = useState(70);
  const [partial,setPartial] = useState<number|null>(null);
  const [file,setFile] = useState<File|null>(null);
  const [cv,setCv] = useState<CVResult|null>(null);
  const [cvBusy,setCvBusy] = useState(false);
  const [question,setQuestion] = useState("");
  const [useAI,setUseAI] = useState(false);
  const [answer,setAnswer] = useState<AssistantResult|null>(null);
  const [busy,setBusy] = useState(false);

  useEffect(() => {
    Promise.all([getJSON<Overview>("/api/overview"),getJSON<Investigation[]>("/api/investigations")])
      .then(([o,r])=>{setOverview(o);setRecords(r);}).catch(e=>setError(String(e))).finally(()=>setLoading(false));
  },[]);
  useEffect(()=>{ if(tab==="ranking") postJSON<Ranked[]>("/api/rank",{focus}).then(setRanked).catch(e=>setError(String(e))); },[tab,focus]);
  const activeScenario = missionScenarios.find(s=>s.id===scenario) ?? missionScenarios[0];
  const domains = useMemo(()=>["All domains",...Array.from(new Set(records.map(r=>r.domain)))],[records]);
  const filtered = useMemo(()=>records.filter(r=>(domain==="All domains"||r.domain===domain) && (r.name+" "+r.objective+" "+r.fuel_or_subject).toLowerCase().includes(query.toLowerCase())),[records,domain,query]);

  async function calculateAtmosphere() {
    try { const r=await postJSON<{oxygen_partial_pressure_kpa:number}>("/api/atmosphere",{oxygen_percent:oxygen,total_pressure_kpa:pressure}); setPartial(r.oxygen_partial_pressure_kpa); }
    catch(e){setError(String(e));}
  }
  async function analyze() {
    if(!file)return; setCvBusy(true);setCv(null);
    try {setCv(await postFile<CVResult>("/api/cv/analyze",file));} catch(e){setError(String(e));} finally{setCvBusy(false);}
  }
  async function ask() {
    if(!question.trim())return;setBusy(true);setAnswer(null);
    try {setAnswer(await postJSON<AssistantResult>("/api/assistant",{question,use_local_model:useAI}));}catch(e){setError(String(e));}finally{setBusy(false);}
  }

  return <div className="min-h-screen">
    <header className="sticky top-0 z-20 border-b border-line bg-[#07111f]/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-3">
        <div className="flex items-center gap-3"><div className="rounded-xl border border-cyan/30 bg-cyan/10 p-2 text-cyan"><Flame size={22}/></div><div><div className="font-bold tracking-[.16em]">ASTRA<span className="text-cyan">-FIRE</span></div><div className="text-[10px] uppercase tracking-[.18em] text-muted">Space combustion intelligence</div></div></div>
        <div className="flex items-center gap-2"><span className="hidden items-center gap-2 text-xs text-muted sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-400"/>Research prototype</span><a href="/lab" className="rounded-lg border border-cyan/30 bg-cyan/10 px-3 py-2 text-xs text-cyan">Data workbench ↗</a></div>
      </div>
    </header>
    <div className="mx-auto grid max-w-[1500px] gap-5 px-5 py-5 lg:grid-cols-[220px_1fr]">
      <aside className="panel h-fit p-3 lg:sticky lg:top-[84px]">
        <div className="eyebrow mb-3 px-2">Mission console</div>
        <nav className="flex gap-1 overflow-x-auto pb-1 lg:grid lg:grid-cols-1 lg:overflow-visible">
          {nav.map(([label,id,Icon])=><button key={id} onClick={()=>setTab(id)} className={`flex min-w-max items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition lg:py-2.5 ${tab===id?"bg-cyan/10 text-cyan":"text-muted hover:bg-white/5 hover:text-white"}`}><Icon size={16}/>{label}{tab===id&&<ChevronRight className="ml-auto" size={14}/>}</button>)}
        </nav>
        <div className="mt-6 rounded-xl border border-line bg-[#091827] p-3"><div className="eyebrow">Mission focus</div><p className="mt-2 text-xs leading-5 text-muted">Discover research evidence that can inform prevention, detection and suppression of fires in crewed spacecraft and habitats.</p></div>
      </aside>

      <main className="min-w-0">
        <section className="relative mb-5 overflow-hidden rounded-2xl border border-[#24425c] bg-[radial-gradient(ellipse_at_80%_0%,rgba(33,135,157,.24),transparent_45%),linear-gradient(115deg,#10243b,#0a1728)] p-6 md:p-8">
          <div className="relative z-10 max-w-4xl"><div className="eyebrow">NASA Space Apps Challenge · Flames in Free Fall</div><div className="mt-3 flex flex-wrap items-center gap-2"><span className="rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan">Mission research intelligence</span><span className="text-xs text-[#91a5bb]">Prevention · Detection · Suppression</span></div><h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">Can we make crewed space habitats<br/><span className="text-cyan">safer from fire?</span></h1><p className="mt-4 max-w-3xl text-sm leading-6 text-[#b6c9d9]">ASTRA-FIRE connects NASA combustion investigations to real mission decisions: which materials are safer, how smoke may be detected, and what suppression research can inform spacecraft and surface habitats.</p><div className="mt-5 flex flex-wrap gap-2"><button className="btn" onClick={()=>document.getElementById("mission-scenarios")?.scrollIntoView({behavior:"smooth"})}><Target className="mr-1" size={15}/>Choose a mission scenario</button><button className="btn" onClick={()=>setTab("explorer")}>Explore NASA investigations <ChevronRight className="ml-1 inline" size={14}/></button></div></div>
          <div className="pointer-events-none absolute -right-10 -top-12 hidden h-72 w-72 rounded-full border border-cyan/10 md:block"/><div className="pointer-events-none absolute right-12 top-12 hidden h-44 w-44 rounded-full border border-cyan/10 md:block"/><Atom className="absolute right-24 top-20 hidden text-cyan/20 md:block" size={130}/>
        </section>

        {error&&<div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}<button className="ml-3 underline" onClick={()=>setError("")}>Dismiss</button><button className="ml-3 inline-flex items-center gap-1 underline" onClick={()=>{setLoading(true);Promise.all([getJSON<Overview>("/api/overview"),getJSON<Investigation[]>("/api/investigations")]).then(([o,r])=>{setOverview(o);setRecords(r);setError("");}).catch(e=>setError(String(e))).finally(()=>setLoading(false));}}><RefreshCw size={12}/> Retry API</button></div>}
        {loading?<div className="panel p-8 text-sm text-muted">Connecting to ASTRA-FIRE API…</div>:<>
        {tab==="overview"&&<div className="space-y-5">
          <section id="mission-scenarios" className="panel p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><div className="eyebrow">Start with the mission</div><h2 className="mt-1 text-xl font-semibold">What environment are you designing fire safety for?</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-muted">Choose a scenario to set research priorities. ASTRA-FIRE will use them to rank relevant investigations—not to predict real-world fire risk.</p></div>
              <span className="rounded-full border border-line px-3 py-1 text-[10px] text-muted">Interactive mission brief</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {missionScenarios.map(s=>{const Icon=s.icon;return <button key={s.id} onClick={()=>setScenario(s.id)} className={`scenario-card text-left ${scenario===s.id?"scenario-card-active":""}`} aria-pressed={scenario===s.id}>
                <div className="flex items-center justify-between"><Icon size={20} className={scenario===s.id?"text-cyan":"text-muted"}/><span className={`h-2 w-2 rounded-full ${scenario===s.id?"bg-cyan":"bg-slate-600"}`}/></div>
                <div className="mt-3 font-semibold">{s.title}</div><div className="mt-1 text-[11px] text-muted">{s.subtitle}</div>
              </button>})}
            </div>
            <div className="mt-4 grid gap-4 rounded-xl border border-cyan/20 bg-cyan/[.045] p-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div><div className="eyebrow">Selected mission · {activeScenario.title}</div><p className="mt-2 text-sm leading-6">{activeScenario.detail}</p><div className="mt-2 flex flex-wrap gap-2">{activeScenario.focus.map(t=><span key={t} className="rounded-full border border-cyan/20 bg-cyan/10 px-2.5 py-1 text-[10px] text-cyan">{t}</span>)}</div><p className="mt-3 text-[11px] leading-5 text-amber-200/80"><strong>Evidence boundary:</strong> {activeScenario.caveat}</p></div>
              <button className="btn whitespace-nowrap" onClick={()=>{setFocus(activeScenario.focus);setTab("ranking");}}>Rank research for this mission <ChevronRight size={14}/></button>
            </div>
          </section>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Research records in prototype catalog" value={overview?.investigation_count??"—"} icon={<Database/>}/>
            <Metric label="Research domains" value={overview?.domain_count??"—"} icon={<Atom/>}/>
            <Metric label="Fire-safety pillars" value="03" icon={<ShieldCheck/>}/>
            <Metric label="Direct partial-gravity evidence" value="Not identified" compact icon={<Activity/>}/>
          </div>
          <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
            <div className="panel p-5"><div className="eyebrow">Research landscape</div><h2 className="mt-1 text-lg font-semibold">Coverage across research themes</h2><div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={Object.entries(overview?.domains??{}).map(([name,count])=>({name,count}))} margin={{left:-20,bottom:35}}><CartesianGrid stroke="#20334b" vertical={false}/><XAxis dataKey="name" tick={{fill:"#91a5bb",fontSize:10}} angle={-20} textAnchor="end" interval={0}/><YAxis tick={{fill:"#91a5bb",fontSize:10}}/><Tooltip contentStyle={{background:"#101d30",border:"1px solid #20334b",borderRadius:10}}/><Bar dataKey="count" fill="#50d7e8" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></div>
            <div className="panel p-5"><div className="eyebrow">Three safety pillars</div><h2 className="mt-1 text-lg font-semibold">What each pillar needs to answer</h2><div className="mt-5 space-y-4">{[["01","Prevention","Which materials ignite or sustain burning under mission atmospheres?"],["02","Detection","Can smoke and aerosols be detected early in reduced gravity?"],["03","Suppression","Which suppression mechanisms work in altered gravity and airflow?"]].map(([n,t,d])=><div key={n} className="flex gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan/10 text-xs font-bold text-cyan">{n}</div><div><div className="font-semibold">{t}</div><div className="mt-1 text-xs leading-5 text-muted">{d}</div></div></div>)}</div></div>
          </div>
          <section className="panel p-5"><div className="eyebrow">How ASTRA-FIRE supports the challenge</div><div className="mt-3 grid gap-3 md:grid-cols-3">{[
            ["01","Discover","Find NASA investigations by material, fuel, hardware, environment and safety objective.","explorer",Database],
            ["02","Compare & prioritize","Rank evidence against a spacecraft, habitat or rover mission context.","ranking",BrainCircuit],
            ["03","Interpret carefully","Review atmosphere conditions, flame imagery and source-backed research gaps.","assistant",BookOpen]
          ].map(([n,title,desc,target,Icon])=>{const I=Icon as typeof Database;return <button key={String(n)} onClick={()=>setTab(String(target))} className="workflow-step text-left"><div className="flex items-center justify-between"><span className="eyebrow">{n}</span><I size={17} className="text-cyan"/></div><div className="mt-2 font-semibold">{String(title)}</div><p className="mt-1 text-xs leading-5 text-muted">{String(desc)}</p><span className="mt-3 inline-flex items-center gap-1 text-xs text-cyan">Open module <ChevronRight size={12}/></span></button>})}</div></section>
          <div className="panel p-5"><div className="flex items-center justify-between"><div><div className="eyebrow">Featured records</div><h2 className="mt-1 text-lg font-semibold">Explore the research catalog</h2></div><button className="btn" onClick={()=>setTab("explorer")}>View all</button></div><div className="mt-4 grid gap-3 md:grid-cols-3">{records.slice(0,3).map(r=><RecordCard key={r.id} r={r}/>)}</div></div>
        </div>}

        {tab==="explorer"&&<div className="space-y-4"><PageTitle eyebrow="NASA PSI research" title="Investigation explorer" desc="Search the starter catalog and follow each record to NASA's public PSI search. Exact experiment-level metadata still needs verification."/>
          <div className="panel p-4"><div className="grid gap-3 md:grid-cols-[1fr_220px]"><div className="relative"><Search className="absolute left-3 top-3 text-muted" size={16}/><input className="field pl-10" placeholder="Search investigation, objective or fuel…" value={query} onChange={e=>setQuery(e.target.value)}/></div><select className="field" value={domain} onChange={e=>setDomain(e.target.value)}>{domains.map(d=><option key={d}>{d}</option>)}</select></div><div className="mt-3 text-xs text-muted">{filtered.length} records found</div></div>
          <div className="grid gap-3 md:grid-cols-2">{filtered.map(r=><RecordCard key={r.id} r={r}/>)}</div>
        </div>}

        {tab==="ranking"&&<div className="space-y-4"><PageTitle eyebrow="Explainable intelligence" title="Mission relevance ranking" desc="Rule-based topical relevance against selected research priorities. This is not a NASA score or a validated fire-risk prediction."/>
          <div className="panel p-5"><div className="font-semibold">Select mission priorities</div><div className="mt-3 flex flex-wrap gap-2">{topics.map(t=><button key={t} onClick={()=>setFocus(old=>old.includes(t)?old.filter(x=>x!==t):[...old,t])} className={`rounded-full border px-3 py-2 text-xs ${focus.includes(t)?"border-cyan/50 bg-cyan/10 text-cyan":"border-line text-muted"}`}>{t}</button>)}</div></div>
          <div className="panel overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-4"><div className="font-semibold">Ranked investigation records</div><span className="text-[10px] text-muted">Topical match score · not a fire-risk probability</span></div>{ranked.length===0?<div className="p-6 text-sm text-muted">Select at least one research priority to generate a ranking.</div>:ranked.map(r=><div key={r.id} className="grid gap-2 border-b border-line/70 p-4 last:border-0 md:grid-cols-[50px_1fr_100px] md:items-center"><div className="text-2xl font-light text-cyan">#{r.rank}</div><div><div className="font-semibold">{r.name}</div><div className="mt-1 text-xs text-muted">{r.explanation}</div><div className="mt-1 text-[11px] text-muted">Confidence: {r.confidence} · {r.domain}</div></div><div className="text-right"><div className="text-xl font-semibold">{r.relevance_score}</div><div className="text-[10px] text-muted">match / 100</div></div></div>)}</div>
        </div>}

        {tab==="atmosphere"&&<div className="space-y-4"><PageTitle eyebrow="Physics sandbox" title="Atmosphere lab" desc="Explore oxygen partial pressure. This calculator does not estimate ignition probability or material flammability."/>
          <div className="grid gap-4 lg:grid-cols-[1fr_.8fr]"><div className="panel p-5 space-y-6"><div><div className="flex justify-between text-sm"><label>Oxygen concentration</label><strong className="text-cyan">{oxygen}%</strong></div><input type="range" min="1" max="100" value={oxygen} onChange={e=>setOxygen(+e.target.value)} className="mt-3 w-full accent-cyan"/></div><div><div className="flex justify-between text-sm"><label>Total pressure</label><strong className="text-cyan">{pressure} kPa</strong></div><input type="range" min="20" max="150" value={pressure} onChange={e=>setPressure(+e.target.value)} className="mt-3 w-full accent-cyan"/></div><button className="btn w-full" onClick={calculateAtmosphere}>Calculate oxygen partial pressure</button></div>
          <div className="panel flex flex-col justify-center p-6"><div className="eyebrow">Calculated output</div><div className="mt-3 text-4xl font-semibold text-cyan">{partial===null?"—":partial.toFixed(2)} <span className="text-base text-muted">kPa</span></div><div className="mt-2 text-sm text-muted">Oxygen partial pressure</div><div className="mt-5 rounded-lg border border-line bg-[#081626] p-3 font-mono text-sm">P(O₂) = x(O₂) × P(total)</div><p className="mt-4 text-xs leading-5 text-muted">A higher oxygen fraction does not by itself tell the full story. Compare oxygen partial pressure and total pressure, and consult validated flammability data for the material and configuration.</p></div></div>
        </div>}

        {tab==="cv"&&<div className="space-y-4"><PageTitle eyebrow="OpenCV analysis" title="Flame image lab" desc="Upload a flame image to segment candidate warm/blue regions and calculate image-space geometry. This is an initial heuristic, not a trained flame detector."/>
          <div className="grid gap-4 lg:grid-cols-[1fr_.8fr]"><div className="panel p-5"><div className="flex items-center gap-2 font-semibold"><Upload size={17} className="text-cyan"/> Upload an image</div><input type="file" accept="image/png,image/jpeg,image/webp,image/tiff" onChange={e=>{setFile(e.target.files?.[0]??null);setCv(null)}} className="mt-4 block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-cyan/10 file:px-3 file:py-2 file:text-cyan"/>{file&&<div className="mt-3 text-xs text-muted">{file.name} · {(file.size/1024).toFixed(1)} KB</div>}<button className="btn mt-4 w-full" disabled={!file||cvBusy} onClick={analyze}>{cvBusy?"Analyzing…":"Analyze flame regions"}</button>{file&&<img src={URL.createObjectURL(file)} alt="Uploaded flame" className="mt-4 max-h-72 w-full rounded-xl border border-line object-contain"/>}</div>
          <div className="panel p-5"><div className="eyebrow">Image metrics</div>{cv?<><div className="mt-4 grid grid-cols-2 gap-3"><MiniMetric label="Candidate regions" value={cv.candidate_regions}/><MiniMetric label="Image size" value={`${cv.image_width} × ${cv.image_height}`}/><MiniMetric label="Largest area" value={`${cv.largest_region_area_px} px²`}/><MiniMetric label="Circularity" value={cv.circularity===null?"N/A":cv.circularity.toFixed(4)}/></div><p className="mt-4 text-xs leading-5 text-muted">{cv.note}</p></>:<div className="mt-8 text-sm leading-6 text-muted">Analysis outputs will appear here. The initial segmentation uses broad HSV color thresholds and morphological cleanup.</div>}</div></div>
        </div>}

        {tab==="assistant"&&<div className="space-y-4"><PageTitle eyebrow="Evidence-grounded AI" title="Research assistant" desc="Retrieve relevant catalog records, with optional local Ollama generation. Answers are constrained to the currently available catalog context."/>
          <div className="panel p-5"><textarea className="field min-h-28 resize-y" placeholder="Ask: Which experiments are relevant to smoke detection in crew habitats?" value={question} onChange={e=>setQuestion(e.target.value)}/><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={useAI} onChange={e=>setUseAI(e.target.checked)} className="accent-cyan"/> Use local Ollama model if available</label><button className="btn" disabled={!question.trim()||busy} onClick={ask}>{busy?"Searching…":"Ask ASTRA-FIRE"}</button></div></div>
          {answer&&<div className="panel p-5"><div className="eyebrow">Response</div><div className="assistant-answer mt-3 text-sm leading-7"><AssistantMarkdown text={answer.answer}/></div><div className="mt-5 font-semibold">Retrieved sources</div><div className="mt-3 space-y-2">{answer.sources.map(s=><div key={s.id} className="rounded-lg border border-line p-3"><div className="font-semibold">{s.name}</div><p className="mt-1 text-xs text-muted">{s.objective}</p><a href={s.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-cyan">NASA source <ExternalLink size={12}/></a></div>)}</div></div>}
        </div>}
        </>}
        <footer className="mt-8 border-t border-line pt-4 text-[11px] leading-5 text-muted">ASTRA-FIRE is an independent hackathon prototype and is not endorsed by NASA. Starter catalog entries require verification against original PSI records. Not a certified fire-safety or operational risk-assessment system.</footer>
      </main>
    </div>
  </div>;
}

function AssistantMarkdown({text}:{text:string}) {
  return <div className="space-y-3">{text.split(/\n{2,}/).map((block,i)=>{
    const line=block.trim();
    if(!line)return null;
    const heading=line.match(/^#{1,3}\s+(.+)$/);
    const content=heading?heading[1]:line;
    const parts=content.split(/(\*\*[^*]+\*\*)/g);
    const rendered=parts.map((part,j)=>part.startsWith("**")&&part.endsWith("**")?<strong key={j} className="font-semibold text-slate-100">{part.slice(2,-2)}</strong>:part);
    return heading ? <h3 key={i} className="pt-1 font-semibold text-cyan-200">{rendered}</h3> : <p key={i}>{rendered}</p>;
  })}</div>;
}

function Metric({label,value,icon,compact=false}:{label:string;value:string|number;icon:React.ReactNode;compact?:boolean}) {
  return <div className="panel p-4"><div className="flex items-center justify-between"><div className="eyebrow">{label}</div><div className="text-cyan">{icon}</div></div><div className={`${compact?"text-lg":"text-3xl"} mt-3 font-semibold`}>{value}</div></div>;
}
function MiniMetric({label,value}:{label:string;value:string|number}) {return <div className="rounded-lg border border-line bg-[#081626] p-3"><div className="text-[10px] uppercase tracking-wider text-muted">{label}</div><div className="mt-2 text-lg font-semibold text-cyan">{value}</div></div>}
function PageTitle({eyebrow,title,desc}:{eyebrow:string;title:string;desc:string}) {return <div><div className="eyebrow">{eyebrow}</div><h2 className="mt-2 text-2xl font-semibold">{title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{desc}</p></div>}
function RecordCard({r}:{r:Investigation}) {return <div className="rounded-xl border border-line bg-[#0b192a] p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] uppercase tracking-wider text-cyan">{r.domain}</div><h3 className="mt-1 font-semibold">{r.name}</h3></div><span className="rounded-md border border-line px-2 py-1 text-[10px] text-muted">{r.id}</span></div><p className="mt-3 text-xs leading-5 text-muted">{r.objective}</p><div className="mt-3 space-y-1 text-xs"><div><span className="text-muted">Subject: </span>{r.fuel_or_subject}</div><div><span className="text-muted">Hardware: </span>{r.hardware}</div></div><a href={r.source_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs text-cyan">NASA PSI source <ExternalLink size={12}/></a></div>}
