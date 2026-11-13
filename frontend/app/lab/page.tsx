"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, UploadCloud, FileText, Table2, Video, Calculator, CheckCircle2, AlertCircle, Loader2, Info } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { postFile, postJSON } from "@/lib/api";

type DatasetResult = { id:number; title:string; rows:number; columns:string[]; preview:Record<string,unknown>[]; note:string };
type Physics = { reynolds:number; grashof:number; prandtl:number; rayleigh:number; interpretation:string };
type VideoResult = { fps:number; total_frames:number; sampled_frames:number; frame_stride:number; series:{frame:number;time_s:number|null;candidate_area_px:number}[]; note:string };

function FilePicker({label,accept,file,onPick,hint}:{label:string;accept:string;file:File|null;onPick:(f:File|null)=>void;hint:string}) {
  return <label className="file-picker mt-4 block cursor-pointer rounded-xl border border-dashed border-slate-600 p-4 transition hover:border-cyan-400 hover:bg-cyan-400/5">
    <span className="flex items-center gap-2 text-sm font-medium text-slate-100"><UploadCloud size={17} className="text-cyan-300"/>{file ? file.name : label}</span>
    <span className="mt-1 block text-xs text-slate-400">{file ? `${(file.size/1024/1024).toFixed(2)} MB · Click to change` : hint}</span>
    <input className="sr-only" type="file" accept={accept} onChange={e=>onPick(e.target.files?.[0]??null)}/>
  </label>;
}

