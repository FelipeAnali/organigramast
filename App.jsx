import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";

/* ─── Paleta ─── */
const PAL = [
  { bg:"#EFF6FF", border:"#3B82F6", text:"#1E40AF", dot:"#3B82F6" },
  { bg:"#F0FDF4", border:"#22C55E", text:"#15803D", dot:"#22C55E" },
  { bg:"#FDF4FF", border:"#A855F7", text:"#7E22CE", dot:"#A855F7" },
  { bg:"#FFF7ED", border:"#F97316", text:"#C2410C", dot:"#F97316" },
  { bg:"#FFF1F2", border:"#F43F5E", text:"#BE123C", dot:"#F43F5E" },
  { bg:"#F0FDFA", border:"#14B8A6", text:"#0F766E", dot:"#14B8A6" },
  { bg:"#FEFCE8", border:"#EAB308", text:"#854D0E", dot:"#EAB308" },
  { bg:"#F1F5F9", border:"#64748B", text:"#334155", dot:"#64748B" },
];
/* Paletas para grupos (más sólidas) */
const GPAL = [
  { bg:"#1E40AF", border:"#1E3A8A", text:"#ffffff" },
  { bg:"#15803D", border:"#14532D", text:"#ffffff" },
  { bg:"#7E22CE", border:"#581C87", text:"#ffffff" },
  { bg:"#C2410C", border:"#9A3412", text:"#ffffff" },
  { bg:"#BE123C", border:"#9F1239", text:"#ffffff" },
  { bg:"#0F766E", border:"#134E4A", text:"#ffffff" },
  { bg:"#854D0E", border:"#713F12", text:"#ffffff" },
  { bg:"#334155", border:"#1E293B", text:"#ffffff" },
];

const NW=180, NH=168, NHG=52, GX=22, GY=40;
const FOTO_SZ=84;
const NHC=36; // v7: altura nodo compacto (modo lista)
const GYC=6;  // v7: gap vertical entre nodos compactos apilados

function buildLayout(nodes, compactSet){
  compactSet = compactSet || new Set();
  if(!nodes.length) return {pos:{},W:600,H:300};
  const byId=Object.fromEntries(nodes.map(n=>[n.id,n]));
  const ch=Object.fromEntries(nodes.map(n=>[n.id,[]]));
  const roots=[];
  nodes.forEach(n=>{ if(n.parentId&&byId[n.parentId]) ch[n.parentId].push(n.id); else roots.push(n.id); });

  /* ¿este nodo está bajo un ancestro compactado? */
  const compactAncestor={};
  const findCompactAnc=id=>{
    if(compactAncestor[id]!==undefined) return compactAncestor[id];
    const n=byId[id];
    if(!n) return compactAncestor[id]=null;
    if(!n.parentId) return compactAncestor[id]=null;
    if(compactSet.has(n.parentId)) return compactAncestor[id]=n.parentId;
    return compactAncestor[id]=findCompactAnc(n.parentId);
  };
  nodes.forEach(n=>findCompactAnc(n.id));

  const isCompact=id=>compactAncestor[id]!==null;
  const nodeHeight=id=>{
    if(isCompact(id)) return NHC;
    return byId[id]?.tipo==="grupo"?NHG:NH;
  };

  const memo={};
  /* ancho del subárbol */
  const sw=id=>{
    if(memo[id]!==undefined) return memo[id];
    const c=ch[id]||[];
    /* Si este nodo está en compactSet, todos sus hijos se apilan verticalmente: ancho = NW+GX */
    if(compactSet.has(id) && c.length){
      return memo[id]=NW+GX;
    }
    /* Si este nodo ya está en modo compacto heredado, ocupa ancho de uno */
    if(isCompact(id)) return memo[id]=NW+GX;
    return memo[id]=c.length ? Math.max(NW+GX, c.reduce((s,x)=>s+sw(x),0)) : NW+GX;
  };
  const pos={};
  const place=(id,lx,y)=>{
    const h=nodeHeight(id);
    const s=sw(id); pos[id]={x:lx+(s-NW)/2,y,h,compact:isCompact(id)};
    const kids=ch[id]||[];
    if(!kids.length) return;
    if(compactSet.has(id)){
      /* apilar hijos verticalmente, centrados horizontalmente */
      let cy=y+h+GY;
      kids.forEach(c=>{
        place(c, lx+(s-NW)/2, cy);
        cy+=NHC+GYC;
      });
    } else {
      let cx=lx;
      kids.forEach(c=>{place(c,cx,y+h+GY);cx+=sw(c);});
    }
  };
  let rx=GX; roots.forEach(r=>{place(r,rx,GY);rx+=sw(r)+GX;});
  const xs=Object.values(pos).map(p=>p.x), ys=Object.values(pos).map(p=>p.y);
  const mnx=Math.min(...xs)-GX, mny=Math.min(...ys)-GY;
  Object.keys(pos).forEach(id=>{pos[id].x-=mnx; pos[id].y-=mny;});
  const W=Math.max(...Object.values(pos).map(p=>p.x))+NW+GX;
  const H=Math.max(...Object.values(pos).map(p=>p.y+p.h))+GY;
  return {pos,W,H};
}

const ini=n=>(n||"").split(" ").map(w=>w[0]).filter(Boolean).slice(0,2).join("").toUpperCase()||"?";
const trunc=(s="",mx=22)=>s.length>mx?s.slice(0,mx-1)+"…":s;
const hasVal=v=>{ if(v===null||v===undefined)return false; const s=String(v).trim(); return s!==""&&s.toLowerCase()!=="nat"&&s!=="undefined"&&s!=="null"; };

const VCOLS={
  nombre:["nombre del empleado","nombre","name","employee name"],
  cargo: ["descripcion del cargo","cargo","position","puesto","job title"],
  area:  ["descripcion c.o.","descripcion co","area","sede","location"],
  dept:  ["descripcion ccosto","departamento","department","dept","ccosto"],
  id:    ["codigo unico","id","employee id","codigo"],
  fechaRetiro:["fecha retiro","fecha de retiro","fecha_retiro","end date","termination date"],
};
function detectCols(headers){
  const cl=h=>h.toLowerCase().replace(/[^a-záéíóúñ\s.]/g,"").trim();
  const res={};
  Object.entries(VCOLS).forEach(([key,vs])=>{ const f=headers.find(h=>vs.some(v=>cl(h).includes(cl(v)))); if(f)res[key]=f; });
  return res;
}

const CSS=`
  *{box-sizing:border-box}
  .btn{padding:5px 13px;border-radius:8px;border:1px solid #CBD5E1;background:#fff;cursor:pointer;font-size:13px;color:#334155;transition:background .15s;white-space:nowrap;font-family:inherit}
  .btn:hover{background:#F1F5F9}
  .btn.p{background:#3B82F6;color:#fff;border-color:#3B82F6}
  .btn.p:hover{background:#2563EB}
  .btn.g{background:#22C55E;color:#fff;border-color:#22C55E}
  .btn.g:hover{background:#16A34A}
  .btn.o{background:#F97316;color:#fff;border-color:#F97316}
  .btn.o:hover{background:#EA580C}
  .btn.d{color:#DC2626;border-color:#FCA5A5}
  .btn.d:hover{background:#FEF2F2}
  .btn:disabled{opacity:.4;cursor:not-allowed}
  .inp{padding:7px 11px;border:1px solid #CBD5E1;border-radius:8px;font-size:13px;width:100%;background:#fff;color:#0F172A;outline:none;font-family:inherit}
  .inp:focus{border-color:#3B82F6;box-shadow:0 0 0 2px #DBEAFE}
  select.inp{background:#fff}
  .rrow{display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid #F1F5F9;cursor:pointer;transition:background .12s}
  .rrow:hover{background:#F8FAFC}
  .rrow.added{background:#F0FDF4}
  .on{position:absolute;cursor:pointer}
  .zb{width:30px;height:30px;border-radius:8px;border:1px solid #CBD5E1;background:#fff;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;color:#334155;font-family:inherit}
  .zb:hover{background:#F1F5F9}
  .tab{padding:7px 14px;border-radius:8px;border:1px solid #E2E8F0;background:transparent;cursor:pointer;font-size:13px;color:#64748B;font-family:inherit}
  .tab.active{background:#3B82F6;color:#fff;border-color:#3B82F6}
  .dot-unsaved{width:8px;height:8px;border-radius:50%;background:#F97316;animation:pulse 1.5s infinite;display:inline-block}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  .modal-bg{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px}
  .modal{background:#fff;border-radius:14px;max-width:720px;width:100%;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.25)}
  .diff-field{display:grid;grid-template-columns:80px 1fr 1fr 18px;gap:8px;align-items:center;padding:3px 0;font-size:12px}
`;