export default function LabPage() {
  const [csv,setCsv]=useState<File|null>(null), [doc,setDoc]=useState<File|null>(null), [video,setVideo]=useState<File|null>(null);
  const [dataset,setDataset]=useState<DatasetResult|null>(null), [docResult,setDocResult]=useState<Record<string,unknown>|null>(null), [videoResult,setVideoResult]=useState<VideoResult|null>(null);
  const [busy,setBusy]=useState(""), [error,setError]=useState(""), [success,setSuccess]=useState("");
  const [length,setLength]=useState("0.01"), [velocity,setVelocity]=useState("0.1"), [delta,setDelta]=useState("20"), [temp,setTemp]=useState("300");
  const [gravity,setGravity]=useState("9.81"), [nu,setNu]=useState("0.000015"), [alpha,setAlpha]=useState("0.000022"), [beta,setBeta]=useState("0.0033333333");
  const [physics,setPhysics]=useState<Physics|null>(null);
  const [stride,setStride]=useState("5");

  async function run(action:string,fn:()=>Promise<void>) {
    setBusy(action);setError("");setSuccess("");
    try { await fn(); } catch(e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(""); }
  }
  async function uploadCSV() {
    if(!csv)return;
    await run("csv",async()=>{const result=await postFile<DatasetResult>("/api/datasets/import",csv,{title:csv.name,provenance:"User-supplied file; units and provenance require validation"});setDataset(result);setSuccess("CSV metadata inspected successfully.");});
  }
  async function uploadDoc() {
    if(!doc)return;
    await run("doc",async()=>{const result=await postFile<Record<string,unknown>>("/api/documents/upload",doc,{source:doc.name});setDocResult(result);setSuccess("Document text extracted and indexed for retrieval.");});
  }
  async function analyzeVideo() {
    if(!video)return;
    await run("video",async()=>{const result=await postFile<VideoResult>("/api/cv/video/analyze",video,{frame_stride:stride});setVideoResult(result);setSuccess("Video sampling completed.");});
  }
  async function calculate() {
    await run("physics",async()=>{
      const values={length_m:Number(length),velocity_m_s:Number(velocity),delta_temp_k:Number(delta),temperature_k:Number(temp),gravity_m_s2:Number(gravity),nu_m2_s:Number(nu),alpha_m2_s:Number(alpha),beta_1_k:Number(beta)};
      if(Object.values(values).some(v=>!Number.isFinite(v)))throw new Error("Enter valid numeric values in every physics field.");
      setPhysics(await postJSON<Physics>("/api/physics/dimensionless",values));
    });
  }
  const results = useMemo(()=>physics ? [
    ["Reynolds",physics.reynolds],["Grashof",physics.grashof],["Prandtl",physics.prandtl],["Rayleigh",physics.rayleigh]
  ] as [string,number][] : [],[physics]);

  return <main className="min-h-screen px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl">
      <a href="/" className="inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200"><ArrowLeft size={16}/> Back to ASTRA-FIRE</a>
      <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><div className="eyebrow">ASTRA-FIRE 2.2 · Research workbench</div><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Data & physics workbench</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Bring experimental data and source documents into the prototype. Review metadata, provenance and limitations before scientific interpretation.</p></div>
        <div className="rounded-xl border border-cyan-900 bg-cyan-950/40 px-3 py-2 text-xs text-cyan-200">Local research prototype</div>
      </div>

      {error&&<div role="alert" className="mt-5 flex gap-2 rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-sm text-rose-200"><AlertCircle size={17} className="mt-0.5 shrink-0"/><span>{error}</span></div>}
      {success&&<div role="status" className="mt-5 flex gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-sm text-emerald-200"><CheckCircle2 size={17}/>{success}</div>}

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <section className="panel min-w-0 p-5 sm:p-6">
          <div className="flex items-center gap-3"><div className="rounded-lg bg-cyan-400/10 p-2 text-cyan-300"><Table2 size={19}/></div><div><h2 className="font-semibold">CSV dataset inspection</h2><p className="text-xs text-slate-400">Column names, row count and preview</p></div></div>
          <p className="mt-4 text-sm leading-6 text-slate-400">Inspect a CSV before analysis. Current import stores metadata and a small preview only; it does not retain the original measurement file or validate scientific units.</p>
          <FilePicker label="Choose a CSV file" accept=".csv,text/csv" file={csv} onPick={setCsv} hint="CSV · up to 30 MB"/>
          <button className="btn mt-4 w-full sm:w-auto" disabled={!csv||!!busy} onClick={uploadCSV}>{busy==="csv"?<><Loader2 className="mr-2 inline animate-spin" size={15}/>Inspecting…</>:"Inspect CSV"}</button>
          {dataset&&<div className="mt-5 space-y-3"><div className="flex items-center gap-2 text-sm font-medium text-emerald-300"><CheckCircle2 size={16}/> {dataset.rows} rows inspected</div><div className="flex flex-wrap gap-2">{dataset.columns.map(c=><span key={c} className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs text-slate-300">{c}</span>)}</div><div className="overflow-x-auto rounded-lg border border-slate-700"><table className="min-w-full text-left text-xs"><thead className="bg-slate-900 text-slate-300"><tr>{dataset.columns.map(c=><th key={c} className="px-3 py-2">{c}</th>)}</tr></thead><tbody>{dataset.preview.slice(0,6).map((r,i)=><tr key={i} className="border-t border-slate-800">{dataset.columns.map(c=><td key={c} className="max-w-48 truncate px-3 py-2 text-slate-400">{String(r[c]??"—")}</td>)}</tr>)}</tbody></table></div><p className="text-xs text-slate-500">{dataset.note}</p></div>}
        </section>

        <section className="panel min-w-0 p-5 sm:p-6">
          <div className="flex items-center gap-3"><div className="rounded-lg bg-cyan-400/10 p-2 text-cyan-300"><FileText size={19}/></div><div><h2 className="font-semibold">Research document ingestion</h2><p className="text-xs text-slate-400">PDF, TXT and Markdown sources</p></div></div>
          <p className="mt-4 text-sm leading-6 text-slate-400">Extract text from NASA publications, experiment notes and Markdown files. Indexed passages can be retrieved by the research assistant.</p>
          <FilePicker label="Choose a research document" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" file={doc} onPick={setDoc} hint="PDF, TXT or MD · up to 25 MB"/>
          <button className="btn mt-4 w-full sm:w-auto" disabled={!doc||!!busy} onClick={uploadDoc}>{busy==="doc"?<><Loader2 className="mr-2 inline animate-spin" size={15}/>Extracting…</>:"Extract and index"}</button>
          {docResult&&<pre className="mt-5 max-h-52 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs leading-5 text-slate-300">{JSON.stringify(docResult,null,2)}</pre>}
        </section>

        <section className="panel min-w-0 p-5 sm:p-6">
          <div className="flex items-center gap-3"><div className="rounded-lg bg-cyan-400/10 p-2 text-cyan-300"><Video size={19}/></div><div><h2 className="font-semibold">Video flame-trend analysis</h2><p className="text-xs text-slate-400">Frame sampling and candidate color regions</p></div></div>
          <p className="mt-4 text-sm leading-6 text-slate-400">Sample video frames and estimate the largest candidate flame-colored region per frame. This is a heuristic pixel-space measurement, not a validated flame detector.</p>
          <FilePicker label="Choose a video" accept="video/mp4,video/quicktime,video/x-msvideo,video/webm" file={video} onPick={setVideo} hint="MP4, MOV, AVI or WEBM · up to 100 MB"/>
          <div className="mt-3 max-w-xs"><label className="mb-1 block text-xs text-slate-400">Analyze every Nth frame</label><input className="field" type="number" min="1" max="120" value={stride} onChange={e=>setStride(e.target.value)}/></div>
          <button className="btn mt-4 w-full sm:w-auto" disabled={!video||!!busy} onClick={analyzeVideo}>{busy==="video"?<><Loader2 className="mr-2 inline animate-spin" size={15}/>Analyzing…</>:"Analyze video"}</button>
          {videoResult&&<div className="mt-5"><div className="grid grid-cols-3 gap-2"><Mini label="Sampled frames" value={videoResult.sampled_frames}/><Mini label="FPS" value={videoResult.fps.toFixed(2)}/><Mini label="Total frames" value={videoResult.total_frames}/></div><div className="mt-4 h-52 rounded-lg border border-slate-800 bg-slate-950/60 p-2"><ResponsiveContainer width="100%" height="100%"><LineChart data={videoResult.series}><CartesianGrid stroke="#24364a" strokeDasharray="3 3"/><XAxis dataKey="time_s" tick={{fill:"#94a3b8",fontSize:10}}/><YAxis tick={{fill:"#94a3b8",fontSize:10}}/><Tooltip contentStyle={{background:"#0b1727",border:"1px solid #334155"}}/><Line type="monotone" dataKey="candidate_area_px" stroke="#55d6e5" dot={false} name="Candidate area (px²)"/></LineChart></ResponsiveContainer></div><p className="mt-3 text-xs text-slate-500">{videoResult.note}</p></div>}
        </section>

        <section className="panel min-w-0 p-5 sm:p-6">
          <div className="flex items-center gap-3"><div className="rounded-lg bg-cyan-400/10 p-2 text-cyan-300"><Calculator size={19}/></div><div><h2 className="font-semibold">Dimensionless number calculator</h2><p className="text-xs text-slate-400">Editable fluid and flow inputs</p></div></div>
          <p className="mt-4 text-sm leading-6 text-slate-400">Calculate Reynolds, Grashof, Prandtl and Rayleigh numbers. Supply properties for the fluid and conditions being studied.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <NumberField label="Characteristic length (m)" value={length} set={setLength}/>
            <NumberField label="Flow velocity (m/s)" value={velocity} set={setVelocity}/>
            <NumberField label="Temperature difference (K)" value={delta} set={setDelta}/>
            <NumberField label="Film temperature (K)" value={temp} set={setTemp}/>
            <NumberField label="Gravity (m/s²)" value={gravity} set={setGravity}/>
            <NumberField label="Kinematic viscosity ν (m²/s)" value={nu} set={setNu}/>
            <NumberField label="Thermal diffusivity α (m²/s)" value={alpha} set={setAlpha}/>
            <NumberField label="Expansion coefficient β (1/K)" value={beta} set={setBeta}/>
          </div>
          <button className="btn mt-4 w-full sm:w-auto" disabled={!!busy} onClick={calculate}>{busy==="physics"?<><Loader2 className="mr-2 inline animate-spin" size={15}/>Calculating…</>:"Calculate dimensionless numbers"}</button>
          {physics&&<div className="mt-5 grid grid-cols-2 gap-2">{results.map(([name,value])=><Mini key={name} label={name} value={value.toExponential(3)}/>)}</div>}
          {physics&&<p className="mt-3 text-xs leading-5 text-amber-200/80">{physics.interpretation}</p>}
        </section>
      </div>

      <div className="mt-6 flex gap-2 rounded-xl border border-amber-500/20 bg-amber-950/20 p-4 text-xs leading-5 text-amber-100/80"><Info size={17} className="mt-0.5 shrink-0"/><p>Scientific caution: dimensionless numbers depend on valid fluid properties and characteristic scales. Video segmentation is sensitive to lighting and camera settings. Uploaded records are research aids, not certified fire-safety predictions.</p></div>
      <p className="mt-6 text-xs leading-5 text-slate-500">Data handling: uploaded document text and dataset metadata are stored in the configured local database. CSV raw files are not retained. Verify third-party data-use terms before uploading NASA or other source material.</p>
    </div>
  </main>;
}

function NumberField({label,value,set}:{label:string;value:string;set:(v:string)=>void}) {
  return <label className="block min-w-0"><span className="mb-1 block text-[11px] leading-4 text-slate-400">{label}</span><input className="field" type="number" step="any" value={value} onChange={e=>set(e.target.value)}/></label>;
}
function Mini({label,value}:{label:string;value:string|number}) {
  return <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"><div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div><div className="mt-2 break-words text-lg font-semibold text-cyan-200">{value}</div></div>;
}