export default function App(){
  const [roster,  setRoster]  = useState([]);
  const [nodes,   setNodes]   = useState([]);
  const [panel,   setPanel]   = useState(null);
  const [sel,     setSel]     = useState(null);
  const [addTab,  setAddTab]  = useState("persona"); // "persona"|"grupo"

  /* import */
  const [impRows, setImpRows] = useState([]);
  const [impHdrs, setImpHdrs] = useState([]);
  const [colMap,  setColMap]  = useState({});
  const [impFile, setImpFile] = useState("");
  const [filterOn,setFilterOn]= useState(true);

  /* búsqueda roster */
  const [rosterQ, setRosterQ] = useState("");
  /* v7: filtros multi-select (arrays en vez de strings) */
  const [rosterFilters, setRosterFilters] = useState({sede:[],cargo:[],dept:[]});

  /* form nuevo grupo */
  const [grpForm, setGrpForm] = useState({nombre:"",colorIdx:0,parentId:"",source:"manual",sourceCol:"area",sourceVal:""});

  /* edit panel */
  const [editId,   setEditId]   = useState(null);
  const [editPId,  setEditPId]  = useState("");
  const [editFoto, setEditFoto] = useState("");
  const [bossQ,    setBossQ]    = useState("");

  /* quick-add connection */
  const [quickAdd, setQuickAdd] = useState(null); // {person, parentId:"", q:""}

  /* ── v7: modo compacto (lista) por nodo. Set con IDs cuyos DESCENDIENTES se renderizan compactos ── */
  const [compactSet, setCompactSet] = useState(() => new Set());

  /* ── v7: modo "asignar jefe visual" — cuando está activo, el próximo clic en un nodo del canvas
     define el nuevo jefe de assignBossFor ── */
  const [assignBossFor, setAssignBossFor] = useState(null); // id de la persona a la que le estamos buscando jefe

  /* ── v5: memoria portable (sin localStorage) ── */
  const [dirty, setDirty] = useState(false);
  const [memFileName, setMemFileName] = useState("");
  const memRef = useRef(null);

  /* ── v5: edición extendida (datos adicionales, además de jefe+foto) ── */
  const [editNombre, setEditNombre] = useState("");
  const [editCargo,  setEditCargo]  = useState("");
  const [editArea,   setEditArea]   = useState("");
  const [editDept,   setEditDept]   = useState("");
  const [editEmail,  setEditEmail]  = useState("");

  /* ── v5: reimport con diff ── */
  const [impMode, setImpMode] = useState("initial"); // "initial" | "reimport"
  const [conflicts, setConflicts] = useState([]);


  /* ── Cargar libs PDF dinámicamente ── */
  useEffect(()=>{
    const load=src=>{ if(document.querySelector(`script[src="${src}"]`))return; const s=document.createElement("script"); s.src=src; document.head.appendChild(s); };
    load("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
    load("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  },[]);
  const [pdfLoading, setPdfLoading] = useState(false);

  /* ── v5: marcar dirty cuando roster/nodes cambian (tras el primer render) ── */
  const firstRender = useRef(true);
  const suppressDirty = useRef(0); // contador: bloquea N efectos consecutivos
  useEffect(()=>{
    if(firstRender.current){ firstRender.current=false; return; }
    if(suppressDirty.current>0){ suppressDirty.current--; return; }
    if(roster.length>0 || nodes.length>0) setDirty(true);
  },[roster,nodes]);

  /* ── v5: advertencia al salir con cambios sin guardar ── */
  useEffect(()=>{
    const h=e=>{ if(!dirty) return; e.preventDefault(); e.returnValue="Tienes cambios sin guardar. Descarga la memoria portable antes de salir."; return e.returnValue; };
    window.addEventListener("beforeunload",h);
    return()=>window.removeEventListener("beforeunload",h);
  },[dirty]);

  const canvasRef  = useRef(null);
  const chartRef   = useRef(null);
  const fileRef    = useRef(null);
  const fotoRef    = useRef(null);

  const [vp, setVp] = useState({x:60,y:60,s:1});
  const [drag,setDrag]=useState(false);
  const [ds,  setDs]  =useState({x:0,y:0});

  /* colores */
  const areaIdx=useMemo(()=>{
    const areas=[...new Set(nodes.filter(n=>n.tipo==="persona").map(n=>n.area).filter(Boolean))];
    return Object.fromEntries(areas.map((a,i)=>[a,i%PAL.length]));
  },[nodes]);
  const col =a=>PAL[areaIdx[a]??7];
  const gcol=i=>GPAL[i%GPAL.length];

  /* valores únicos para filtros y grupos desde maestro */
  const uniqueSedes=useMemo(()=>[...new Set(roster.map(r=>r.area).filter(Boolean))].sort(),[roster]);
  const uniqueCargos=useMemo(()=>[...new Set(roster.map(r=>r.cargo).filter(Boolean))].sort(),[roster]);
  const uniqueDepts=useMemo(()=>[...new Set(roster.map(r=>r.dept).filter(Boolean))].sort(),[roster]);
  const sourceColValues=useMemo(()=>{
    if(grpForm.sourceCol==="area") return uniqueSedes;
    if(grpForm.sourceCol==="cargo") return uniqueCargos;
    if(grpForm.sourceCol==="dept") return uniqueDepts;
    return [];
  },[grpForm.sourceCol,uniqueSedes,uniqueCargos,uniqueDepts]);


  const {pos,W,H}=useMemo(()=>buildLayout(nodes,compactSet),[nodes,compactSet]);
  const inChart=useMemo(()=>new Set(nodes.map(n=>n.id)),[nodes]);

  const rosterFiltered=useMemo(()=>{
    let r=roster;
    if(rosterFilters.sede.length>0) r=r.filter(x=>rosterFilters.sede.includes(x.area));
    if(rosterFilters.cargo.length>0) r=r.filter(x=>rosterFilters.cargo.includes(x.cargo));
    if(rosterFilters.dept.length>0) r=r.filter(x=>rosterFilters.dept.includes(x.dept));
    if(!rosterQ.trim()) return r.slice(0,80);
    const q=rosterQ.toLowerCase();
    return r.filter(r=>[r.nombre,r.cargo,r.area,r.dept].some(v=>(v||"").toLowerCase().includes(q))).slice(0,80);
  },[roster,rosterQ,rosterFilters]);

  /* v7: helper para toggle multi-filtro */
  const toggleFilter=(grupo,valor)=>{
    setRosterFilters(f=>{
      const arr=f[grupo]||[];
      const nuevo=arr.includes(valor)?arr.filter(x=>x!==valor):[...arr,valor];
      return {...f,[grupo]:nuevo};
    });
  };
  const filtersActivos=rosterFilters.sede.length+rosterFilters.cargo.length+rosterFilters.dept.length;


  const prevCount=useMemo(()=>{
    const total=impRows.length;
    if(!colMap.fechaRetiro||!filterOn) return{total,activos:total,excl:0};
    const activos=impRows.filter(r=>!hasVal(r[colMap.fechaRetiro])).length;
    return{total,activos,excl:total-activos};
  },[impRows,colMap,filterOn]);

  /* ── Leer archivo ── */
  const readFile=e=>{
    const f=e.target.files?.[0]; if(!f)return;
    setImpFile(f.name);
    setImpMode(roster.length>0?"reimport":"initial"); // v5: modo según si ya hay roster
    const r=new FileReader();
    r.onload=ev=>{
      let rows=[],headers=[];
      if(f.name.match(/\.(csv|txt)$/i)){
        const lines=ev.target.result.split("\n").filter(l=>l.trim());
        headers=lines[0].split(",").map(h=>h.trim().replace(/^"|"$/g,""));
        rows=lines.slice(1).map(l=>{const vs=l.split(",").map(v=>v.trim().replace(/^"|"$/g,""));return Object.fromEntries(headers.map((h,i)=>[h,vs[i]||""]));}).filter(r=>Object.values(r).some(v=>v));
      } else {
        const wb=XLSX.read(ev.target.result,{type:"array"});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const data=XLSX.utils.sheet_to_json(ws,{defval:""});
        if(data.length){headers=Object.keys(data[0]);rows=data;}
      }
      setImpHdrs(headers); setImpRows(rows);
      const det=detectCols(headers);
      setColMap(det); setFilterOn(!!det.fechaRetiro);
      setPanel("colmap");
    };
    if(f.name.match(/\.(csv|txt)$/i)) r.readAsText(f); else r.readAsArrayBuffer(f);
    e.target.value="";
  };

  const applyImport=()=>{
    const get=(row,k)=>colMap[k]?(row[colMap[k]]||"").toString().trim():"";
    let rows=impRows;
    if(filterOn&&colMap.fechaRetiro) rows=rows.filter(r=>!hasVal(r[colMap.fechaRetiro]));
    const newRoster=rows.map((row,i)=>{
      const nombre=get(row,"nombre"); if(!nombre)return null;
      const emailRaw=row["Email del contacto"]||row["Email"]||row["email"]||"";
      return{id:get(row,"id")||`r${i}_${Date.now()}`,nombre,cargo:get(row,"cargo"),area:get(row,"area"),dept:get(row,"dept"),email:String(emailRaw).trim(),foto:"",tipo:"persona"};
    }).filter(Boolean);

    /* Primera vez: comportamiento IDÉNTICO a v3 */
    if(impMode==="initial"){
      suppressDirty.current=1; // primer import no debe marcar dirty
      setRoster(newRoster); setNodes([]); setSel(null);
      setImpRows([]); setImpHdrs([]);
      setPanel("add"); setAddTab("persona");
      return;
    }

    /* Reimport: calcular conflictos vs roster actual */
    const newById=Object.fromEntries(newRoster.map(r=>[r.id,r]));
    const conf=[];
    const mergedRoster=[];
    const seenIds=new Set();
    const fields=["nombre","cargo","area","dept","email"];

    roster.forEach(old=>{
      const nw=newById[old.id];
      seenIds.add(old.id);
      if(!nw){ mergedRoster.push(old); return; }
      const diffs={};
      fields.forEach(f=>{
        const a=(old[f]||"").toString().trim();
        const b=(nw[f]||"").toString().trim();
        if(a!==b) diffs[f]={old:a,nuevo:b};
      });
      if(Object.keys(diffs).length===0){ mergedRoster.push(old); return; }
      conf.push({id:old.id,nombre:old.nombre,enChart:inChart.has(old.id),diffs,resolucion:{}});
      mergedRoster.push(old); // dejamos lo viejo, se ajustará al aplicar resoluciones
    });
    newRoster.forEach(nw=>{ if(!seenIds.has(nw.id)) mergedRoster.push(nw); });

    const nuevos=mergedRoster.length-roster.length;
    setRoster(mergedRoster);
    setImpRows([]); setImpHdrs([]);

    if(conf.length===0){
      setPanel(null);
      alert(`Maestro actualizado. ${newRoster.length} registros procesados. ${nuevos>0?nuevos+" empleados nuevos agregados al roster. ":""}Sin conflictos.`);
    } else {
      setConflicts(conf);
      setPanel("diff");
    }
  };

  /* ── v5: resolución de conflictos ── */
  const resolveConflict=(idx,field,choice)=>{
    setConflicts(c=>c.map((x,i)=>i!==idx?x:{...x,resolucion:{...x.resolucion,[field]:choice}}));
  };
  const resolveAll=choice=>{
    setConflicts(c=>c.map(x=>{ const res={}; Object.keys(x.diffs).forEach(f=>res[f]=choice); return{...x,resolucion:res}; }));
  };
  const applyResolutions=()=>{
    const ajustes={};
    conflicts.forEach(c=>{
      const cambios={};
      Object.entries(c.diffs).forEach(([f,{old,nuevo}])=>{
        const choice=c.resolucion[f]||"old"; // por defecto mantener lo del usuario
        cambios[f]= choice==="nuevo"?nuevo:old;
      });
      ajustes[c.id]=cambios;
    });
    setRoster(r=>r.map(x=>ajustes[x.id]?{...x,...ajustes[x.id]}:x));
    setNodes(n=>n.map(x=>ajustes[x.id]?{...x,...ajustes[x.id]}:x));
    setConflicts([]); setPanel(null);
  };

  /* ── Agregar persona al chart ── */
  const addPersona=r=>{
    if(inChart.has(r.id))return;
    if(nodes.length===0){ setNodes(p=>[...p,{...r,parentId:"",tipo:"persona"}]); return; }
    setQuickAdd({person:r,parentId:"",q:""});
  };
  const confirmQuickAdd=()=>{
    if(!quickAdd)return;
    setNodes(p=>[...p,{...quickAdd.person,parentId:quickAdd.parentId,tipo:"persona"}]);
    setQuickAdd(null);
  };

  /* ── Agregar grupo ── */
  const addGrupo=()=>{
    const nombre=grpForm.source==="columna"?grpForm.sourceVal:grpForm.nombre;
    if(!nombre.trim())return;
    setNodes(p=>[...p,{id:`g${Date.now()}`,nombre,colorIdx:grpForm.colorIdx,parentId:grpForm.parentId,tipo:"grupo",...(grpForm.source==="columna"?{sourceCol:grpForm.sourceCol,sourceVal:nombre}:{})}]);
    setGrpForm({nombre:"",colorIdx:0,parentId:"",source:"manual",sourceCol:"area",sourceVal:""});
  };

  /* ── Editar (jefe + foto + datos extendidos v5) ── */
  const openEdit=n=>{
    setEditId(n.id); setEditPId(n.parentId||""); setEditFoto(n.foto||""); setBossQ("");
    setEditNombre(n.nombre||""); setEditCargo(n.cargo||""); setEditArea(n.area||""); setEditDept(n.dept||""); setEditEmail(n.email||"");
    setPanel("edit");
  };
  const saveEdit=()=>{
    setNodes(p=>p.map(n=>{
      if(n.id!==editId) return n;
      if(n.tipo==="grupo") return {...n,parentId:editPId};
      return {...n,parentId:editPId,foto:editFoto,nombre:editNombre,cargo:editCargo,area:editArea,dept:editDept,email:editEmail};
    }));
    /* también sincronizamos en roster si existe para que al agregar otra persona queden datos consistentes */
    setRoster(r=>r.map(x=>x.id===editId?{...x,nombre:editNombre,cargo:editCargo,area:editArea,dept:editDept,email:editEmail,foto:editFoto}:x));
    setPanel(null); setSel(null); setEditId(null);
  };
  const delNode=id=>{ setNodes(p=>p.filter(n=>n.id!==id).map(n=>n.parentId===id?{...n,parentId:""}:n)); setSel(null); setPanel(null); setEditId(null); };
  const uploadFoto=e=>{ const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=ev=>setEditFoto(ev.target.result); r.readAsDataURL(f); };

  /* ── Boss search combinado (roster + nodos grupo) ── */
  const bossResults=useMemo(()=>{
    if(!bossQ.trim()) return [];
    const q=bossQ.toLowerCase();
    const fromRoster=roster.filter(r=>r.id!==editId&&[r.nombre,r.cargo,r.area].some(v=>(v||"").toLowerCase().includes(q))).slice(0,20).map(r=>({...r,enChart:inChart.has(r.id)}));
    const fromGroups=nodes.filter(n=>n.tipo==="grupo"&&n.id!==editId&&(n.nombre||"").toLowerCase().includes(q)).map(n=>({...n,enChart:true,cargo:"Grupo / Sede"}));
    return [...fromGroups,...fromRoster].slice(0,25);
  },[bossQ,roster,nodes,editId,inChart]);

  /* ── Quick-add boss search ── */
  const quickBossResults=useMemo(()=>{
    const q=(quickAdd?.q||"").toLowerCase().trim();
    if(!q) return nodes.slice(0,20).map(n=>({...n,enChart:true,cargo:n.tipo==="grupo"?"Grupo / Sede":n.cargo}));
    return nodes.filter(n=>(n.nombre||"").toLowerCase().includes(q)||(n.cargo||"").toLowerCase().includes(q)).slice(0,20).map(n=>({...n,enChart:true,cargo:n.tipo==="grupo"?"Grupo / Sede":n.cargo}));
  },[quickAdd?.q,nodes]);

  /* ── Export / Import JSON ── */
  const exportJSON=()=>{
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([JSON.stringify({roster,nodes},null,2)],{type:"application/json"}));
    a.download=`organigrama_${new Date().toISOString().slice(0,10)}.json`; a.click();
  };
  const importJSON=e=>{
    const f=e.target.files?.[0]; if(!f)return;
    const r=new FileReader();
    r.onload=ev=>{ try{ const d=JSON.parse(ev.target.result); if(d.nodes)setNodes(d.nodes); if(d.roster)setRoster(d.roster); }catch{} };
    r.readAsText(f); e.target.value="";
  };

  /* ── v5: Memoria portable (.orgmem) ── */
  const MEM_MAGIC="CANAVERAL_ORGMEM";
  const saveMem=()=>{
    try{
      const mem={_magic:MEM_MAGIC,_version:1,_savedAt:new Date().toISOString(),roster,nodes};
      const json=JSON.stringify(mem);
      const blob=new Blob([json],{type:"application/octet-stream"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;
      const d=new Date(), fecha=d.toISOString().slice(0,10), hora=d.toTimeString().slice(0,5).replace(":","");
      a.download=`organigrama_canaveral_${fecha}_${hora}.orgmem`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      setDirty(false);
      setMemFileName(a.download);
    }catch(err){
      console.error(err);
      alert("Error al guardar memoria: "+err.message);
    }
  };
  const loadMem=e=>{
    const f=e.target.files?.[0]; if(!f)return;
    if(dirty && !confirm("Tienes cambios sin guardar que se perderán. ¿Continuar?")){ e.target.value=""; return; }
    const r=new FileReader();
    r.onload=ev=>{
      try{
        const mem=JSON.parse(ev.target.result);
        if(mem._magic!==MEM_MAGIC && !(mem.roster||mem.nodes)) throw new Error("Archivo no válido");
        suppressDirty.current=1; // roster + nodes se batchean en React 18, 1 efecto
        if(Array.isArray(mem.roster)) setRoster(mem.roster); else setRoster([]);
        if(Array.isArray(mem.nodes))  setNodes(mem.nodes); else setNodes([]);
        setMemFileName(f.name);
        setDirty(false);
        setSel(null);
        setPanel(null);
        setTimeout(()=>{
          const fecha=mem._savedAt?new Date(mem._savedAt).toLocaleString("es-CO"):"";
          alert(`Memoria cargada: ${f.name}${fecha?"\nGuardada: "+fecha:""}\n${mem.roster?.length||0} en roster · ${mem.nodes?.length||0} en chart`);
        },100);
      }catch(err){ alert("No se pudo cargar la memoria: "+err.message); }
    };
    r.readAsText(f);
    e.target.value="";
  };

  /* ── v7: toggle modo compacto para los hijos de un nodo ── */
  const toggleCompact=(id)=>{
    setCompactSet(s=>{
      const nu=new Set(s);
      if(nu.has(id)) nu.delete(id); else nu.add(id);
      return nu;
    });
  };

  /* ── v7: validar que un candidato a jefe no sea descendiente (evita ciclos) ── */
  const esDescendiente=(candidatoId, ancestroId)=>{
    /* ¿candidato es descendiente de ancestro? */
    const visitados=new Set();
    let cur=nodes.find(n=>n.id===candidatoId);
    while(cur?.parentId && !visitados.has(cur.id)){
      visitados.add(cur.id);
      if(cur.parentId===ancestroId) return true;
      cur=nodes.find(n=>n.id===cur.parentId);
    }
    return false;
  };

  /* ── v7: cuando está activo assignBossFor y el usuario clickea un nodo, ese es el nuevo jefe ── */
  const onAssignBossClick=(targetId)=>{
    if(!assignBossFor) return false;
    if(targetId===assignBossFor){ setAssignBossFor(null); return true; }
    if(esDescendiente(targetId,assignBossFor)){
      alert("No puedes elegir un subordinado como jefe (crearía un ciclo)");
      return true;
    }
    setNodes(p=>p.map(n=>n.id===assignBossFor?{...n,parentId:targetId}:n));
    setAssignBossFor(null);
    return true;
  };
  /* cancelar con Escape */
  useEffect(()=>{
    if(!assignBossFor) return;
    const h=e=>{ if(e.key==="Escape") setAssignBossFor(null); };
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[assignBossFor]);

  /* ── PDF via html2canvas ── */
  const exportPDF=useCallback(async()=>{
    if(!chartRef.current||pdfLoading)return;
    if(!nodes.length){ alert("No hay nada que exportar"); return; }
    setPdfLoading(true);
    /* Guardamos viewport actual y estilo del chartRef para restaurar al final */
    const prevVp={...vp};
    const el=chartRef.current;
    const prevStyle={
      position:el.style.position,
      inset:el.style.inset,
      width:el.style.width,
      height:el.style.height,
      overflow:el.style.overflow,
    };
    try{
      const h2c=window.html2canvas;
      const jsPDF=window.jspdf?.jsPDF;
      if(!h2c||!jsPDF){setPdfLoading(false);alert("Librerías PDF cargando, intenta en 2 segundos.");return;}

      /* Resetear viewport para que los nodos queden en (p.x, p.y) sin offset */
      setVp({x:0,y:0,s:1});
      /* Esperar a que React renderice con el nuevo viewport */
      await new Promise(r=>setTimeout(r,200));

      /* Expandir temporalmente el chartRef para que h2c vea todo el contenido absolute-positioned */
      el.style.position="absolute";
      el.style.inset="auto";
      el.style.left="0";
      el.style.top="0";
      el.style.width=W+"px";
      el.style.height=H+"px";
      el.style.overflow="visible";

      await new Promise(r=>setTimeout(r,50));

      const canvas=await h2c(el,{
        scale:2,
        backgroundColor:"#F8FAFC",
        useCORS:true,
        logging:false,
        width:W,
        height:H,
        windowWidth:W,
        windowHeight:H,
      });
      const imgData=canvas.toDataURL("image/png");
      const w2=canvas.width/2, h2=canvas.height/2;
      const pdf=new jsPDF({orientation: w2>h2?"landscape":"portrait",unit:"px",format:[w2,h2]});
      pdf.addImage(imgData,"PNG",0,0,w2,h2);
      pdf.save(`organigrama_${new Date().toISOString().slice(0,10)}.pdf`);
    }catch(err){console.error(err);alert("Error al generar PDF: "+err.message);}
    /* Restaurar estilo del chartRef */
    Object.entries(prevStyle).forEach(([k,v])=>{ el.style[k]=v||""; });
    el.style.left=""; el.style.top="";
    /* Restaurar viewport */
    setVp(prevVp);
    setPdfLoading(false);
  },[pdfLoading,nodes.length,W,H,vp]);

  /* ── Canvas drag/zoom ── */
  const onWheel=useCallback(e=>{ e.preventDefault(); setVp(v=>({...v,s:Math.min(3,Math.max(0.08,v.s*(e.deltaY<0?1.1:0.9)))})); },[]);
  useEffect(()=>{ const el=canvasRef.current; if(!el)return; el.addEventListener("wheel",onWheel,{passive:false}); return()=>el.removeEventListener("wheel",onWheel); },[onWheel]);
  const onMD=e=>{ if(e.target.closest(".on"))return; setDrag(true); setDs({x:e.clientX-vp.x,y:e.clientY-vp.y}); };
  const onMM=e=>{ if(drag) setVp(v=>({...v,x:e.clientX-ds.x,y:e.clientY-ds.y})); };
  const onMU=()=>setDrag(false);

  /* ── Aristas ── */
  const edges=useMemo(()=>nodes.filter(n=>n.parentId&&pos[n.id]&&pos[n.parentId]).map(n=>{
    const p=pos[n.parentId],c=pos[n.id];
    const ph=p.h||NH, ch2=c.h||NH;
    const x1=p.x+NW/2, y1=p.y+ph, x2=c.x+NW/2, y2=c.y, my=(y1+y2)/2;
    const active=sel===n.id||sel===n.parentId;
    return{key:n.id,d:`M${x1} ${y1}C${x1} ${my} ${x2} ${my} ${x2} ${y2}`,active};
  }),[nodes,pos,sel]);

  const selNode=nodes.find(n=>n.id===sel);
  const editNode=nodes.find(n=>n.id===editId);

  return(
    <div style={{display:"flex",flexDirection:"column",height:660,fontFamily:"system-ui,-apple-system,sans-serif",background:"#F8FAFC",overflow:"hidden"}}>
      <style>{CSS}</style>

      {/* v7: Banner modo asignar jefe */}
      {assignBossFor && (()=>{
        const origen=nodes.find(x=>x.id===assignBossFor);
        return(
          <div style={{background:"#FEF3C7",borderBottom:"2px solid #F59E0B",padding:"8px 14px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            <span style={{fontSize:18}}>🔗</span>
            <div style={{flex:1,fontSize:13,color:"#78350F"}}>
              <strong>Asignar jefe a:</strong> {origen?.nombre||"—"} · Haz clic en el nodo que será su nuevo jefe, o presiona <kbd style={{padding:"1px 6px",background:"#fff",border:"1px solid #D97706",borderRadius:4,fontSize:11,fontFamily:"monospace"}}>Esc</kbd> para cancelar
            </div>
            <button className="btn" style={{fontSize:12}} onClick={()=>setAssignBossFor(null)}>Cancelar</button>
          </div>
        );
      })()}

      {/* ── Toolbar ── */}
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",background:"#fff",borderBottom:"1px solid #E2E8F0",flexShrink:0,flexWrap:"wrap"}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="8" y="2" width="8" height="7" rx="1.5" stroke="#3B82F6" strokeWidth="1.5"/><rect x="2" y="15" width="8" height="7" rx="1.5" stroke="#3B82F6" strokeWidth="1.5"/><rect x="14" y="15" width="8" height="7" rx="1.5" stroke="#3B82F6" strokeWidth="1.5"/><path d="M12 9v3M6 15v-3h12v3" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round"/></svg>
        <span style={{fontWeight:700,fontSize:15,color:"#0F172A"}}>Organigrama</span>
        {dirty && <span title="Cambios sin guardar" style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#C2410C",fontWeight:600}}><span className="dot-unsaved"/>sin guardar</span>}
        {!dirty && memFileName && <span style={{fontSize:11,color:"#15803D",fontWeight:600}} title={memFileName}>✓ guardado</span>}
        {roster.length>0&&<span style={{fontSize:11,padding:"2px 8px",background:"#F0FDF4",color:"#15803D",borderRadius:20,fontWeight:600}}>{roster.length} en roster</span>}
        {nodes.length>0&&<span style={{fontSize:11,padding:"2px 8px",background:"#EFF6FF",color:"#1E40AF",borderRadius:20,fontWeight:600}}>{nodes.length} en chart</span>}
        <div style={{flex:1}}/>
        {(roster.length>0||nodes.length>0)&&<button className="btn g" onClick={()=>{setRosterQ("");setAddTab("persona");setPanel("add");}}>＋ Agregar</button>}
        <button className="btn" onClick={()=>fileRef.current?.click()}>{roster.length>0?"Actualizar maestro":"Importar xlsx/csv"}</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt,.json" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(!f)return;if(f.name.endsWith(".json"))importJSON(e);else readFile(e);}}/>
        {/* v5: memoria portable */}
        <button className="btn" onClick={()=>memRef.current?.click()} title="Cargar memoria portable (.orgmem)">📂 Cargar memoria</button>
        <input ref={memRef} type="file" accept=".orgmem,.json" style={{display:"none"}} onChange={loadMem}/>
        <button className="btn g" onClick={saveMem} disabled={roster.length===0&&nodes.length===0} title="Descargar todo el trabajo como archivo portable">💾 Guardar memoria</button>
        {nodes.length>0&&<><button className="btn" onClick={exportJSON}>Exportar JSON</button><button className="btn o" onClick={exportPDF} disabled={pdfLoading}>{pdfLoading?"Generando…":"Descargar PDF"}</button></>}
        {(nodes.length>0||roster.length>0)&&<button className="btn d" onClick={()=>{if(dirty&&!confirm("⚠ Tienes cambios sin guardar. ¿Limpiar de todos modos?"))return;setNodes([]);setRoster([]);setSel(null);setDirty(false);setMemFileName("");}}>Limpiar</button>}
      </div>

      {/* v5: aviso de privacidad cuando está vacío */}
      {roster.length===0 && nodes.length===0 && (
        <div style={{padding:"8px 14px",background:"#FFFBEB",borderBottom:"1px solid #FDE68A",fontSize:12,color:"#854D0E",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:14}}>🔒</span>
          <span><strong>Privacidad:</strong> esta app NO guarda nada en el navegador. Al cerrar la pestaña se pierde todo. Usa <strong>💾 Guardar memoria</strong> para descargar tu trabajo como archivo <code style={{background:"#FEF3C7",padding:"1px 5px",borderRadius:3}}>.orgmem</code>, y <strong>📂 Cargar memoria</strong> para recuperarlo.</span>
        </div>
      )}

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* ── Panel: mapeo columnas ── */}
        {panel==="colmap"&&(
          <div style={{width:300,background:"#fff",borderRight:"1px solid #E2E8F0",padding:18,overflowY:"auto",flexShrink:0}}>
            <div style={{fontWeight:700,fontSize:14,color:"#0F172A",marginBottom:2}}>{impMode==="reimport"?"Actualizar maestro":"Mapear columnas"}</div>
            <div style={{fontSize:12,color:"#64748B",marginBottom:14}}>{impFile} · {impRows.length} filas</div>
            {impMode==="reimport" && (
              <div style={{padding:10,background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:8,fontSize:12,color:"#1E40AF",marginBottom:14,lineHeight:1.5}}>
                <strong>Modo actualización:</strong> personas se identifican por ID. Si hay diferencias te preguntaré qué conservar.
              </div>
            )}
            {[{k:"nombre",l:"Nombre *"},{k:"cargo",l:"Cargo"},{k:"area",l:"Área / Sede"},{k:"dept",l:"Departamento"},{k:"id",l:"ID único"}].map(f=>(
              <div key={f.k} style={{marginBottom:10}}>
                <label style={{display:"block",fontSize:12,color:"#64748B",marginBottom:3}}>{f.l}</label>
                <select className="inp" value={colMap[f.k]||""} onChange={e=>setColMap(m=>({...m,[f.k]:e.target.value||undefined}))}>
                  <option value="">— No mapear —</option>
                  {impHdrs.map(h=><option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
            <div style={{marginTop:6,marginBottom:14,padding:12,background:"#F0FDF4",border:"1px solid #86EFAC",borderRadius:10}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <div style={{flex:1,fontSize:13,fontWeight:600,color:"#15803D"}}>Solo activos (sin fecha retiro)</div>
                <div onClick={()=>setFilterOn(f=>!f)} style={{width:36,height:20,borderRadius:10,background:filterOn?"#22C55E":"#CBD5E1",cursor:"pointer",position:"relative",transition:"background .2s",flexShrink:0}}>
                  <div style={{width:14,height:14,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:filterOn?19:3,transition:"left .2s"}}/>
                </div>
              </div>
              <label style={{display:"block",fontSize:12,color:"#15803D",marginBottom:3}}>Columna fecha retiro</label>
              <select className="inp" style={{borderColor:"#86EFAC"}} value={colMap.fechaRetiro||""} onChange={e=>setColMap(m=>({...m,fechaRetiro:e.target.value||undefined}))}>
                <option value="">— No mapear —</option>
                {impHdrs.map(h=><option key={h} value={h}>{h}</option>)}
              </select>
              <div style={{display:"flex",gap:6,marginTop:10}}>
                {[{v:prevCount.activos,l:"Activos",bg:"#F0FDF4",bc:"#86EFAC",tc:"#15803D"},{v:prevCount.excl,l:"Excluidos",bg:"#FFF1F2",bc:"#FCA5A5",tc:"#DC2626"},{v:prevCount.total,l:"Total",bg:"#F8FAFC",bc:"#E2E8F0",tc:"#475569"}].map(x=>(
                  <div key={x.l} style={{flex:1,textAlign:"center",padding:"6px 0",background:x.bg,border:`1px solid ${x.bc}`,borderRadius:8}}>
                    <div style={{fontSize:16,fontWeight:700,color:x.tc}}>{x.v}</div>
                    <div style={{fontSize:9,fontWeight:700,color:x.tc,opacity:.7}}>{x.l}</div>
                  </div>))}
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn p" style={{flex:1}} disabled={!colMap.nombre} onClick={applyImport}>
                {impMode==="reimport"?"Actualizar":"Cargar"} {prevCount.activos} personas
              </button>
              <button className="btn" onClick={()=>setPanel(null)}>Cancelar</button>
            </div>
          </div>
        )}

        {/* ── Panel: agregar persona / grupo ── */}
        {panel==="add"&&(
          <div style={{width:300,background:"#fff",borderRight:"1px solid #E2E8F0",display:"flex",flexDirection:"column",flexShrink:0}}>
            <div style={{padding:"14px 14px 0",flexShrink:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <span style={{fontWeight:700,fontSize:14,color:"#0F172A",flex:1}}>Agregar al organigrama</span>
                <button className="btn" style={{padding:"3px 8px",fontSize:12}} onClick={()=>setPanel(null)}>✕</button>
              </div>
              {/* Tabs */}
              <div style={{display:"flex",gap:6,marginBottom:12}}>
                <button className={`tab${addTab==="persona"?" active":""}`} onClick={()=>setAddTab("persona")}>
                  👤 Persona
                </button>
                <button className={`tab${addTab==="grupo"?" active":""}`} onClick={()=>setAddTab("grupo")}>
                  🏢 Grupo / Sede
                </button>
              </div>
            </div>

            {/* Tab: Personas */}
            {addTab==="persona"&&(
              <>
                <div style={{padding:"0 14px 8px",flexShrink:0}}>
                  <input className="inp" value={rosterQ} onChange={e=>setRosterQ(e.target.value)} placeholder={roster.length?`Buscar en ${roster.length} personas…`:"No hay personas cargadas"} autoFocus/>
                  {/* v7: Filtros multi-select con chips */}
                  {roster.length>0&&(
                    <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:8}}>
                      {[
                        {k:"sede",l:"🏙 Sedes",opts:uniqueSedes},
                        {k:"cargo",l:"💼 Cargos",opts:uniqueCargos},
                        {k:"dept",l:"🗂 Depto",opts:uniqueDepts},
                      ].filter(g=>g.opts.length>0).map(g=>(
                        <details key={g.k} style={{border:"1px solid #E2E8F0",borderRadius:8,background:"#fff"}}>
                          <summary style={{cursor:"pointer",padding:"6px 10px",fontSize:12,fontWeight:600,color:rosterFilters[g.k].length?"#1E40AF":"#475569",display:"flex",alignItems:"center",gap:6,userSelect:"none"}}>
                            <span>{g.l}</span>
                            {rosterFilters[g.k].length>0 && <span style={{background:"#3B82F6",color:"#fff",padding:"1px 7px",borderRadius:10,fontSize:10,fontWeight:700}}>{rosterFilters[g.k].length}</span>}
                            <span style={{marginLeft:"auto",fontSize:10,color:"#94A3B8"}}>{g.opts.length}</span>
                          </summary>
                          <div style={{maxHeight:160,overflowY:"auto",padding:"4px 8px 8px",display:"flex",flexWrap:"wrap",gap:4}}>
                            {g.opts.map(v=>{
                              const on=rosterFilters[g.k].includes(v);
                              return(
                                <span key={v} onClick={()=>toggleFilter(g.k,v)}
                                  style={{padding:"3px 8px",borderRadius:12,fontSize:10,cursor:"pointer",userSelect:"none",whiteSpace:"nowrap",
                                    background:on?"#3B82F6":"#F1F5F9",color:on?"#fff":"#475569",
                                    border:`1px solid ${on?"#3B82F6":"#E2E8F0"}`,fontWeight:on?600:400}}>
                                  {on?"✓ ":""}{v}
                                </span>
                              );
                            })}
                          </div>
                        </details>
                      ))}
                      {filtersActivos>0&&(
                        <button onClick={()=>setRosterFilters({sede:[],cargo:[],dept:[]})} style={{background:"#FEF2F2",border:"1px solid #FCA5A5",borderRadius:7,color:"#DC2626",fontSize:11,cursor:"pointer",padding:"4px 10px",alignSelf:"flex-start"}}>
                          ✕ Limpiar filtros ({filtersActivos})
                        </button>
                      )}
                    </div>
                  )}
                  <div style={{fontSize:11,color:"#94A3B8",marginTop:5}}>{rosterQ||filtersActivos>0?`${rosterFiltered.length} resultado${rosterFiltered.length!==1?"s":""}`:roster.length>80?"Primeros 80":`${rosterFiltered.length} personas`} · <span style={{color:"#3B82F6"}}>{inChart.size} en chart</span></div>
                </div>
                <div style={{flex:1,overflowY:"auto"}}>
                  {/* ── Quick-add: seleccionar conexión ── */}
                  {quickAdd&&(
                    <div style={{margin:"8px 14px",border:"1px solid #BAE6FD",borderRadius:12,overflow:"hidden",background:"#F0F9FF"}}>
                      {/* Cabecera persona */}
                      <div style={{padding:"10px 14px",background:"#fff",borderBottom:"1px solid #BAE6FD",display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:36,height:36,borderRadius:"50%",background:"#EFF6FF",border:"1.5px solid #3B82F6",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          <span style={{fontSize:11,fontWeight:700,color:"#1E40AF"}}>{ini(quickAdd.person.nombre)}</span>
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:700,color:"#0F172A",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{quickAdd.person.nombre}</div>
                          <div style={{fontSize:11,color:"#64748B"}}>{quickAdd.person.cargo||""}</div>
                        </div>
                        <button onClick={()=>setQuickAdd(null)} style={{background:"none",border:"none",cursor:"pointer",color:"#94A3B8",fontSize:16,padding:"0 4px"}}>✕</button>
                      </div>
                      {/* Buscar jefe */}
                      <div style={{padding:"10px 14px"}}>
                        <div style={{fontSize:12,fontWeight:600,color:"#0369A1",marginBottom:6}}>¿A quién reporta?</div>
                        <input className="inp" value={quickAdd.q} onChange={e=>setQuickAdd(f=>({...f,q:e.target.value}))} placeholder="Buscar en el chart…" style={{marginBottom:6,borderColor:"#BAE6FD"}}/>
                        <div style={{maxHeight:140,overflowY:"auto",border:"1px solid #E2E8F0",borderRadius:8,background:"#fff",marginBottom:8}}>
                          {quickBossResults.length===0&&<div style={{padding:"10px 12px",fontSize:12,color:"#94A3B8"}}>Sin nodos en el chart aún</div>}
                          {quickBossResults.map(n=>(
                            <div key={n.id} onClick={()=>setQuickAdd(f=>({...f,parentId:n.id,q:""}))}
                              style={{padding:"7px 10px",cursor:"pointer",borderBottom:"1px solid #F1F5F9",background:n.id===quickAdd.parentId?"#EFF6FF":"#fff",display:"flex",alignItems:"center",gap:8}}>
                              <span style={{fontSize:13}}>{n.tipo==="grupo"?"🏢":"👤"}</span>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:12,fontWeight:600,color:"#0F172A",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{n.nombre}</div>
                                <div style={{fontSize:10,color:"#64748B"}}>{n.cargo||""}</div>
                              </div>
                              {n.id===quickAdd.parentId&&<span style={{fontSize:14,color:"#3B82F6"}}>✓</span>}
                            </div>
                          ))}
                        </div>
                        {quickAdd.parentId&&(()=>{const p=nodes.find(x=>x.id===quickAdd.parentId);return p?<div style={{fontSize:11,color:"#0369A1",marginBottom:8,padding:"4px 8px",background:"#E0F2FE",borderRadius:6}}>Reporta a: <strong>{p.nombre}</strong></div>:null;})()}
                        <div style={{display:"flex",gap:6}}>
                          <button className="btn p" onClick={confirmQuickAdd} style={{flex:1,fontSize:12}}>{quickAdd.parentId?"✓ Agregar con conexión":"✓ Agregar al chart"}</button>
                          <button onClick={()=>{setNodes(p=>[...p,{...quickAdd.person,parentId:"",tipo:"persona"}]);setQuickAdd(null);}} style={{padding:"5px 10px",borderRadius:8,border:"1px solid #E2E8F0",background:"#fff",cursor:"pointer",fontSize:11,color:"#64748B",whiteSpace:"nowrap"}}>Sin jefe</button>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* ── Lista de personas ── */}
                  {!quickAdd&&rosterFiltered.map(r=>{
                    const ya=inChart.has(r.id);
                    return(
                      <div key={r.id} className={`rrow${ya?" added":""}`} onClick={()=>{if(!ya)addPersona(r);}}>
                        <div style={{width:32,height:32,borderRadius:"50%",background:ya?"#EDE9FE":"#F1F5F9",border:`1.5px solid ${ya?"#A855F7":"#E2E8F0"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          <span style={{fontSize:11,fontWeight:700,color:ya?"#7E22CE":"#64748B"}}>{ini(r.nombre)}</span>
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,color:"#0F172A",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.nombre}</div>
                          <div style={{fontSize:11,color:"#64748B",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{[r.cargo,r.area].filter(Boolean).join(" · ")}</div>
                        </div>
                        <span style={{fontSize:11,padding:"2px 7px",borderRadius:6,background:ya?"#EDE9FE":"#EFF6FF",color:ya?"#7E22CE":"#3B82F6",fontWeight:600,flexShrink:0}}>{ya?"En chart":"+ Agregar"}</span>
                      </div>);
                  })}
                  {!quickAdd&&rosterFiltered.length===0&&<div style={{padding:"24px 14px",textAlign:"center",fontSize:13,color:"#94A3B8"}}>
                    {roster.length===0?"Importa un xlsx primero":"Sin resultados"}
                  </div>}
                </div>
                <div style={{padding:"10px 14px",borderTop:"1px solid #E2E8F0",fontSize:11,color:"#64748B",lineHeight:1.7,flexShrink:0}}>
                  {quickAdd?"Selecciona a quién reporta o haz clic en «Sin jefe» para agregarlo como raíz.":"Clic en una persona → asigna su conexión al instante."}
                </div>
              </>
            )}

            {/* Tab: Grupos */}
            {addTab==="grupo"&&(
              <div style={{padding:"0 14px 14px",overflowY:"auto",flex:1}}>
                <div style={{padding:"10px 12px",background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:10,marginBottom:14,fontSize:12,color:"#C2410C",lineHeight:1.7}}>
                  Los <strong>grupos</strong> son nodos intermedios para sedes, áreas o departamentos — no son personas del roster.
                </div>

                {/* Origen del grupo */}
                <div style={{marginBottom:12}}>
                  <label style={{display:"block",fontSize:12,color:"#64748B",marginBottom:4}}>Origen del nombre</label>
                  <div style={{display:"flex",gap:6}}>
                    {[{v:"manual",l:"✏️ Manual"},{v:"columna",l:"📋 Desde maestro"}].map(o=>(
                      <button key={o.v} onClick={()=>setGrpForm(f=>({...f,source:o.v,nombre:"",sourceVal:""}))}
                        style={{flex:1,padding:"6px 0",borderRadius:8,border:`1.5px solid ${grpForm.source===o.v?"#3B82F6":"#E2E8F0"}`,background:grpForm.source===o.v?"#EFF6FF":"#fff",color:grpForm.source===o.v?"#1D4ED8":"#475569",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nombre manual */}
                {grpForm.source==="manual"&&(
                  <div style={{marginBottom:10}}>
                    <label style={{display:"block",fontSize:12,color:"#64748B",marginBottom:3}}>Nombre del grupo *</label>
                    <input className="inp" value={grpForm.nombre} onChange={e=>setGrpForm(f=>({...f,nombre:e.target.value}))} placeholder="Ej: Punto 14, Sede Norte…"/>
                  </div>
                )}

                {/* Desde columna del maestro */}
                {grpForm.source==="columna"&&(
                  <div style={{marginBottom:10,padding:"10px 12px",background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:10}}>
                    <label style={{display:"block",fontSize:12,color:"#0369A1",marginBottom:4,fontWeight:600}}>Columna del maestro</label>
                    <select className="inp" style={{marginBottom:8,borderColor:"#BAE6FD"}} value={grpForm.sourceCol} onChange={e=>setGrpForm(f=>({...f,sourceCol:e.target.value,sourceVal:""}))}>
                      {uniqueSedes.length>0&&<option value="area">🏙 Sede / Área ({uniqueSedes.length} valores)</option>}
                      {uniqueDepts.length>0&&<option value="dept">🗂 Departamento / C.Costo ({uniqueDepts.length} valores)</option>}
                      {uniqueCargos.length>0&&<option value="cargo">💼 Cargo ({uniqueCargos.length} valores)</option>}
                    </select>
                    <label style={{display:"block",fontSize:12,color:"#0369A1",marginBottom:4,fontWeight:600}}>Valor</label>
                    <select className="inp" style={{borderColor:"#BAE6FD"}} value={grpForm.sourceVal} onChange={e=>setGrpForm(f=>({...f,sourceVal:e.target.value}))}>
                      <option value="">— Seleccionar valor —</option>
                      {sourceColValues.map(v=>{
                        const yaExiste=nodes.some(n=>n.tipo==="grupo"&&n.sourceCol===grpForm.sourceCol&&n.sourceVal===v);
                        return <option key={v} value={v} disabled={yaExiste}>{v}{yaExiste?" (ya existe)":""}</option>;
                      })}
                    </select>
                    {grpForm.sourceVal&&<div style={{marginTop:6,fontSize:11,color:"#0284C7"}}>✓ Se creará el grupo "<strong>{grpForm.sourceVal}</strong>" — la etiqueta en personas conectadas se ocultará automáticamente</div>}
                  </div>
                )}

                <div style={{marginBottom:12}}>
                  <label style={{display:"block",fontSize:12,color:"#64748B",marginBottom:6}}>Color</label>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {GPAL.map((g,i)=>(
                      <div key={i} onClick={()=>setGrpForm(f=>({...f,colorIdx:i}))}
                        style={{width:28,height:28,borderRadius:7,background:g.bg,cursor:"pointer",border:grpForm.colorIdx===i?"3px solid #0F172A":"3px solid transparent",transition:"border .15s"}}/>
                    ))}
                  </div>
                </div>
                <div style={{marginBottom:14}}>
                  <label style={{display:"block",fontSize:12,color:"#64748B",marginBottom:3}}>Reporta a (opcional)</label>
                  <select className="inp" value={grpForm.parentId} onChange={e=>setGrpForm(f=>({...f,parentId:e.target.value}))}>
                    <option value="">— Nivel raíz —</option>
                    {nodes.map(n=><option key={n.id} value={n.id}>{n.nombre}{n.tipo==="grupo"?" 🏢":""}{n.cargo?` · ${n.cargo}`:""}</option>)}
                  </select>
                </div>
                <button className="btn o" onClick={addGrupo}
                  disabled={grpForm.source==="manual"?!grpForm.nombre.trim():!grpForm.sourceVal}
                  style={{width:"100%"}}>
                  ＋ Agregar grupo "{grpForm.source==="columna"?grpForm.sourceVal||"…":grpForm.nombre||"…"}"
                </button>

                {/* Grupos existentes */}
                {nodes.filter(n=>n.tipo==="grupo").length>0&&(
                  <div style={{marginTop:16}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>Grupos en el chart</div>
                    {nodes.filter(n=>n.tipo==="grupo").map(n=>{
                      const g=gcol(n.colorIdx??0);
                      return(
                        <div key={n.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid #F1F5F9"}}>
                          <div style={{width:24,height:24,borderRadius:6,background:g.bg,flexShrink:0}}/>
                          <span style={{fontSize:13,fontWeight:600,color:"#0F172A",flex:1}}>{n.nombre}</span>
                          <button onClick={()=>delNode(n.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#F87171",fontSize:14,padding:"0 4px"}}>✕</button>
                        </div>);
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Panel: editar nodo ── */}
        {panel==="edit"&&editNode&&(
          <div style={{width:280,background:"#fff",borderRight:"1px solid #E2E8F0",padding:18,overflowY:"auto",flexShrink:0}}>
            <div style={{fontWeight:700,fontSize:14,color:"#0F172A",marginBottom:14}}>
              {editNode.tipo==="grupo"?"Editar grupo":"Editar persona"}
            </div>

            {/* Avatar */}
            {editNode.tipo==="persona"&&(()=>{
              const c=col(editArea);
              return(
                <div style={{textAlign:"center",marginBottom:16}}>
                  <div onClick={()=>fotoRef.current?.click()} style={{width:84,height:84,borderRadius:"50%",margin:"0 auto 6px",background:c.bg,border:`3px solid ${c.border}`,overflow:"hidden",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {editFoto?<img src={editFoto} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:24,fontWeight:700,color:c.text}}>{ini(editNombre||editNode.nombre)}</span>}
                  </div>
                  <input ref={fotoRef} type="file" accept="image/*" onChange={uploadFoto} style={{display:"none"}}/>
                  <div><span onClick={()=>fotoRef.current?.click()} style={{fontSize:11,color:"#3B82F6",cursor:"pointer"}}>📷 Cambiar foto</span></div>
                </div>
              );
            })()}

            {/* v5: Datos editables de la persona */}
            {editNode.tipo==="persona"&&(
              <div style={{marginBottom:14,paddingBottom:14,borderBottom:"1px dashed #E2E8F0"}}>
                <div style={{fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>Datos</div>
                <div style={{marginBottom:8}}>
                  <label style={{display:"block",fontSize:11,color:"#64748B",marginBottom:2}}>Nombre *</label>
                  <input className="inp" style={{fontSize:12,padding:"6px 10px"}} value={editNombre} onChange={e=>setEditNombre(e.target.value)}/>
                </div>
                <div style={{marginBottom:8}}>
                  <label style={{display:"block",fontSize:11,color:"#64748B",marginBottom:2}}>Cargo</label>
                  <input className="inp" style={{fontSize:12,padding:"6px 10px"}} list="dl-cargo" value={editCargo} onChange={e=>setEditCargo(e.target.value)}/>
                  <datalist id="dl-cargo">{uniqueCargos.map(v=><option key={v} value={v}/>)}</datalist>
                </div>
                <div style={{marginBottom:8}}>
                  <label style={{display:"block",fontSize:11,color:"#64748B",marginBottom:2}}>Sede / Área</label>
                  <input className="inp" style={{fontSize:12,padding:"6px 10px"}} list="dl-area" value={editArea} onChange={e=>setEditArea(e.target.value)}/>
                  <datalist id="dl-area">{uniqueSedes.map(v=><option key={v} value={v}/>)}</datalist>
                </div>
                <div style={{marginBottom:8}}>
                  <label style={{display:"block",fontSize:11,color:"#64748B",marginBottom:2}}>Departamento</label>
                  <input className="inp" style={{fontSize:12,padding:"6px 10px"}} list="dl-dept" value={editDept} onChange={e=>setEditDept(e.target.value)}/>
                  <datalist id="dl-dept">{uniqueDepts.map(v=><option key={v} value={v}/>)}</datalist>
                </div>
                <div>
                  <label style={{display:"block",fontSize:11,color:"#64748B",marginBottom:2}}>Email</label>
                  <input className="inp" style={{fontSize:12,padding:"6px 10px"}} value={editEmail} onChange={e=>setEditEmail(e.target.value)}/>
                </div>
              </div>
            )}

            {editNode.tipo==="grupo"&&(()=>{
              const g=gcol(editNode.colorIdx??0);
              return(
                <div style={{textAlign:"center",marginBottom:16}}>
                  <div style={{width:54,height:54,borderRadius:12,margin:"0 auto 6px",background:g.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontSize:22}}>🏢</span>
                  </div>
                  <div style={{fontSize:13,fontWeight:700,color:"#0F172A"}}>{editNode.nombre}</div>
                </div>
              );
            })()}

            {/* Asignar jefe */}
            <div style={{marginBottom:16}}>
              <label style={{display:"block",fontSize:12,fontWeight:600,color:"#334155",marginBottom:6}}>¿Quién es su jefe / dónde reporta?</label>
              <input className="inp" value={bossQ} onChange={e=>setBossQ(e.target.value)} placeholder="Buscar por nombre…" style={{marginBottom:4}}/>
              {bossQ&&bossResults.length>0&&(
                <div style={{border:"1px solid #E2E8F0",borderRadius:8,maxHeight:160,overflowY:"auto",background:"#fff",marginBottom:6}}>
                  {bossResults.map(r=>(
                    <div key={r.id} onClick={()=>{setEditPId(r.id);setBossQ("");}} style={{padding:"7px 10px",cursor:"pointer",borderBottom:"1px solid #F1F5F9",background:r.id===editPId?"#EFF6FF":"#fff",display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:13}}>{r.tipo==="grupo"?"🏢":"👤"}</span>
                      <div>
                        <div style={{fontSize:12,fontWeight:600,color:"#0F172A"}}>{r.nombre}</div>
                        <div style={{fontSize:10,color:"#64748B"}}>{r.cargo||""}{r.enChart?<span style={{color:"#3B82F6"}}> · en chart</span>:""}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {bossQ&&bossResults.length===0&&<div style={{fontSize:12,color:"#94A3B8",padding:"4px 2px"}}>Sin resultados</div>}

              {editPId&&(()=>{
                const padre=nodes.find(x=>x.id===editPId)||(roster.find(x=>x.id===editPId));
                if(!padre)return null;
                return(
                  <div style={{padding:"8px 10px",background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:8,display:"flex",alignItems:"center",gap:8,marginTop:6}}>
                    <span style={{fontSize:14}}>{padre.tipo==="grupo"?"🏢":"👤"}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:600,color:"#1E40AF"}}>{padre.nombre}</div>
                      {padre.cargo&&<div style={{fontSize:10,color:"#3B82F6"}}>{padre.cargo}</div>}
                    </div>
                    <button onClick={()=>setEditPId("")} style={{background:"none",border:"none",cursor:"pointer",color:"#93C5FD",fontSize:16}}>✕</button>
                  </div>
                );
              })()}
              {!editPId&&<div style={{fontSize:11,color:"#94A3B8",padding:"6px 0"}}>Sin jefe asignado (nivel raíz)</div>}
            </div>

            <div style={{display:"flex",gap:8}}>
              <button className="btn p" onClick={saveEdit} style={{flex:1}}>Guardar</button>
              <button className="btn" onClick={()=>{setPanel(null);setSel(null);setEditId(null);}}>Cancelar</button>
            </div>
            <button className="btn d" onClick={()=>delNode(editNode.id)} style={{width:"100%",marginTop:8}}>Eliminar del chart</button>
          </div>
        )}

        {/* ── Canvas ── */}
        <div ref={canvasRef}
          style={{flex:1,overflow:"hidden",position:"relative",cursor:drag?"grabbing":"grab",background:"#F8FAFC"}}
          onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}
          onClick={e=>{if(!e.target.closest(".on"))setSel(null);}}>

          <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}>
            <defs><pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1" fill="#CBD5E1" opacity=".5"/></pattern></defs>
            <rect width="100%" height="100%" fill="url(#dots)"/>
          </svg>

          {nodes.length===0?(
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12}}>
              <svg width="52" height="52" viewBox="0 0 48 48" fill="none">
                <rect x="16" y="3" width="16" height="12" rx="3" stroke="#CBD5E1" strokeWidth="1.5"/>
                <rect x="3" y="33" width="16" height="12" rx="3" stroke="#CBD5E1" strokeWidth="1.5"/>
                <rect x="29" y="33" width="16" height="12" rx="3" stroke="#CBD5E1" strokeWidth="1.5"/>
                <path d="M24 15v8M11 33v-8h26v8" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <div style={{fontWeight:700,fontSize:17,color:"#475569"}}>{roster.length===0?"Importa tu archivo maestro":"Agrega personas y grupos"}</div>
              <div style={{display:"flex",gap:8,marginTop:4}}>
                {roster.length===0?<button className="btn p" onClick={()=>fileRef.current?.click()}>Importar xlsx / csv</button>:null}
                <button className="btn g" onClick={()=>{setRosterQ("");setAddTab("persona");setPanel("add");}}>＋ Agregar</button>
              </div>
              <div style={{fontSize:12,color:"#94A3B8",maxWidth:340,textAlign:"center",lineHeight:1.8,marginTop:4}}>
                <strong style={{color:"#475569"}}>Flujo sugerido:</strong> importa el xlsx → agrega un grupo (sede) → agrega personas dentro → asigna el jefe a cada una.
              </div>
            </div>
          ):(
            /* div capturado para PDF */
            <div ref={chartRef} style={{position:"absolute",inset:0,overflow:"hidden",background:"#F8FAFC"}}>
              <svg style={{position:"absolute",left:vp.x,top:vp.y,width:W*vp.s,height:H*vp.s,overflow:"visible",pointerEvents:"none"}}>
                <g transform={`scale(${vp.s})`}>
                  {edges.map(e=>(
                    <path key={e.key} d={e.d}
                      stroke={e.active?"#3B82F6":"#94A3B8"}
                      strokeWidth={e.active?2.5:1.5}
                      fill="none" strokeLinecap="round"/>
                  ))}
                </g>
              </svg>

              {nodes.map(n=>{
                const p=pos[n.id]; if(!p)return null;
                const isSel=sel===n.id;
                const nh=n.tipo==="grupo"?NHG:NH;

                if(n.tipo==="grupo"){
                  const g=gcol(n.colorIdx??0);
                  return(
                    <div key={n.id} className="on"
                      style={{left:vp.x+p.x*vp.s,top:vp.y+p.y*vp.s,width:NW*vp.s,height:nh*vp.s}}
                      onClick={e=>{e.stopPropagation();setSel(isSel?null:n.id);}}>
                      <div style={{
                        width:NW,height:nh,transform:`scale(${vp.s})`,transformOrigin:"top left",
                        background:g.bg,
                        border:`2px solid ${g.border}`,
                        borderRadius:10,
                        boxShadow:isSel?"0 0 0 3px rgba(255,255,255,.5),0 4px 20px rgba(0,0,0,.2)":"0 2px 8px rgba(0,0,0,.15)",
                        display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"0 14px",
                      }}>
                        <span style={{fontSize:16}}>🏢</span>
                        <span style={{fontSize:13,fontWeight:700,color:g.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{trunc(n.nombre,20)}</span>
                        {isSel&&(
                          <div onClick={e=>{e.stopPropagation();openEdit(n);}}
                            style={{width:24,height:24,borderRadius:6,background:"rgba(255,255,255,.25)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-9 9H2v-3L11 2z" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                /* Persona — tarjeta ID vertical (v5/v7) */
                const c=col(n.area);
                const parentGrp=n.parentId?nodes.find(x=>x.id===n.parentId&&x.tipo==="grupo"):null;
                const badgeVal=n.area||n.dept;
                const badgeRedundant=parentGrp?.sourceVal&&(
                  (parentGrp.sourceCol==="area"&&parentGrp.sourceVal===n.area)||
                  (parentGrp.sourceCol==="dept"&&parentGrp.sourceVal===n.dept)||
                  (parentGrp.sourceCol==="cargo"&&parentGrp.sourceVal===n.cargo)
                );
                const esCompacto = p.compact === true;
                const tengoHijos = nodes.some(x=>x.parentId===n.id);
                const esAncestroCompacto = compactSet.has(n.id);
                const modoAsignar = assignBossFor && assignBossFor !== n.id;
                const esOrigenAsignar = assignBossFor === n.id;

                /* ── MODO COMPACTO: fila delgada tipo listado ── */
                if(esCompacto){
                  return(
                    <div key={n.id} className="on"
                      style={{left:vp.x+p.x*vp.s,top:vp.y+p.y*vp.s,width:NW*vp.s,height:nh*vp.s}}
                      onClick={e=>{e.stopPropagation(); if(modoAsignar){ onAssignBossClick(n.id); return; } setSel(isSel?null:n.id);}}>
                      <div style={{
                        width:NW,height:nh,transform:`scale(${vp.s})`,transformOrigin:"top left",
                        background:modoAsignar?"#FEF3C7":"#ffffff",
                        border:`1.5px solid ${modoAsignar?"#F59E0B":(isSel?c.border:"#E2E8F0")}`,
                        borderLeft:`4px solid ${c.border}`,
                        borderRadius:6,
                        display:"flex",alignItems:"center",gap:8,padding:"0 10px",
                        cursor:modoAsignar?"crosshair":"pointer",
                        boxShadow:isSel?`0 0 0 2px ${c.bg}`:"0 1px 2px rgba(15,23,42,.05)",
                      }}>
                        <div style={{width:10,height:10,borderRadius:"50%",background:c.dot,flexShrink:0}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:11,fontWeight:600,color:"#0F172A",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{trunc(n.nombre,28)}</div>
                          {n.cargo&&<div style={{fontSize:9,color:"#64748B",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{trunc(n.cargo,32)}</div>}
                        </div>
                        {isSel&&!modoAsignar&&(
                          <div onClick={e=>{e.stopPropagation();openEdit(n);}} style={{width:22,height:22,borderRadius:5,background:c.bg,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-9 9H2v-3L11 2z" stroke={c.text} strokeWidth="1.5" strokeLinejoin="round"/></svg>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                /* ── MODO NORMAL: tarjeta grande ── */
                return(
                  <div key={n.id} className="on"
                    style={{left:vp.x+p.x*vp.s,top:vp.y+p.y*vp.s,width:NW*vp.s,height:nh*vp.s}}
                    onClick={e=>{e.stopPropagation(); if(modoAsignar){ onAssignBossClick(n.id); return; } setSel(isSel?null:n.id);}}>
                    <div style={{
                      width:NW,height:nh,transform:`scale(${vp.s})`,transformOrigin:"top left",
                      background:modoAsignar?"#FEF3C7":(esOrigenAsignar?"#FEE2E2":"#ffffff"),
                      border:`1.5px solid ${modoAsignar?"#F59E0B":(esOrigenAsignar?"#EF4444":(isSel?c.border:"#E2E8F0"))}`,
                      borderRadius:12,
                      boxShadow:isSel?`0 0 0 3px ${c.bg},0 8px 24px rgba(0,0,0,.15)`:"0 2px 8px rgba(15,23,42,.08)",
                      display:"flex",flexDirection:"column",alignItems:"center",
                      overflow:"hidden",position:"relative",
                      cursor:modoAsignar?"crosshair":"pointer",
                    }}>
                      {/* Banda superior de color */}
                      <div style={{position:"absolute",top:0,left:0,right:0,height:6,background:c.border}}/>

                      {/* Foto grande */}
                      <div style={{marginTop:16,width:FOTO_SZ,height:FOTO_SZ,borderRadius:"50%",background:c.bg,border:`3px solid ${c.border}`,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0,boxShadow:"0 4px 12px rgba(0,0,0,.08)"}}>
                        {n.foto
                          ? <img src={n.foto} style={{width:"100%",height:"100%",objectFit:"cover"}} alt={n.nombre}/>
                          : <span style={{fontSize:26,fontWeight:700,color:c.text,letterSpacing:"-0.02em"}}>{ini(n.nombre)}</span>
                        }
                      </div>

                      {/* Nombre */}
                      <div style={{marginTop:10,padding:"0 10px",width:"100%",textAlign:"center",fontSize:12,fontWeight:700,color:"#0F172A",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",lineHeight:1.2}}>
                        {trunc(n.nombre,22)}
                      </div>

                      {/* Cargo */}
                      {n.cargo && (
                        <div style={{marginTop:3,padding:"0 10px",width:"100%",textAlign:"center",fontSize:10,color:"#64748B",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",lineHeight:1.2}}>
                          {trunc(n.cargo,26)}
                        </div>
                      )}

                      {/* Badge sede */}
                      {badgeVal && !badgeRedundant && (
                        <div style={{marginTop:5,background:c.bg,borderRadius:4,padding:"2px 8px",maxWidth:"calc(100% - 16px)"}}>
                          <span style={{fontSize:9,color:c.text,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",display:"inline-block",maxWidth:"100%"}}>{trunc(n.area||n.dept,22)}</span>
                        </div>
                      )}

                      {/* v7: indicador de ancestro compactado */}
                      {esAncestroCompacto && (
                        <div style={{position:"absolute",bottom:8,left:8,fontSize:8,fontWeight:700,color:"#0F766E",background:"#CCFBF1",padding:"1px 6px",borderRadius:8,letterSpacing:"0.03em"}}>
                          HIJOS EN LISTA
                        </div>
                      )}

                      {/* Botones (edit + v7: compactar + asignar jefe) */}
                      {isSel && !modoAsignar && (
                        <div style={{position:"absolute",top:10,right:10,display:"flex",flexDirection:"column",gap:4}}>
                          <div title="Editar" onClick={e=>{e.stopPropagation();openEdit(n);}} style={{width:26,height:26,borderRadius:7,background:c.bg,border:`1px solid ${c.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-9 9H2v-3L11 2z" stroke={c.text} strokeWidth="1.5" strokeLinejoin="round"/></svg>
                          </div>
                          <div title="Asignar jefe (clic en otro nodo)" onClick={e=>{e.stopPropagation();setAssignBossFor(n.id);setSel(null);}} style={{width:26,height:26,borderRadius:7,background:"#FEF3C7",border:"1px solid #F59E0B",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:13}}>
                            🔗
                          </div>
                          {tengoHijos && (
                            <div title={esAncestroCompacto?"Mostrar hijos como tarjetas":"Compactar hijos (modo lista)"} onClick={e=>{e.stopPropagation();toggleCompact(n.id);}} style={{width:26,height:26,borderRadius:7,background:esAncestroCompacto?"#CCFBF1":"#F1F5F9",border:`1px solid ${esAncestroCompacto?"#14B8A6":"#CBD5E1"}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:11,fontWeight:700,color:esAncestroCompacto?"#0F766E":"#64748B"}}>
                              {esAncestroCompacto?"▤":"≡"}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Zoom */}
          {nodes.length>0&&(
            <div style={{position:"absolute",bottom:16,right:16,display:"flex",flexDirection:"column",gap:4}}>
              {[{l:"+",fn:()=>setVp(v=>({...v,s:Math.min(3,v.s*1.2)}))},{l:"−",fn:()=>setVp(v=>({...v,s:Math.max(0.08,v.s*0.8)}))},{l:"⌖",fn:()=>setVp({x:60,y:60,s:1})}].map(b=>(
                <button key={b.l} className="zb" onClick={b.fn}>{b.l}</button>
              ))}
              <div style={{textAlign:"center",fontSize:10,color:"#94A3B8",marginTop:2}}>{Math.round(vp.s*100)}%</div>
            </div>
          )}

          {/* Leyenda */}
          {nodes.length>0&&(()=>{
            const areas=[...new Set(nodes.filter(n=>n.tipo==="persona").map(n=>n.area).filter(Boolean))];
            if(!areas.length)return null;
            return(
              <div style={{position:"absolute",bottom:16,left:16,background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,padding:"10px 14px",maxWidth:200}}>
                <div style={{fontSize:9,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Áreas</div>
                {areas.slice(0,7).map(a=>{const c=col(a);return(
                  <div key={a} style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:c.dot,flexShrink:0}}/>
                    <span style={{fontSize:11,color:"#475569",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a}</span>
                  </div>);})}
                {areas.length>7&&<div style={{fontSize:10,color:"#94A3B8",marginTop:2}}>+{areas.length-7} más</div>}
              </div>
            );
          })()}

          {/* Hint seleccionado */}
          {selNode&&panel!=="edit"&&(
            <div style={{position:"absolute",top:12,left:"50%",transform:"translateX(-50%)",background:"#1E293B",color:"#fff",padding:"7px 16px",borderRadius:20,fontSize:12,pointerEvents:"none",whiteSpace:"nowrap",zIndex:10}}>
              {selNode.nombre} — clic en ✏ para editar o asignar jefe
            </div>
          )}
        </div>
      </div>

      {/* v5: MODAL de resolución de conflictos tras reimport */}
      {panel==="diff" && conflicts.length>0 && (
        <div className="modal-bg">
          <div className="modal">
            <div style={{padding:"16px 20px",borderBottom:"1px solid #E2E8F0",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:22}}>⚠</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:15,color:"#0F172A"}}>Cambios detectados al actualizar el maestro</div>
                <div style={{fontSize:12,color:"#64748B",marginTop:2}}>{conflicts.length} persona{conflicts.length!==1?"s":""} con diferencias. Elige qué conservar.</div>
              </div>
            </div>
            <div style={{padding:"10px 20px",background:"#F8FAFC",borderBottom:"1px solid #E2E8F0",display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontSize:12,color:"#64748B",marginRight:"auto"}}>Aplicar a todos:</span>
              <button className="btn" style={{fontSize:11}} onClick={()=>resolveAll("old")}>Mantener lo mío</button>
              <button className="btn" style={{fontSize:11}} onClick={()=>resolveAll("nuevo")}>Usar todo del maestro</button>
            </div>
            <div style={{flex:1,overflowY:"auto"}}>
              {conflicts.map((c,idx)=>(
                <div key={c.id} style={{padding:"12px 16px",borderBottom:"1px solid #F1F5F9"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <span style={{fontSize:13,fontWeight:700,color:"#0F172A"}}>{c.nombre}</span>
                    {c.enChart && <span style={{fontSize:10,padding:"1px 6px",background:"#EFF6FF",color:"#1E40AF",borderRadius:10,fontWeight:600}}>en chart</span>}
                  </div>
                  {Object.entries(c.diffs).map(([field,{old,nuevo}])=>{
                    const choice=c.resolucion[field];
                    const labels={nombre:"Nombre",cargo:"Cargo",area:"Sede",dept:"Depto",email:"Email"};
                    return(
                      <div key={field} className="diff-field">
                        <span style={{fontWeight:600,color:"#475569"}}>{labels[field]||field}</span>
                        <button
                          onClick={()=>resolveConflict(idx,field,"old")}
                          style={{padding:"4px 8px",fontSize:11,border:`1px solid ${choice==="old"?"#3B82F6":"#E2E8F0"}`,background:choice==="old"?"#EFF6FF":"#fff",borderRadius:6,cursor:"pointer",textAlign:"left",color:choice==="old"?"#1E40AF":"#334155",fontFamily:"inherit",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}
                          title={`Mío: ${old||"(vacío)"}`}>
                          Mío: <span style={{fontWeight:600}}>{old||"—"}</span>
                        </button>
                        <button
                          onClick={()=>resolveConflict(idx,field,"nuevo")}
                          style={{padding:"4px 8px",fontSize:11,border:`1px solid ${choice==="nuevo"?"#22C55E":"#E2E8F0"}`,background:choice==="nuevo"?"#F0FDF4":"#fff",borderRadius:6,cursor:"pointer",textAlign:"left",color:choice==="nuevo"?"#15803D":"#334155",fontFamily:"inherit",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}
                          title={`Maestro: ${nuevo||"(vacío)"}`}>
                          Maestro: <span style={{fontWeight:600}}>{nuevo||"—"}</span>
                        </button>
                        <span style={{fontSize:10,color:choice?"#22C55E":"#CBD5E1",fontWeight:700,textAlign:"center"}}>{choice?"✓":"•"}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{padding:"14px 20px",borderTop:"1px solid #E2E8F0",display:"flex",gap:8,justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:11,color:"#94A3B8"}}>
                {conflicts.reduce((s,c)=>s+Object.keys(c.resolucion).length,0)} de {conflicts.reduce((s,c)=>s+Object.keys(c.diffs).length,0)} campos resueltos
              </div>
              <div style={{display:"flex",gap:8}}>
                <button className="btn" onClick={()=>{setConflicts([]);setPanel(null);}}>Cancelar</button>
                <button className="btn p" onClick={applyResolutions}>Aplicar cambios</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
