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
/* v13: paleta corporativa Cañaveral (verde institucional + matices) */
const GPAL = [
  { bg:"#0B2310", border:"#082009", text:"#ffffff" }, /* verde muy oscuro principal */
  { bg:"#184C23", border:"#113519", text:"#ffffff" }, /* verde oscuro */
  { bg:"#15803D", border:"#14532D", text:"#ffffff" }, /* verde medio */
  { bg:"#1A6B30", border:"#113519", text:"#ffffff" }, /* verde corporativo */
  { bg:"#22663B", border:"#0B2310", text:"#ffffff" }, /* verde alterno */
  { bg:"#2D5A2D", border:"#1B3D1B", text:"#ffffff" },
  { bg:"#1F6A3E", border:"#0F4527", text:"#ffffff" },
  { bg:"#3F7A4D", border:"#27513A", text:"#ffffff" },
];

const NW=180, NH=200, NHG=64, GX=22, GY=40;
const FOTO_SZ=84;
const NHC=36; // altura nodo compacto (modo lista)
const GYC=6;  // gap vertical entre nodos compactos apilados
/* v11: caja-lista de subordinados auto-agrupados */
const LW=240;       // ancho caja lista
const LIST_ROW=36;  // altura por fila
const LIST_HEAD=32; // header de la caja
const LIST_PAD=8;   // padding vertical

function listBoxHeight(memberCount){
  return LIST_HEAD + memberCount * LIST_ROW + LIST_PAD;
}

/* v8: helper para obtener todos los padres de un nodo (soporta parentIds[] y parentId legacy) */
function parentsOf(n){
  if(!n) return [];
  if(Array.isArray(n.parentIds) && n.parentIds.length>0) return n.parentIds.filter(Boolean);
  if(n.parentId) return [n.parentId];
  return [];
}
/* v8: jefe "primario" de un nodo — el primero de parentIds, o parentId */
function primaryParentOf(n){
  const ps=parentsOf(n);
  return ps[0] || "";
}

/* v12: invertir un nombre tipo "APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2" → "NOMBRE1 NOMBRE2 APELLIDO1 APELLIDO2".
   Heurística colombiana típica:
   - 4 palabras: 2 apellidos + 2 nombres → mover últimas 2 al inicio
   - 3 palabras: 2 apellidos + 1 nombre → mover última al inicio
   - 2 palabras: 1 apellido + 1 nombre → invertir
   - 5+ palabras: caso raro, mover últimas 2 al inicio (asume 2 nombres compuestos)
   - 1 palabra o menos: dejar igual */
function invertirNombre(s){
  if(!s) return s;
  const partes = s.trim().split(/\s+/);
  if(partes.length<=1) return s;
  if(partes.length===2) return `${partes[1]} ${partes[0]}`;
  if(partes.length===3) return `${partes[2]} ${partes[0]} ${partes[1]}`;
  /* 4+: las últimas 2 al inicio */
  const apellidos = partes.slice(0, partes.length-2);
  const nombres = partes.slice(partes.length-2);
  return `${nombres.join(" ")} ${apellidos.join(" ")}`;
}

/* v12: detectar si una lista de nombres está en formato APELLIDOS NOMBRES.
   Heurística:
   - Si hay nombres muy comunes (JOSE, MARIA, JUAN, LUIS, etc) que aparecen
     en posición FINAL más veces que en posición INICIAL → formato apellidos-primero.
   - Margen de seguridad: necesitamos al menos 60% de coincidencia. */
function detectarFormatoApellidosPrimero(roster){
  const nombresComunes = new Set([
    "JOSE","MARIA","JUAN","LUIS","CARLOS","JORGE","MIGUEL","ANGEL","ANA","ANDRES",
    "DAVID","DIEGO","DANIEL","FERNANDO","FRANCISCO","JAVIER","RICARDO","ANTONIO",
    "MANUEL","ALEJANDRO","SANTIAGO","SEBASTIAN","CRISTIAN","KEVIN","BRYAN","WILMER",
    "OSCAR","RAFAEL","ALBERTO","EDGAR","HERNAN","CESAR","RAUL","PEDRO","PABLO","MARIO",
    "ALEXANDER","NICOLAS","FABIAN","CAMILO","JULIAN","GERMAN","HECTOR","HUGO","ARMANDO",
    "GUSTAVO","HENRY","JAIRO","JESUS","LAURA","SOFIA","DIANA","CAROLINA","CLAUDIA","PATRICIA",
    "SANDRA","MARTHA","GLORIA","ADRIANA","LILIANA","BEATRIZ","CAROLINA","NATALIA","PAULA",
    "VALENTINA","DANIELA","CATALINA","LINA","JENNIFER","KATHERINE","STEFANY","JESSICA",
    "ANGELICA","JOHANA","JOHANNA","YULIANA","YENI","EDNA","DERLY","ROSA","MARTHA","JIMENA",
    "JIMMY","JEIMY","ENAY","LIBNI","JHON","JOHN","ANDERSON","WILLIAM","STIVEN","STEVEN",
    "RICHARD","JEFFERSON","JEISON","BRAYAN","FELIPE","LUZ","ROSALBA","CRISTINA","MARCELA",
    "ALEXANDRA","XIMENA","BIBIANA","ISABEL","LEIDY","NUBIA","NOHORA","DORIS","ELIZABETH",
    "FERNANDA","LIZBETH","LIZETH","JOANA","KATHERIN","KATHERINE","MARLENY"
  ]);
  let coincidenciasFinal=0, coincidenciasInicio=0;
  let total=0;
  roster.forEach(r=>{
    const nombre=(r.nombre||"").trim().toUpperCase();
    if(!nombre) return;
    const partes = nombre.split(/\s+/);
    if(partes.length<2) return;
    total++;
    /* última palabra es nombre común */
    if(nombresComunes.has(partes[partes.length-1])) coincidenciasFinal++;
    /* primera palabra es nombre común */
    if(nombresComunes.has(partes[0])) coincidenciasInicio++;
  });
  if(total<5) return false; // no hay suficiente data para decidir
  /* si las últimas palabras son nombres comunes en >55% de los casos
     y MÁS frecuente que en posición inicial → formato apellidos-primero */
  const ratioFinal = coincidenciasFinal/total;
  const ratioInicio = coincidenciasInicio/total;
  return ratioFinal>=0.55 && ratioFinal > ratioInicio + 0.15;
}

/* v13: detectar nivel jerárquico de admin a partir del cargo (con override manual via n.adminLevel)
   Devuelve 1=master, 2=senior, 3=junior, 99=otro/no-admin */
function adminLevelOf(n){
  if(!n) return 99;
  if(n.adminLevel) {
    /* Override manual: "master" | "senior" | "junior" | "" */
    const lvl = String(n.adminLevel).toLowerCase();
    if(lvl==="master") return 1;
    if(lvl==="senior") return 2;
    if(lvl==="junior") return 3;
  }
  const cargo = (n.cargo||"").toUpperCase();
  if(!cargo.includes("ADMIN")) return 99;
  if(cargo.includes("MASTER") || cargo.includes("MÁSTER")) return 1;
  if(cargo.includes("SENIOR") || cargo.includes("SÉNIOR")) return 2;
  if(cargo.includes("JUNIOR") || cargo.includes("JÚNIOR")) return 3;
  return 99;
}

function buildLayout(nodes, compactSet, autoGroups){
  compactSet = compactSet || new Set();
  autoGroups = autoGroups || {};
  if(!nodes.length) return {pos:{},W:600,H:300};
  const byId=Object.fromEntries(nodes.map(n=>[n.id,n]));

  /* v11: mapa id -> groupKey (si es miembro de un auto-grupo) */
  const memberToGroup={};
  Object.entries(autoGroups).forEach(([key,g])=>{
    g.members.forEach(mid=>{ memberToGroup[mid]=key; });
  });
  const groupRepresentative={};
  Object.entries(autoGroups).forEach(([key,g])=>{
    groupRepresentative[key]=g.members[0];
  });
  const isRepresentative=(id)=>{
    const k=memberToGroup[id];
    return k && groupRepresentative[k]===id;
  };
  const isNonRepMember=(id)=>{
    const k=memberToGroup[id];
    return k && groupRepresentative[k]!==id;
  };

  /* ch usa el padre PRIMARIO; miembros no-representantes se omiten del árbol */
  const ch=Object.fromEntries(nodes.map(n=>[n.id,[]]));
  const roots=[];
  nodes.forEach(n=>{
    if(isNonRepMember(n.id)) return;
    const pp=primaryParentOf(n);
    if(pp && byId[pp]) ch[pp].push(n.id);
    else roots.push(n.id);
  });

  /* v13: ordenar hijos por nivel jerárquico (master 1 → senior 2 → junior 3 → resto 99).
     Aplica cuando los hijos son admins (tienen cargo con ADMIN) o tienen adminLevel manual.
     Si todos son nivel 99 (no admins), conserva el orden original. */
  Object.keys(ch).forEach(parentId=>{
    const kids = ch[parentId];
    if(kids.length<2) return;
    const conNivel = kids.map(id=>({id, lvl: adminLevelOf(byId[id])}));
    /* Solo reordenar si HAY al menos un admin entre los hijos */
    if(!conNivel.some(x=>x.lvl<99)) return;
    /* sort estable: primero por nivel, luego mantiene orden previo */
    conNivel.sort((a,b)=>{
      if(a.lvl!==b.lvl) return a.lvl-b.lvl;
      return kids.indexOf(a.id) - kids.indexOf(b.id);
    });
    ch[parentId] = conNivel.map(x=>x.id);
  });

  /* ¿este nodo está bajo un ancestro compactado? */
  const compactAncestor={};
  const findCompactAnc=id=>{
    if(compactAncestor[id]!==undefined) return compactAncestor[id];
    const n=byId[id];
    if(!n) return compactAncestor[id]=null;
    const pp=primaryParentOf(n);
    if(!pp) return compactAncestor[id]=null;
    if(compactSet.has(pp)) return compactAncestor[id]=pp;
    return compactAncestor[id]=findCompactAnc(pp);
  };
  nodes.forEach(n=>findCompactAnc(n.id));

  const isCompact=id=>compactAncestor[id]!==null;
  const nodeHeight=id=>{
    if(isCompact(id)) return NHC;
    if(isRepresentative(id)){
      const k=memberToGroup[id];
      return listBoxHeight(autoGroups[k].members.length);
    }
    return byId[id]?.tipo==="grupo"?NHG:NH;
  };
  const nodeWidth=id=>{
    if(isRepresentative(id)) return LW;
    return NW;
  };

  const memo={};
  const sw=id=>{
    if(memo[id]!==undefined) return memo[id];
    const c=ch[id]||[];
    const selfWidth=nodeWidth(id)+GX;
    if(compactSet.has(id) && c.length) return memo[id]=selfWidth;
    if(isCompact(id)) return memo[id]=selfWidth;
    return memo[id]=c.length ? Math.max(selfWidth, c.reduce((s,x)=>s+sw(x),0)) : selfWidth;
  };
  const pos={};
  const place=(id,lx,y)=>{
    const h=nodeHeight(id);
    const w=nodeWidth(id);
    const s=sw(id); pos[id]={x:lx+(s-w)/2,y,h,w,compact:isCompact(id)};
    const kids=ch[id]||[];
    if(!kids.length) return;
    if(compactSet.has(id)){
      let cy=y+h+GY;
      kids.forEach(c=>{ place(c, lx+(s-nodeWidth(c))/2, cy); cy+=NHC+GYC; });
    } else {
      let cx=lx;
      kids.forEach(c=>{place(c,cx,y+h+GY);cx+=sw(c);});
    }
  };
  let rx=GX; roots.forEach(r=>{place(r,rx,GY);rx+=sw(r)+GX;});

  /* Reubicar al centroide de jefes: aplica tanto a representantes (caja-lista) como a nodos normales multi-jefe */
  const repNodes = nodes
    .filter(n => isRepresentative(n.id) && pos[n.id])
    .sort((a,b)=> (pos[a.id]?.y||0) - (pos[b.id]?.y||0));
  repNodes.forEach(n=>{
    const parents=parentsOf(n).filter(pid=>pos[pid]);
    if(parents.length<1) return;
    const centerXs=parents.map(pid=>pos[pid].x + (pos[pid].w||NW)/2);
    const avg=centerXs.reduce((s,x)=>s+x,0)/centerXs.length;
    const newX=avg - LW/2;
    const deltaX=newX - pos[n.id].x;
    const mover=(id)=>{
      pos[id].x += deltaX;
      (ch[id]||[]).forEach(mover);
    };
    mover(n.id);
  });

  const multiNodes = nodes
    .filter(n => !isRepresentative(n.id) && !isNonRepMember(n.id) && parentsOf(n).length>1 && pos[n.id])
    .sort((a,b)=> (pos[a.id]?.y||0) - (pos[b.id]?.y||0));
  multiNodes.forEach(n=>{
    const parents=parentsOf(n).filter(pid=>pos[pid]);
    if(parents.length<2) return;
    const centerXs=parents.map(pid=>pos[pid].x + (pos[pid].w||NW)/2);
    const avg=centerXs.reduce((s,x)=>s+x,0)/centerXs.length;
    const newX=avg - NW/2;
    const deltaX=newX - pos[n.id].x;
    const mover=(id)=>{
      pos[id].x += deltaX;
      (ch[id]||[]).forEach(mover);
    };
    mover(n.id);
  });

  const xs=Object.values(pos).map(p=>p.x), ys=Object.values(pos).map(p=>p.y);
  const mnx=Math.min(...xs)-GX, mny=Math.min(...ys)-GY;
  Object.keys(pos).forEach(id=>{pos[id].x-=mnx; pos[id].y-=mny;});
  const maxX=Math.max(...Object.values(pos).map(p=>p.x+(p.w||NW)));
  const maxY=Math.max(...Object.values(pos).map(p=>p.y+p.h));
  return {pos,W:maxX+GX,H:maxY+GY};
}

const ini=n=>(n||"").split(" ").map(w=>w[0]).filter(Boolean).slice(0,2).join("").toUpperCase()||"?";
const trunc=(s="",mx=22)=>s.length>mx?s.slice(0,mx-1)+"…":s;

/* v13: ícono de caña de azúcar (corporativo Cañaveral) */
const CanaIcon = ({size=16, color="#ffffff"})=>(
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    {/* Tallo principal con segmentos */}
    <path d="M12 22 L12 4" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M9.8 7.5 L14.2 7.5" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M9.8 11 L14.2 11" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M9.8 14.5 L14.2 14.5" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M9.8 18 L14.2 18" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    {/* Hojas izquierda */}
    <path d="M12 5 Q7 3 4 6 Q7 5 10 7" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none"/>
    <path d="M12 9 Q8 8 5.5 10.5 Q8 10 10.5 11" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none"/>
    {/* Hojas derecha */}
    <path d="M12 5 Q17 3 20 6 Q17 5 14 7" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none"/>
    <path d="M12 9 Q16 8 18.5 10.5 Q16 10 13.5 11" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none"/>
  </svg>
);
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
  /* v12: tipo de línea de conexión global */
  const [lineStyle, setLineStyle] = useState("curved"); // 'curved' | 'orthogonal' | 'straight'
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
  const [editPIds, setEditPIds] = useState([]);
  const [editFoto, setEditFoto] = useState("");
  const [bossQ,    setBossQ]    = useState("");

  /* quick-add connection */
  const [quickAdd, setQuickAdd] = useState(null); // {person, parentId:"", q:""}

  /* ── v7: modo compacto (lista) por nodo. Set con IDs cuyos DESCENDIENTES se renderizan compactos ── */
  const [compactSet, setCompactSet] = useState(() => new Set());

  /* ── v7: modo "asignar jefe visual" — cuando está activo, el próximo clic en un nodo del canvas
     define el nuevo jefe de assignBossFor ── */
  const [assignBossFor, setAssignBossFor] = useState(null); // id de la persona a la que le estamos buscando jefe
  /* v11: agregar persona a caja-lista (hereda jefes) */
  const [addToListKey, setAddToListKey] = useState(null);
  const [addToListQ, setAddToListQ] = useState("");
  /* v11.1: filtros y jefes extra en el modal */
  const [addToListFilters, setAddToListFilters] = useState({sede:[], cargo:[], dept:[]});
  /* v12.4: modal de nueva persona manual al roster */
  const [newPersonOpen, setNewPersonOpen] = useState(false);
  const [newPerson, setNewPerson] = useState({nombre:"",cargo:"",area:"",dept:"",email:"",foto:""});
  const [addToListExtraBosses, setAddToListExtraBosses] = useState([]); // ids de jefes extra a agregar a TODA la lista + nuevas personas
  const [addToListBossQ, setAddToListBossQ] = useState("");

  /* ── v5: memoria portable (sin localStorage) ── */
  const [dirty, setDirty] = useState(false);
  const [memFileName, setMemFileName] = useState("");
  const memRef = useRef(null);

  /* ── v5: edición extendida (datos adicionales, además de jefe+foto) ── */
  const [editNombre, setEditNombre] = useState("");
  /* v12: color personalizado para grupos */
  const [editColor, setEditColor] = useState("");
  const [editCargo,  setEditCargo]  = useState("");
  const [editArea,   setEditArea]   = useState("");
  const [editDept,   setEditDept]   = useState("");
  const [editEmail,  setEditEmail]  = useState("");
  /* v13: nivel admin (override manual) */
  const [editAdminLevel, setEditAdminLevel] = useState("");

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
  /* v12: gcol ahora puede recibir el nodo entero o el índice; si el nodo tiene customColor, lo usa */
  const gcol=arg=>{
    if(typeof arg==="object" && arg && arg.customColor){
      const c=arg.customColor;
      /* derivar bg/border/text desde el color custom */
      return {bg:c+"22",border:c,text:"#fff"};
    }
    const i = typeof arg==="object" ? (arg?.colorIdx??0) : (arg??0);
    return GPAL[i%GPAL.length];
  };

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


  /* ── v11: auto-agrupamiento. Subordinados que comparten EXACTAMENTE el mismo conjunto de jefes
     (cuando son >=3) se muestran como caja-lista única. Clave: conjunto ordenado de parentIds. ── */
  const MIN_GROUP_SIZE = 3;
  const autoGroups = useMemo(()=>{
    const byId=Object.fromEntries(nodes.map(n=>[n.id,n]));
    const map=new Map();
    nodes.forEach(n=>{
      if(n.tipo!=="persona") return;
      const ps=parentsOf(n);
      if(ps.length===0) return;
      /* v11 fix: solo agrupar cuando TODOS los jefes son PERSONAS (no sedes/grupos).
         Los admins (hijos de sedes 🏢) siempre van como tarjeta grande con foto. */
      const todosSonPersonas = ps.every(pid=>{
        const jefe=byId[pid];
        return jefe && jefe.tipo==="persona";
      });
      if(!todosSonPersonas) return;
      const key=[...ps].sort().join("|");
      if(!map.has(key)) map.set(key,{parents:[...ps].sort(),members:[]});
      map.get(key).members.push(n.id);
    });
    const groups={};
    for(const [key,val] of map.entries()){
      if(val.members.length>=MIN_GROUP_SIZE){
        groups[key]=val;
      }
    }
    return groups;
  },[nodes]);

  const groupedPersonIds = useMemo(()=>{
    const s=new Set();
    Object.values(autoGroups).forEach(g=>g.members.forEach(id=>s.add(id)));
    return s;
  },[autoGroups]);

  const {pos,W,H}=useMemo(()=>buildLayout(nodes,compactSet,autoGroups),[nodes,compactSet,autoGroups]);
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
      /* v12.5: reconocer columna 'retirado' al re-importar */
      const retiradoRaw = row["retirado"]||row["Retirado"]||row["RETIRADO"]||"";
      const retirado = String(retiradoRaw).trim().toUpperCase()==="SI" || String(retiradoRaw).trim().toUpperCase()==="TRUE" || String(retiradoRaw).trim()==="1";
      return{id:get(row,"id")||`r${i}_${Date.now()}`,nombre,cargo:get(row,"cargo"),area:get(row,"area"),dept:get(row,"dept"),email:String(emailRaw).trim(),foto:"",tipo:"persona",...(retirado?{retirado:true}:{})};
    }).filter(Boolean);

    /* Primera vez: comportamiento IDÉNTICO a v3 */
    if(impMode==="initial"){
      suppressDirty.current=1; // primer import no debe marcar dirty
      /* v12: detectar si el formato es APELLIDOS NOMBRES y avisar */
      let rosterFinal=newRoster;
      if(detectarFormatoApellidosPrimero(newRoster)){
        if(confirm(`Detecté que los nombres están en formato APELLIDOS NOMBRES (ejemplo: "${newRoster.find(r=>r.nombre)?.nombre||"..."}").\n\n¿Quieres invertirlos al formato NOMBRES APELLIDOS automáticamente?\n\n(Puedes hacerlo después manualmente con el botón "Reordenar nombres")`)){
          rosterFinal=newRoster.map(r=>({...r, nombre: invertirNombre(r.nombre)}));
        }
      }
      setRoster(rosterFinal); setNodes([]); setSel(null);
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
    if(r.retirado){
      if(!confirm(`⚠️ ${r.nombre} está marcado como RETIRADO en el roster.\n\n¿Agregarlo al chart de todos modos?`)) return;
    }
    if(nodes.length===0){ setNodes(p=>[...p,{...r,parentId:"",tipo:"persona"}]); return; }
    setQuickAdd({person:r,parentIds:[],q:""});
  };

  /* v12.4: agregar persona MANUAL al roster (no del Excel) */
  const addNewPersonToRoster=()=>{
    if(!newPerson.nombre.trim()){ alert("El nombre es obligatorio"); return; }
    const nueva={
      id: `manual_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      nombre: newPerson.nombre.trim(),
      cargo: newPerson.cargo.trim(),
      area: newPerson.area.trim(),
      dept: newPerson.dept.trim(),
      email: newPerson.email.trim(),
      foto: newPerson.foto||"",
      tipo: "persona",
      manual: true, /* marca para identificar que fue agregada manualmente */
    };
    setRoster(r=>[nueva, ...r]);
    setNewPersonOpen(false);
    setNewPerson({nombre:"",cargo:"",area:"",dept:"",email:"",foto:""});
  };

  /* v12.5: descargar roster como Excel respetando columnas exactas del maestro original + columna retirado */
  const exportRosterXLSX=()=>{
    if(!roster.length){ alert("No hay roster que exportar"); return; }
    if(!window.XLSX){ alert("Librería Excel no cargada, intenta de nuevo en 2 segundos"); return; }
    const rows = roster.map(r=>({
      "Codigo Unico": r.id,
      "Empleado": r.nombre,
      "Nombre del empleado": r.nombre,
      "Descripcion C.O.": r.area||"",
      "Descripcion del cargo": r.cargo||"",
      "Descripcion ccosto": r.dept||"",
      "Email del contacto": r.email||"",
      "retirado": r.retirado ? "SI" : "",
    }));
    const ws = window.XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      {wch:14}, {wch:30}, {wch:30}, {wch:22}, {wch:25}, {wch:22}, {wch:28}, {wch:10}
    ];
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Roster");
    const fecha = new Date().toISOString().slice(0,10);
    window.XLSX.writeFile(wb, `roster_canaveral_${fecha}.xlsx`);
  };
  const confirmQuickAdd=()=>{
    if(!quickAdd)return;
    const pids=quickAdd.parentIds||[];
    const base={...quickAdd.person,tipo:"persona"};
    delete base.parentId; delete base.parentIds;
    if(pids.length===0) base.parentId="";
    else if(pids.length===1) base.parentId=pids[0];
    else base.parentIds=pids;
    setNodes(p=>[...p,base]);
    setQuickAdd(null);
  };
  /* toggle un jefe en el quickAdd */
  const toggleQuickAddParent=(pid)=>{
    setQuickAdd(f=>{
      if(!f) return f;
      const cur=f.parentIds||[];
      const nu = cur.includes(pid) ? cur.filter(x=>x!==pid) : [...cur, pid];
      return {...f, parentIds:nu};
    });
  };

  /* ── Agregar grupo ── */
  const addGrupo=()=>{
    const nombre=grpForm.source==="columna"?grpForm.sourceVal:grpForm.nombre;
    if(!nombre.trim())return;
    setNodes(p=>[...p,{id:`g${Date.now()}`,nombre,colorIdx:grpForm.colorIdx,parentId:grpForm.parentId,tipo:"grupo",...(grpForm.source==="columna"?{sourceCol:grpForm.sourceCol,sourceVal:nombre}:{})}]);
    setGrpForm({nombre:"",colorIdx:0,parentId:"",source:"manual",sourceCol:"area",sourceVal:""});
  };

  /* ── v8: Editar (jefes múltiples + foto + datos) ── */
  const openEdit=n=>{
    setEditId(n.id);
    setEditPIds(parentsOf(n));
    setEditFoto(n.foto||""); setBossQ("");
    setEditNombre(n.nombre||""); setEditCargo(n.cargo||""); setEditArea(n.area||""); setEditDept(n.dept||""); setEditEmail(n.email||"");
    setEditAdminLevel(n.adminLevel||""); /* v13 */
    setEditColor(n.customColor||""); /* v12 */
    setPanel("edit");
  };
  const saveEdit=()=>{
    setNodes(p=>p.map(n=>{
      if(n.id!==editId) return n;
      const base=n.tipo==="grupo"
        ? {...n, nombre:editNombre||n.nombre, customColor:editColor||undefined}
        : {...n,foto:editFoto,nombre:editNombre,cargo:editCargo,area:editArea,dept:editDept,email:editEmail,adminLevel:editAdminLevel||undefined};
      if(n.tipo==="grupo" && !editColor) delete base.customColor;
      if(n.tipo==="persona" && !editAdminLevel) delete base.adminLevel; /* v13 */
      delete base.parentId;
      delete base.parentIds;
      if(editPIds.length===0) base.parentId="";
      else if(editPIds.length===1) base.parentId=editPIds[0];
      else base.parentIds=[...editPIds];
      return base;
    }));
    if(editId){
      const isGrp = nodes.find(n=>n.id===editId)?.tipo==="grupo";
      if(!isGrp) setRoster(r=>r.map(x=>x.id===editId?{...x,nombre:editNombre,cargo:editCargo,area:editArea,dept:editDept,email:editEmail,foto:editFoto,adminLevel:editAdminLevel||undefined}:x));
    }
    setPanel(null); setSel(null); setEditId(null);
  };
  /* v8: delNode debe quitar el nodo de todas las listas de jefes de otros */
  const delNode=id=>{
    setNodes(p=>p.filter(n=>n.id!==id).map(n=>{
      const ps=parentsOf(n);
      if(!ps.includes(id)) return n;
      const next=ps.filter(x=>x!==id);
      const upd={...n};
      delete upd.parentId; delete upd.parentIds;
      if(next.length===0) upd.parentId="";
      else if(next.length===1) upd.parentId=next[0];
      else upd.parentIds=next;
      return upd;
    }));
    setSel(null); setPanel(null); setEditId(null);
  };
  const uploadFoto=e=>{ const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=ev=>setEditFoto(ev.target.result); r.readAsDataURL(f); };

  /* ── Boss search combinado (roster + nodos grupo) ── */
  const bossResults=useMemo(()=>{
    if(!bossQ.trim()) return [];
    const q=bossQ.toLowerCase();
    const fromRoster=roster.filter(r=>!r.retirado && r.id!==editId&&[r.nombre,r.cargo,r.area].some(v=>(v||"").toLowerCase().includes(q))).slice(0,20).map(r=>({...r,enChart:inChart.has(r.id)}));
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

  /* ── v8: ¿candidato es descendiente de ancestro? BFS considerando multi-padres ── */
  const esDescendiente=(candidatoId, ancestroId)=>{
    const byId=Object.fromEntries(nodes.map(n=>[n.id,n]));
    const visitados=new Set();
    const stack=[candidatoId];
    while(stack.length){
      const id=stack.pop();
      if(visitados.has(id)) continue;
      visitados.add(id);
      const n=byId[id];
      if(!n) continue;
      const ps=parentsOf(n);
      for(const pid of ps){
        if(pid===ancestroId) return true;
        stack.push(pid);
      }
    }
    return false;
  };

  /* v11: helper — ¿assignBossFor apunta a una caja-lista? */
  const assignIsList = assignBossFor && typeof assignBossFor==="string" && assignBossFor.startsWith("list:");
  const assignListKey = assignIsList ? assignBossFor.slice(5) : null;
  const assignListMembers = assignIsList && autoGroups[assignListKey] ? autoGroups[assignListKey].members : [];

  /* ── v8+v11: toggle de jefe. Soporta:
     - assignBossFor = "<id persona>" → toggle en esa persona
     - assignBossFor = "list:<groupKey>" → toggle EN TODOS los miembros de la caja-lista (agrega si falta a alguno) ── */
  const onAssignBossClick=(targetId)=>{
    if(!assignBossFor) return false;

    /* Modo lista: asignar a todos los miembros del grupo */
    if(assignIsList){
      if(assignListMembers.includes(targetId)){
        alert("No puedes elegir a un miembro de la lista como jefe de la misma lista");
        return true;
      }
      /* Ciclos: verificar que targetId no sea descendiente de NINGÚN miembro */
      for(const mid of assignListMembers){
        if(esDescendiente(targetId,mid)){
          alert("No puedes elegir un subordinado como jefe (crearía un ciclo)");
          return true;
        }
      }
      /* ¿todos los miembros ya tienen targetId como jefe? → toggle off para todos.
         ¿alguno no lo tiene? → agregarlo a los que no. (comportamiento AGREGAR) */
      const byId_=Object.fromEntries(nodes.map(n=>[n.id,n]));
      const todosLoTienen = assignListMembers.every(mid=>parentsOf(byId_[mid]).includes(targetId));
      setNodes(p=>p.map(n=>{
        if(!assignListMembers.includes(n.id)) return n;
        const ps=parentsOf(n);
        let next;
        if(todosLoTienen){
          /* quitarlo */
          next=ps.filter(x=>x!==targetId);
        } else {
          /* agregarlo si no lo tiene */
          next = ps.includes(targetId) ? ps : [...ps, targetId];
        }
        const updated={...n};
        delete updated.parentId;
        delete updated.parentIds;
        if(next.length===0) updated.parentId="";
        else if(next.length===1) updated.parentId=next[0];
        else updated.parentIds=next;
        return updated;
      }));
      return true;
    }

    /* Modo persona (igual que antes) */
    if(targetId===assignBossFor){
      setAssignBossFor(null);
      return true;
    }
    if(esDescendiente(targetId,assignBossFor)){
      alert("No puedes elegir un subordinado como jefe (crearía un ciclo)");
      return true;
    }
    setNodes(p=>p.map(n=>{
      if(n.id!==assignBossFor) return n;
      const ps=parentsOf(n);
      let next;
      if(ps.includes(targetId)){
        next=ps.filter(x=>x!==targetId);
      } else {
        next=[...ps,targetId];
      }
      const updated={...n};
      delete updated.parentId;
      delete updated.parentIds;
      if(next.length===0){
        updated.parentId="";
      } else if(next.length===1){
        updated.parentId=next[0];
      } else {
        updated.parentIds=next;
      }
      return updated;
    }));
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
    const prevVp={...vp};
    const el=chartRef.current;
    const prevStyle={
      position:el.style.position,
      inset:el.style.inset,
      width:el.style.width,
      height:el.style.height,
      overflow:el.style.overflow,
      left:el.style.left,
      top:el.style.top,
    };
    try{
      const h2c=window.html2canvas;
      const jsPDF=window.jspdf?.jsPDF;
      if(!h2c||!jsPDF){setPdfLoading(false);alert("Librerías PDF cargando, intenta en 2 segundos.");return;}

      /* Resetear viewport */
      setVp({x:0,y:0,s:1});
      /* Esperar varios frames a que React + el browser hagan layout */
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      await new Promise(r=>setTimeout(r,400));

      /* Expandir el chartRef para que h2c vea todo */
      el.style.position="absolute";
      el.style.inset="auto";
      el.style.left="0";
      el.style.top="0";
      el.style.width=W+"px";
      el.style.height=H+"px";
      el.style.overflow="visible";

      /* Dar 2 frames más para que el browser repinte con el nuevo tamaño */
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      await new Promise(r=>setTimeout(r,300));

      const canvas=await h2c(el,{
        scale:2,
        backgroundColor:"#F8FAFC",
        useCORS:true,
        allowTaint:false,
        logging:false,
        foreignObjectRendering:false,
        width:W,
        height:H,
        windowWidth:W,
        windowHeight:H,
        x:0,
        y:0,
        scrollX:0,
        scrollY:0,
      });

      /* Validar que el canvas tiene contenido (no todo blanco) */
      if(canvas.width<10||canvas.height<10){
        throw new Error(`Canvas vacío (${canvas.width}x${canvas.height}). Recarga la página y vuelve a intentar.`);
      }

      const imgData=canvas.toDataURL("image/png");
      const w2=canvas.width/2, h2=canvas.height/2;
      const pdf=new jsPDF({orientation: w2>h2?"landscape":"portrait",unit:"px",format:[w2,h2]});
      pdf.addImage(imgData,"PNG",0,0,w2,h2);
      pdf.save(`organigrama_${new Date().toISOString().slice(0,10)}.pdf`);
    }catch(err){console.error("PDF error:",err);alert("Error al generar PDF: "+err.message+"\n\nPrueba a recargar la página y reintentar.");}
    /* Restaurar SIEMPRE */
    Object.entries(prevStyle).forEach(([k,v])=>{ el.style[k]=v||""; });
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
  /* v8: edges ahora es multi — una arista por cada par (padre, hijo) */
  const edges=useMemo(()=>{
    const arr=[];
    /* v12: helper que genera path SVG según lineStyle */
    const buildPath = (x1,y1,x2,y2)=>{
      if(lineStyle==="straight"){
        return `M${x1} ${y1}L${x2} ${y2}`;
      }
      if(lineStyle==="orthogonal"){
        const my=(y1+y2)/2;
        return `M${x1} ${y1}L${x1} ${my}L${x2} ${my}L${x2} ${y2}`;
      }
      /* curved (default) */
      const my=(y1+y2)/2;
      return `M${x1} ${y1}C${x1} ${my} ${x2} ${my} ${x2} ${y2}`;
    };
    /* path para conexión a fila de caja-lista (sale del padre, llega al borde izquierdo de la fila) */
    const buildRowPath = (x1,y1,x2,y2)=>{
      if(lineStyle==="straight"){
        return `M${x1} ${y1}L${x2} ${y2}`;
      }
      if(lineStyle==="orthogonal"){
        const mx=x2-20;
        return `M${x1} ${y1}L${x1} ${y2}L${x2} ${y2}`;
      }
      /* curved */
      return `M${x1} ${y1}C${x1} ${(y1+y2)/2} ${x2-30} ${y2} ${x2} ${y2}`;
    };

    const memberInfo=(id)=>{
      for(const [key,g] of Object.entries(autoGroups)){
        const idx=g.members.indexOf(id);
        if(idx>=0) return {rep:g.members[0], rowIndex:idx};
      }
      return null;
    };
    nodes.forEach(n=>{
      const info=memberInfo(n.id);
      const parents=parentsOf(n);
      if(info){
        const repPos=pos[info.rep];
        if(!repPos) return;
        parents.forEach(pid=>{
          if(!pos[pid]) return;
          const p=pos[pid];
          const ph=p.h||NH, pw=p.w||NW;
          const x1=p.x+pw/2, y1=p.y+ph;
          const rowY = repPos.y + LIST_HEAD + info.rowIndex*LIST_ROW + LIST_ROW/2;
          const x2 = repPos.x;
          const y2 = rowY;
          const active = sel===n.id || sel===pid;
          arr.push({
            key:`${pid}->${n.id}-row`,
            d: buildRowPath(x1,y1,x2,y2),
            active,
            thin:true,
          });
        });
        return;
      }
      if(!pos[n.id]) return;
      parents.forEach(pid=>{
        if(!pos[pid]) return;
        const p=pos[pid], c=pos[n.id];
        const ph=p.h||NH, pw=p.w||NW, cw=c.w||NW;
        const x1=p.x+pw/2, y1=p.y+ph, x2=c.x+cw/2, y2=c.y;
        const active=sel===n.id||sel===pid;
        arr.push({
          key:`${pid}->${n.id}`,
          d: buildPath(x1,y1,x2,y2),
          active,
          multi: parents.length>1,
        });
      });
    });
    return arr;
  },[nodes,pos,sel,autoGroups,lineStyle]);

  const selNode=nodes.find(n=>n.id===sel);
  const editNode=nodes.find(n=>n.id===editId);

  return(
    <div style={{display:"flex",flexDirection:"column",height:660,fontFamily:"system-ui,-apple-system,sans-serif",background:"#F8FAFC",overflow:"hidden"}}>
      <style>{CSS}</style>

      {/* v8+v11: Banner modo asignar jefe (persona individual O lista completa) */}
      {assignBossFor && (()=>{
        if(assignIsList){
          /* Modo lista */
          const miembros = assignListMembers.map(mid=>nodes.find(x=>x.id===mid)).filter(Boolean);
          /* jefes COMUNES (que todos los miembros ya tienen) */
          const conteo={};
          miembros.forEach(m=>parentsOf(m).forEach(pid=>{conteo[pid]=(conteo[pid]||0)+1;}));
          const jefesComunes = Object.entries(conteo).filter(([,n])=>n===miembros.length).map(([pid])=>pid).map(pid=>nodes.find(x=>x.id===pid)).filter(Boolean);
          return(
            <div style={{background:"#DBEAFE",borderBottom:"2px solid #3B82F6",padding:"8px 14px",display:"flex",alignItems:"center",gap:10,flexShrink:0,flexWrap:"wrap"}}>
              <span style={{fontSize:18}}>📋🔗</span>
              <div style={{flex:1,fontSize:13,color:"#1E3A8A",minWidth:0}}>
                <div><strong>Asignar jefes a LISTA de {miembros.length} personas</strong></div>
                <div style={{fontSize:11,marginTop:2}}>
                  Lo que marques se AGREGA a los jefes actuales de cada miembro · Clic de nuevo en un jefe común para quitarlo a todos ·
                  <kbd style={{margin:"0 4px",padding:"1px 6px",background:"#fff",border:"1px solid #3B82F6",borderRadius:4,fontSize:10,fontFamily:"monospace"}}>Esc</kbd>
                  o <strong>Hecho</strong>
                </div>
                {jefesComunes.length>0 && (
                  <div style={{marginTop:4,display:"flex",flexWrap:"wrap",gap:4,alignItems:"center"}}>
                    <span style={{fontSize:11,fontWeight:600}}>Jefes comunes ({jefesComunes.length}):</span>
                    {jefesComunes.map(j=>(
                      <span key={j.id} style={{fontSize:10,padding:"2px 7px",background:"#fff",border:"1px solid #3B82F6",borderRadius:10,color:"#1E3A8A",fontWeight:600}}>
                        {j.tipo==="grupo"?"🏢 ":""}{j.nombre}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button className="btn p" style={{fontSize:12}} onClick={()=>setAssignBossFor(null)}>✓ Hecho</button>
            </div>
          );
        }
        /* Modo persona individual */
        const origen=nodes.find(x=>x.id===assignBossFor);
        const jefesActuales = origen ? parentsOf(origen).map(pid=>nodes.find(x=>x.id===pid)).filter(Boolean) : [];
        return(
          <div style={{background:"#FEF3C7",borderBottom:"2px solid #F59E0B",padding:"8px 14px",display:"flex",alignItems:"center",gap:10,flexShrink:0,flexWrap:"wrap"}}>
            <span style={{fontSize:18}}>🔗</span>
            <div style={{flex:1,fontSize:13,color:"#78350F",minWidth:0}}>
              <div><strong>Asignar jefes a:</strong> {origen?.nombre||"—"}</div>
              <div style={{fontSize:11,marginTop:2}}>
                Clic en un nodo para <strong>agregar/quitar</strong> como jefe · Puedes asignar varios ·
                <kbd style={{margin:"0 4px",padding:"1px 6px",background:"#fff",border:"1px solid #D97706",borderRadius:4,fontSize:10,fontFamily:"monospace"}}>Esc</kbd>
                o <strong>Hecho</strong> para salir
              </div>
              {jefesActuales.length>0 && (
                <div style={{marginTop:4,display:"flex",flexWrap:"wrap",gap:4,alignItems:"center"}}>
                  <span style={{fontSize:11,fontWeight:600}}>Actuales ({jefesActuales.length}):</span>
                  {jefesActuales.map(j=>(
                    <span key={j.id} style={{fontSize:10,padding:"2px 7px",background:"#fff",border:"1px solid #D97706",borderRadius:10,color:"#78350F",fontWeight:600}}>
                      {j.tipo==="grupo"?"🏢 ":""}{j.nombre}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button className="btn p" style={{fontSize:12}} onClick={()=>setAssignBossFor(null)}>✓ Hecho</button>
          </div>
        );
      })()}

      {/* v12.4: Modal nueva persona manual al roster */}
      {newPersonOpen && (
        <div onClick={()=>setNewPersonOpen(false)} style={{position:"fixed",inset:0,background:"rgba(15,23,42,.5)",zIndex:99,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{width:460,maxWidth:"92vw",maxHeight:"88vh",background:"#fff",borderRadius:14,boxShadow:"0 20px 60px rgba(0,0,0,.3)",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{padding:"14px 18px",borderBottom:"1px solid #E2E8F0",background:"#F0FDF4"}}>
              <div style={{fontSize:15,fontWeight:700,color:"#0F172A"}}>➕ Nueva persona al roster</div>
              <div style={{fontSize:11,color:"#64748B",marginTop:3}}>Crea una persona manualmente sin tocar el Excel maestro</div>
            </div>
            <div style={{padding:"16px 18px",overflowY:"auto",flex:1,display:"flex",flexDirection:"column",gap:10}}>
              <div>
                <label style={{display:"block",fontSize:12,fontWeight:600,color:"#334155",marginBottom:4}}>Nombre completo *</label>
                <input className="inp" autoFocus value={newPerson.nombre} onChange={e=>setNewPerson(p=>({...p,nombre:e.target.value}))} placeholder="Ej: JUAN PEREZ GOMEZ"/>
              </div>
              <div>
                <label style={{display:"block",fontSize:12,fontWeight:600,color:"#334155",marginBottom:4}}>Cargo</label>
                <input className="inp" value={newPerson.cargo} onChange={e=>setNewPerson(p=>({...p,cargo:e.target.value}))} placeholder="Ej: SUPERVISOR DE CAJAS"/>
              </div>
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:1}}>
                  <label style={{display:"block",fontSize:12,fontWeight:600,color:"#334155",marginBottom:4}}>Sede</label>
                  <input className="inp" value={newPerson.area} onChange={e=>setNewPerson(p=>({...p,area:e.target.value}))} placeholder="Ej: SC PALMITEX" list="sede-options-new"/>
                  <datalist id="sede-options-new">
                    {[...new Set(roster.map(r=>r.area).filter(Boolean))].sort().map(s=><option key={s} value={s}/>)}
                  </datalist>
                </div>
                <div style={{flex:1}}>
                  <label style={{display:"block",fontSize:12,fontWeight:600,color:"#334155",marginBottom:4}}>Depto</label>
                  <input className="inp" value={newPerson.dept} onChange={e=>setNewPerson(p=>({...p,dept:e.target.value}))} placeholder="Opcional" list="dept-options-new"/>
                  <datalist id="dept-options-new">
                    {[...new Set(roster.map(r=>r.dept).filter(Boolean))].sort().map(d=><option key={d} value={d}/>)}
                  </datalist>
                </div>
              </div>
              <div>
                <label style={{display:"block",fontSize:12,fontWeight:600,color:"#334155",marginBottom:4}}>Email</label>
                <input className="inp" type="email" value={newPerson.email} onChange={e=>setNewPerson(p=>({...p,email:e.target.value}))} placeholder="opcional@empresa.com"/>
              </div>
            </div>
            <div style={{padding:"10px 18px",borderTop:"1px solid #E2E8F0",display:"flex",justifyContent:"flex-end",gap:8,background:"#F8FAFC"}}>
              <button onClick={()=>setNewPersonOpen(false)} style={{padding:"7px 14px",borderRadius:8,border:"1px solid #CBD5E1",background:"#fff",cursor:"pointer",fontSize:12,fontWeight:600}}>Cancelar</button>
              <button onClick={addNewPersonToRoster} disabled={!newPerson.nombre.trim()} style={{padding:"7px 14px",borderRadius:8,border:"none",background:newPerson.nombre.trim()?"#22C55E":"#CBD5E1",color:"#fff",cursor:newPerson.nombre.trim()?"pointer":"not-allowed",fontSize:12,fontWeight:600}}>✓ Crear persona</button>
            </div>
          </div>
        </div>
      )}

      {/* v11.1: Modal "Agregar persona a esta lista" — con filtros y gestión de jefes extra */}
      {addToListKey && autoGroups[addToListKey] && (()=>{
        const grupo=autoGroups[addToListKey];
        const jefesBase = grupo.parents.map(pid=>nodes.find(x=>x.id===pid)).filter(Boolean);
        const jefesExtra = addToListExtraBosses.map(pid=>nodes.find(x=>x.id===pid)).filter(Boolean);
        const jefesFinal = [...grupo.parents, ...addToListExtraBosses];
        const jefesFinalNodes = [...jefesBase, ...jefesExtra];

        /* Opciones de filtro dinámicas del roster */
        const sedeOptions = [...new Set(roster.map(r=>r.area).filter(Boolean))].sort();
        const cargoOptions = [...new Set(roster.map(r=>r.cargo).filter(Boolean))].sort();
        const deptOptions = [...new Set(roster.map(r=>r.dept).filter(Boolean))].sort();

        const q = addToListQ.trim().toLowerCase();
        const yaEnChart = new Set(nodes.map(n=>n.id));

        /* Candidatos: aplicar filtros + búsqueda */
        const filtrados = roster.filter(r=>{
          if(r.retirado) return false; /* v12.3: ocultar retirados */
          if(yaEnChart.has(r.id)) return false;
          if(addToListFilters.sede.length && !addToListFilters.sede.includes(r.area)) return false;
          if(addToListFilters.cargo.length && !addToListFilters.cargo.includes(r.cargo)) return false;
          if(addToListFilters.dept.length && !addToListFilters.dept.includes(r.dept)) return false;
          if(q && ![r.nombre,r.cargo,r.area,r.dept].some(v=>(v||"").toLowerCase().includes(q))) return false;
          return true;
        });
        const hayFiltros = q || addToListFilters.sede.length || addToListFilters.cargo.length || addToListFilters.dept.length;
        const candidatos = filtrados.slice(0,30);
        const totalFiltrados = filtrados.length;

        /* Búsqueda de jefes extra: entre nodos del chart */
        const bossQ_ = addToListBossQ.trim().toLowerCase();
        const jefesDisponibles = bossQ_
          ? nodes.filter(n=>!jefesFinal.includes(n.id) && [n.nombre,n.cargo,n.area].some(v=>(v||"").toLowerCase().includes(bossQ_))).slice(0,15)
          : [];

        const addToList=(r)=>{
          const base={...r,tipo:"persona"};
          delete base.parentId; delete base.parentIds;
          if(jefesFinal.length===1) base.parentId=jefesFinal[0];
          else if(jefesFinal.length>1) base.parentIds=[...jefesFinal];
          setNodes(p=>[...p,base]);
        };

        /* Aplicar jefes extra a los miembros EXISTENTES de la lista cuando se cierra el modal */
        const cerrarYAplicar=()=>{
          if(addToListExtraBosses.length>0){
            setNodes(p=>p.map(n=>{
              if(!grupo.members.includes(n.id)) return n;
              const ps=parentsOf(n);
              const next=[...ps];
              addToListExtraBosses.forEach(pid=>{ if(!next.includes(pid)) next.push(pid); });
              const upd={...n};
              delete upd.parentId; delete upd.parentIds;
              if(next.length===1) upd.parentId=next[0];
              else upd.parentIds=next;
              return upd;
            }));
          }
          setAddToListKey(null);
          setAddToListExtraBosses([]);
          setAddToListBossQ("");
          setAddToListQ("");
          setAddToListFilters({sede:[],cargo:[],dept:[]});
        };

        const toggleFilter=(tipo,val)=>{
          setAddToListFilters(f=>{
            const arr=f[tipo];
            const next = arr.includes(val) ? arr.filter(x=>x!==val) : [...arr,val];
            return {...f,[tipo]:next};
          });
        };
        const limpiarFiltros=()=>setAddToListFilters({sede:[],cargo:[],dept:[]});
        const totalFiltros = addToListFilters.sede.length+addToListFilters.cargo.length+addToListFilters.dept.length;

        return(
          <div onClick={cerrarYAplicar} style={{position:"fixed",inset:0,background:"rgba(15,23,42,.5)",zIndex:99,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div onClick={e=>e.stopPropagation()} style={{width:560,maxWidth:"92vw",maxHeight:"88vh",background:"#fff",borderRadius:14,boxShadow:"0 20px 60px rgba(0,0,0,.3)",display:"flex",flexDirection:"column",overflow:"hidden"}}>

              {/* Header con info de jefes */}
              <div style={{padding:"14px 18px",borderBottom:"1px solid #E2E8F0",background:"#F0FDF4"}}>
                <div style={{fontSize:15,fontWeight:700,color:"#0F172A",marginBottom:4}}>➕ Agregar persona a esta lista</div>
                <div style={{fontSize:12,color:"#64748B"}}>Las personas agregadas heredarán estos {jefesFinalNodes.length} jefe{jefesFinalNodes.length!==1?"s":""}:</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>
                  {jefesBase.map(j=>(
                    <span key={j.id} style={{fontSize:11,padding:"3px 9px",background:"#fff",border:"1px solid #22C55E",borderRadius:10,color:"#15803D",fontWeight:600}}>
                      {j.tipo==="grupo"?"🏢 ":"👤 "}{j.nombre}
                    </span>
                  ))}
                  {jefesExtra.map(j=>(
                    <span key={j.id} style={{fontSize:11,padding:"3px 4px 3px 9px",background:"#DBEAFE",border:"1px solid #3B82F6",borderRadius:10,color:"#1E40AF",fontWeight:600,display:"inline-flex",alignItems:"center",gap:4}}>
                      {j.tipo==="grupo"?"🏢 ":"👤 "}{j.nombre}
                      <button onClick={()=>setAddToListExtraBosses(a=>a.filter(x=>x!==j.id))} style={{background:"none",border:"none",cursor:"pointer",color:"#3B82F6",fontSize:13,padding:"0 2px",lineHeight:1}}>✕</button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Agregar más jefes */}
              <details style={{borderBottom:"1px solid #E2E8F0"}}>
                <summary style={{padding:"8px 18px",cursor:"pointer",fontSize:12,fontWeight:600,color:"#1E40AF",background:"#EFF6FF",display:"flex",alignItems:"center",gap:6,userSelect:"none"}}>
                  <span style={{fontSize:14}}>🔗</span>
                  <span>Agregar más jefes a esta lista</span>
                  {addToListExtraBosses.length>0 && <span style={{marginLeft:"auto",background:"#3B82F6",color:"#fff",padding:"1px 7px",borderRadius:10,fontSize:10,fontWeight:700}}>+{addToListExtraBosses.length}</span>}
                </summary>
                <div style={{padding:"10px 18px",background:"#F8FAFC"}}>
                  <input className="inp" placeholder="Buscar jefe en el chart (nombre, cargo, sede)…" value={addToListBossQ} onChange={e=>setAddToListBossQ(e.target.value)} style={{marginBottom:6,fontSize:12}}/>
                  {bossQ_ && jefesDisponibles.length===0 && <div style={{fontSize:11,color:"#94A3B8",padding:"6px 2px"}}>Sin resultados entre nodos del chart</div>}
                  {jefesDisponibles.length>0 && (
                    <div style={{maxHeight:140,overflowY:"auto",border:"1px solid #E2E8F0",borderRadius:6,background:"#fff"}}>
                      {jefesDisponibles.map(n=>(
                        <div key={n.id} onClick={()=>{setAddToListExtraBosses(a=>[...a,n.id]);setAddToListBossQ("");}}
                          style={{padding:"6px 10px",cursor:"pointer",borderBottom:"1px solid #F1F5F9",display:"flex",alignItems:"center",gap:8}}
                          onMouseEnter={e=>e.currentTarget.style.background="#F0F9FF"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                          <span style={{fontSize:12}}>{n.tipo==="grupo"?"🏢":"👤"}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:600,color:"#0F172A",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{n.nombre}</div>
                            {n.cargo && <div style={{fontSize:10,color:"#64748B"}}>{n.cargo}</div>}
                          </div>
                          <span style={{fontSize:13,color:"#3B82F6",fontWeight:700}}>＋</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{fontSize:10,color:"#64748B",marginTop:6,lineHeight:1.4}}>💡 Los jefes que agregues aquí se aplicarán a los <strong>{grupo.members.length} miembros actuales</strong> y a los nuevos al cerrar este modal.</div>
                </div>
              </details>

              {/* Filtros + búsqueda */}
              <div style={{padding:"10px 18px",borderBottom:"1px solid #E2E8F0"}}>
                <input autoFocus className="inp" placeholder="Buscar persona por nombre, cargo, sede…" value={addToListQ} onChange={e=>setAddToListQ(e.target.value)} style={{marginBottom:8}}/>

                {/* Chips de filtros colapsables */}
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  {/* Sedes */}
                  <details>
                    <summary style={{padding:"6px 10px",cursor:"pointer",fontSize:11,fontWeight:600,color:"#334155",background:"#F1F5F9",borderRadius:6,display:"flex",alignItems:"center",gap:6,userSelect:"none"}}>
                      <span>🏙 Sedes</span>
                      {addToListFilters.sede.length>0 && <span style={{background:"#3B82F6",color:"#fff",padding:"1px 6px",borderRadius:8,fontSize:9}}>{addToListFilters.sede.length}</span>}
                      <span style={{marginLeft:"auto",fontSize:9,color:"#64748B"}}>{sedeOptions.length}</span>
                    </summary>
                    <div style={{padding:"6px 0",display:"flex",flexWrap:"wrap",gap:3,maxHeight:100,overflowY:"auto"}}>
                      {sedeOptions.map(s=>{
                        const active=addToListFilters.sede.includes(s);
                        return(
                          <span key={s} onClick={()=>toggleFilter("sede",s)} style={{fontSize:10,padding:"2px 8px",borderRadius:10,border:`1px solid ${active?"#3B82F6":"#CBD5E1"}`,background:active?"#EFF6FF":"#fff",color:active?"#1E40AF":"#475569",cursor:"pointer",fontWeight:active?600:500,whiteSpace:"nowrap"}}>{s}</span>
                        );
                      })}
                    </div>
                  </details>
                  {/* Cargos */}
                  <details>
                    <summary style={{padding:"6px 10px",cursor:"pointer",fontSize:11,fontWeight:600,color:"#334155",background:"#F1F5F9",borderRadius:6,display:"flex",alignItems:"center",gap:6,userSelect:"none"}}>
                      <span>💼 Cargos</span>
                      {addToListFilters.cargo.length>0 && <span style={{background:"#3B82F6",color:"#fff",padding:"1px 6px",borderRadius:8,fontSize:9}}>{addToListFilters.cargo.length}</span>}
                      <span style={{marginLeft:"auto",fontSize:9,color:"#64748B"}}>{cargoOptions.length}</span>
                    </summary>
                    <div style={{padding:"6px 0",display:"flex",flexWrap:"wrap",gap:3,maxHeight:120,overflowY:"auto"}}>
                      {cargoOptions.map(c=>{
                        const active=addToListFilters.cargo.includes(c);
                        return(
                          <span key={c} onClick={()=>toggleFilter("cargo",c)} style={{fontSize:10,padding:"2px 8px",borderRadius:10,border:`1px solid ${active?"#3B82F6":"#CBD5E1"}`,background:active?"#EFF6FF":"#fff",color:active?"#1E40AF":"#475569",cursor:"pointer",fontWeight:active?600:500,whiteSpace:"nowrap"}}>{c}</span>
                        );
                      })}
                    </div>
                  </details>
                  {/* Depto */}
                  {deptOptions.length>0 && (
                    <details>
                      <summary style={{padding:"6px 10px",cursor:"pointer",fontSize:11,fontWeight:600,color:"#334155",background:"#F1F5F9",borderRadius:6,display:"flex",alignItems:"center",gap:6,userSelect:"none"}}>
                        <span>🗂 Depto</span>
                        {addToListFilters.dept.length>0 && <span style={{background:"#3B82F6",color:"#fff",padding:"1px 6px",borderRadius:8,fontSize:9}}>{addToListFilters.dept.length}</span>}
                        <span style={{marginLeft:"auto",fontSize:9,color:"#64748B"}}>{deptOptions.length}</span>
                      </summary>
                      <div style={{padding:"6px 0",display:"flex",flexWrap:"wrap",gap:3,maxHeight:100,overflowY:"auto"}}>
                        {deptOptions.map(d=>{
                          const active=addToListFilters.dept.includes(d);
                          return(
                            <span key={d} onClick={()=>toggleFilter("dept",d)} style={{fontSize:10,padding:"2px 8px",borderRadius:10,border:`1px solid ${active?"#3B82F6":"#CBD5E1"}`,background:active?"#EFF6FF":"#fff",color:active?"#1E40AF":"#475569",cursor:"pointer",fontWeight:active?600:500,whiteSpace:"nowrap"}}>{d}</span>
                          );
                        })}
                      </div>
                    </details>
                  )}
                </div>
                {totalFiltros>0 && (
                  <div style={{marginTop:6,display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:10,color:"#64748B"}}>{totalFiltros} filtro{totalFiltros!==1?"s":""} activo{totalFiltros!==1?"s":""}</span>
                    <button onClick={limpiarFiltros} style={{fontSize:10,padding:"2px 8px",border:"1px solid #FCA5A5",background:"#FEF2F2",color:"#B91C1C",borderRadius:6,cursor:"pointer",fontWeight:600}}>Limpiar</button>
                  </div>
                )}
              </div>

              {/* Lista de candidatos */}
              <div style={{flex:1,overflowY:"auto",padding:"6px 8px"}}>
                {!hayFiltros && <div style={{padding:"20px 18px",textAlign:"center",fontSize:12,color:"#94A3B8"}}>Usa el buscador o filtros para encontrar personas</div>}
                {hayFiltros && totalFiltrados===0 && <div style={{padding:"20px 18px",textAlign:"center",fontSize:12,color:"#94A3B8"}}>Sin resultados que no estén ya en el chart</div>}
                {hayFiltros && totalFiltrados>30 && <div style={{padding:"6px 14px",fontSize:10,color:"#94A3B8",fontStyle:"italic"}}>Mostrando 30 de {totalFiltrados} · refina los filtros para ver más</div>}
                {candidatos.map(r=>(
                  <div key={r.id} onClick={()=>{addToList(r);}}
                    style={{padding:"8px 12px",cursor:"pointer",borderRadius:8,display:"flex",alignItems:"center",gap:10,margin:"2px 0"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#F1F5F9"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <div style={{width:32,height:32,borderRadius:"50%",background:"#EFF6FF",border:"1.5px solid #3B82F6",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{fontSize:10,fontWeight:700,color:"#1E40AF"}}>{ini(r.nombre)}</span>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:"#0F172A",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.nombre}</div>
                      <div style={{fontSize:11,color:"#64748B",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.cargo||""}{r.area?" · "+r.area:""}{r.dept?" · "+r.dept:""}</div>
                    </div>
                    <span style={{fontSize:16,color:"#22C55E",fontWeight:700}}>＋</span>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div style={{padding:"10px 18px",borderTop:"1px solid #E2E8F0",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#F8FAFC"}}>
                <span style={{fontSize:11,color:"#64748B"}}>Lista actual: {grupo.members.length} personas</span>
                <button onClick={cerrarYAplicar} style={{padding:"6px 14px",borderRadius:8,border:"1px solid #CBD5E1",background:"#fff",cursor:"pointer",fontSize:12,fontWeight:600}}>
                  {addToListExtraBosses.length>0 ? `✓ Aplicar y cerrar` : "Cerrar"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Toolbar ── */}
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",background:"#fff",borderBottom:"1px solid #E2E8F0",flexShrink:0,flexWrap:"wrap"}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="8" y="2" width="8" height="7" rx="1.5" stroke="#3B82F6" strokeWidth="1.5"/><rect x="2" y="15" width="8" height="7" rx="1.5" stroke="#3B82F6" strokeWidth="1.5"/><rect x="14" y="15" width="8" height="7" rx="1.5" stroke="#3B82F6" strokeWidth="1.5"/><path d="M12 9v3M6 15v-3h12v3" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round"/></svg>
        <span style={{fontWeight:700,fontSize:15,color:"#0F172A"}}>Organigrama</span>
        <span style={{fontSize:10,fontWeight:600,color:"#64748B",background:"#F1F5F9",padding:"2px 6px",borderRadius:6}}>v13</span>
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
        {/* v12: botón reordenar nombres */}
        {(roster.length>0 || nodes.length>0) && (
          <button className="btn" onClick={()=>{
            const total = roster.length + nodes.filter(n=>n.tipo==="persona").length;
            if(!confirm(`¿Invertir todos los nombres del formato actual (APELLIDOS NOMBRES) a NOMBRES APELLIDOS?\n\nEsto afectará ${total} personas (roster + chart).\n\nEjemplo: "SANCHEZ OSORNO OSCAR" → "OSCAR SANCHEZ OSORNO"\n\nSi te equivocas, vuelve a darle clic para invertir de nuevo.`)) return;
            setRoster(r=>r.map(x=>({...x, nombre: invertirNombre(x.nombre)})));
            setNodes(p=>p.map(n=>n.tipo==="persona" ? {...n, nombre: invertirNombre(n.nombre)} : n));
          }} title="Invertir orden: APELLIDOS NOMBRES ↔ NOMBRES APELLIDOS">⇄ Reordenar nombres</button>
        )}
        {/* v12: selector de tipo de línea */}
        {nodes.length>0 && (
          <div title="Tipo de línea de conexión" style={{display:"flex",alignItems:"center",gap:4,padding:"3px 4px",background:"#F1F5F9",borderRadius:8,border:"1px solid #E2E8F0"}}>
            <span style={{fontSize:10,color:"#64748B",padding:"0 4px",fontWeight:600}}>Líneas:</span>
            <button onClick={()=>setLineStyle("curved")} title="Curva suave"
              style={{padding:"3px 7px",fontSize:11,borderRadius:6,border:"none",cursor:"pointer",background:lineStyle==="curved"?"#3B82F6":"transparent",color:lineStyle==="curved"?"#fff":"#64748B",fontWeight:600}}>
              ╭╮ Curva
            </button>
            <button onClick={()=>setLineStyle("orthogonal")} title="Líneas con ángulos rectos (organigrama clásico)"
              style={{padding:"3px 7px",fontSize:11,borderRadius:6,border:"none",cursor:"pointer",background:lineStyle==="orthogonal"?"#3B82F6":"transparent",color:lineStyle==="orthogonal"?"#fff":"#64748B",fontWeight:600}}>
              ┘└ Recta
            </button>
            <button onClick={()=>setLineStyle("straight")} title="Línea diagonal directa"
              style={{padding:"3px 7px",fontSize:11,borderRadius:6,border:"none",cursor:"pointer",background:lineStyle==="straight"?"#3B82F6":"transparent",color:lineStyle==="straight"?"#fff":"#64748B",fontWeight:600}}>
              ╲ Diagonal
            </button>
          </div>
        )}
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
                <div style={{padding:"0 14px 8px",flexShrink:0,display:"flex",gap:6,flexWrap:"wrap"}}>
                  <button onClick={()=>{setNewPerson({nombre:"",cargo:"",area:"",dept:"",email:"",foto:""});setNewPersonOpen(true);}}
                    style={{flex:"1 1 auto",padding:"6px 10px",borderRadius:8,border:"1px solid #22C55E",background:"#F0FDF4",color:"#15803D",cursor:"pointer",fontSize:12,fontWeight:600,whiteSpace:"nowrap"}}>
                    ➕ Nueva persona
                  </button>
                  {roster.length>0 && (
                    <button onClick={exportRosterXLSX}
                      style={{flex:"1 1 auto",padding:"6px 10px",borderRadius:8,border:"1px solid #3B82F6",background:"#EFF6FF",color:"#1E40AF",cursor:"pointer",fontSize:12,fontWeight:600,whiteSpace:"nowrap"}}
                      title="Descargar el roster actualizado en formato Excel del maestro original">
                      📥 Descargar roster
                    </button>
                  )}
                </div>
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
                      {/* Buscar jefes (múltiples) */}
                      <div style={{padding:"10px 14px"}}>
                        <div style={{fontSize:12,fontWeight:600,color:"#0369A1",marginBottom:6}}>
                          ¿A quién(es) reporta? {quickAdd.parentIds?.length>0 && <span style={{color:"#7E22CE"}}>({quickAdd.parentIds.length} seleccionado{quickAdd.parentIds.length!==1?"s":""})</span>}
                        </div>

                        {/* Chips de jefes ya seleccionados */}
                        {quickAdd.parentIds?.length>0 && (
                          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:6}}>
                            {quickAdd.parentIds.map(pid=>{
                              const jefe=nodes.find(x=>x.id===pid);
                              if(!jefe) return null;
                              return(
                                <div key={pid} style={{padding:"2px 5px 2px 8px",background:"#DCFCE7",border:"1px solid #22C55E",borderRadius:12,display:"flex",alignItems:"center",gap:4,fontSize:10}}>
                                  <span>{jefe.tipo==="grupo"?"🏢":"👤"}</span>
                                  <span style={{fontWeight:600,color:"#15803D",maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{jefe.nombre}</span>
                                  <button onClick={()=>toggleQuickAddParent(pid)} style={{background:"none",border:"none",cursor:"pointer",color:"#22C55E",fontSize:12,padding:0,lineHeight:1}}>✕</button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <input className="inp" value={quickAdd.q} onChange={e=>setQuickAdd(f=>({...f,q:e.target.value}))} placeholder={quickAdd.parentIds?.length?"Buscar otro jefe…":"Buscar jefe en el chart…"} style={{marginBottom:6,borderColor:"#BAE6FD"}}/>
                        <div style={{maxHeight:140,overflowY:"auto",border:"1px solid #E2E8F0",borderRadius:8,background:"#fff",marginBottom:8}}>
                          {quickBossResults.length===0&&<div style={{padding:"10px 12px",fontSize:12,color:"#94A3B8"}}>Sin nodos en el chart aún</div>}
                          {quickBossResults.map(n=>{
                            const yaEs = (quickAdd.parentIds||[]).includes(n.id);
                            return(
                              <div key={n.id} onClick={()=>toggleQuickAddParent(n.id)}
                                style={{padding:"7px 10px",cursor:"pointer",borderBottom:"1px solid #F1F5F9",background:yaEs?"#F0FDF4":"#fff",display:"flex",alignItems:"center",gap:8}}>
                                <span style={{fontSize:13}}>{n.tipo==="grupo"?"🏢":"👤"}</span>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:12,fontWeight:600,color:"#0F172A",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{n.nombre}</div>
                                  <div style={{fontSize:10,color:"#64748B"}}>{n.cargo||""}</div>
                                </div>
                                {yaEs ? <span style={{fontSize:14,color:"#15803D",fontWeight:700}}>✓</span> : <span style={{fontSize:14,color:"#CBD5E1"}}>＋</span>}
                              </div>
                            );
                          })}
                        </div>

                        <div style={{fontSize:10,color:"#0369A1",marginBottom:8,lineHeight:1.5}}>💡 Clic en cada jefe para agregarlo/quitarlo. Puedes elegir varios.</div>

                        <div style={{display:"flex",gap:6}}>
                          <button className="btn p" onClick={confirmQuickAdd} style={{flex:1,fontSize:12}}>
                            {quickAdd.parentIds?.length>0
                              ? `✓ Agregar con ${quickAdd.parentIds.length} jefe${quickAdd.parentIds.length!==1?"s":""}`
                              : "✓ Agregar al chart (sin jefe)"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* ── Lista de personas ── */}
                  {!quickAdd&&rosterFiltered.map(r=>{
                    const ya=inChart.has(r.id);
                    const ret=r.retirado;
                    return(
                      <div key={r.id} className={`rrow${ya?" added":""}`} onClick={()=>{if(!ya)addPersona(r);}} style={ret?{opacity:0.55,background:"#FEF3C7"}:undefined}>
                        <div style={{width:32,height:32,borderRadius:"50%",background:ret?"#FEF3C7":(ya?"#EDE9FE":"#F1F5F9"),border:`1.5px solid ${ret?"#F59E0B":(ya?"#A855F7":"#E2E8F0")}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,position:"relative"}}>
                          <span style={{fontSize:11,fontWeight:700,color:ret?"#92400E":(ya?"#7E22CE":"#64748B")}}>{ini(r.nombre)}</span>
                          {ret && <span style={{position:"absolute",top:-4,right:-4,width:14,height:14,borderRadius:"50%",background:"#F59E0B",color:"#fff",fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,border:"1.5px solid #fff"}}>!</span>}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,color:"#0F172A",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",textDecoration:ret?"line-through":"none"}}>{r.nombre}</div>
                          <div style={{fontSize:11,color:"#64748B",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                            {ret && <span style={{color:"#F59E0B",fontWeight:700,marginRight:4}}>⚠ RETIRADO</span>}
                            {[r.cargo,r.area].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        <span style={{fontSize:11,padding:"2px 7px",borderRadius:6,background:ret?"#FEF3C7":(ya?"#EDE9FE":"#EFF6FF"),color:ret?"#92400E":(ya?"#7E22CE":"#3B82F6"),fontWeight:600,flexShrink:0}}>{ret?"Retirado":(ya?"En chart":"+ Agregar")}</span>
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
                      const g=gcol(n);
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
                {/* v13: Override de nivel jerárquico */}
                <div style={{marginTop:8}}>
                  <label style={{display:"block",fontSize:11,color:"#64748B",marginBottom:2}}>Nivel jerárquico (orden en la fila)</label>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {[
                      {v:"",l:"Auto (detectar)",bg:"#F1F5F9",bd:"#CBD5E1",fg:"#475569"},
                      {v:"master",l:"1️⃣ Master",bg:"#DBEAFE",bd:"#3B82F6",fg:"#1E40AF"},
                      {v:"senior",l:"2️⃣ Senior",bg:"#DCFCE7",bd:"#22C55E",fg:"#15803D"},
                      {v:"junior",l:"3️⃣ Junior",bg:"#FEF3C7",bd:"#F59E0B",fg:"#92400E"},
                    ].map(opt=>{
                      const active = (editAdminLevel||"")===opt.v;
                      return(
                        <button key={opt.v||"auto"} onClick={()=>setEditAdminLevel(opt.v)}
                          style={{padding:"4px 9px",borderRadius:6,border:active?`1.5px solid ${opt.bd}`:"1px solid #E2E8F0",background:active?opt.bg:"#fff",color:active?opt.fg:"#64748B",cursor:"pointer",fontSize:11,fontWeight:active?700:500}}>
                          {opt.l}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{fontSize:10,color:"#94A3B8",marginTop:4,lineHeight:1.4}}>
                    💡 Auto = detecta del cargo. Override manual si el cargo no incluye master/senior/junior pero quieres ordenar igual.
                  </div>
                </div>
              </div>
            )}

            {editNode.tipo==="grupo"&&(()=>{
              const g=gcol(editColor?{customColor:editColor}:editNode);
              const presets=["#3B82F6","#22C55E","#A855F7","#F97316","#EF4444","#14B8A6","#EAB308","#EC4899","#0EA5E9","#84CC16","#8B5CF6","#F59E0B"];
              return(
                <>
                  <div style={{textAlign:"center",marginBottom:14}}>
                    <div style={{width:54,height:54,borderRadius:12,margin:"0 auto 6px",background:g.bg,border:`2px solid ${g.border}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <CanaIcon size={28} color={g.text}/>
                    </div>
                    <div style={{fontSize:11,color:"#94A3B8"}}>Vista previa</div>
                  </div>

                  {/* v12: Nombre editable */}
                  <div style={{marginBottom:14}}>
                    <label style={{display:"block",fontSize:12,fontWeight:600,color:"#334155",marginBottom:6}}>Nombre del grupo / sede</label>
                    <input className="inp" value={editNombre} onChange={e=>setEditNombre(e.target.value)} placeholder="Ej: SC PALMITEX"/>
                  </div>

                  {/* v12: Color personalizado */}
                  <div style={{marginBottom:16}}>
                    <label style={{display:"block",fontSize:12,fontWeight:600,color:"#334155",marginBottom:6}}>Color</label>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <input type="color" value={editColor||"#3B82F6"} onChange={e=>setEditColor(e.target.value)} style={{width:46,height:34,border:"1px solid #CBD5E1",borderRadius:6,cursor:"pointer",padding:2,background:"#fff"}}/>
                      <input className="inp" value={editColor} onChange={e=>setEditColor(e.target.value)} placeholder="#3B82F6 (hex)" style={{flex:1,fontFamily:"monospace",fontSize:12}}/>
                      {editColor && <button onClick={()=>setEditColor("")} style={{padding:"5px 10px",border:"1px solid #CBD5E1",background:"#fff",borderRadius:6,cursor:"pointer",fontSize:11}}>Por defecto</button>}
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                      {presets.map(c=>(
                        <button key={c} onClick={()=>setEditColor(c)} title={c}
                          style={{width:24,height:24,borderRadius:6,background:c,border:editColor===c?"2px solid #0F172A":"1px solid #E2E8F0",cursor:"pointer",padding:0}}/>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}

            {/* v8: Asignar jefes (múltiples) */}
            <div style={{marginBottom:16}}>
              <label style={{display:"block",fontSize:12,fontWeight:600,color:"#334155",marginBottom:6}}>Jefes / a quién reporta {editPIds.length>1 && <span style={{color:"#7E22CE"}}>({editPIds.length})</span>}</label>

              {/* Lista de jefes actuales como chips */}
              {editPIds.length>0 && (
                <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
                  {editPIds.map(pid=>{
                    const padre=nodes.find(x=>x.id===pid)||(roster.find(x=>x.id===pid));
                    if(!padre) return null;
                    return(
                      <div key={pid} style={{padding:"3px 6px 3px 8px",background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:14,display:"flex",alignItems:"center",gap:5,fontSize:11}}>
                        <span>{padre.tipo==="grupo"?"🏢":"👤"}</span>
                        <span style={{fontWeight:600,color:"#1E40AF",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{padre.nombre}</span>
                        <button onClick={()=>setEditPIds(arr=>arr.filter(x=>x!==pid))} style={{background:"none",border:"none",cursor:"pointer",color:"#93C5FD",fontSize:14,padding:"0 2px",lineHeight:1}}>✕</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Buscador para agregar otro jefe */}
              <input className="inp" value={bossQ} onChange={e=>setBossQ(e.target.value)} placeholder={editPIds.length?"Agregar otro jefe…":"Buscar jefe por nombre…"} style={{marginBottom:4}}/>
              {bossQ&&bossResults.length>0&&(
                <div style={{border:"1px solid #E2E8F0",borderRadius:8,maxHeight:160,overflowY:"auto",background:"#fff",marginBottom:6}}>
                  {bossResults.map(r=>{
                    const yaEs=editPIds.includes(r.id);
                    return(
                      <div key={r.id} onClick={()=>{
                        if(yaEs) return; // ya está
                        setEditPIds(arr=>[...arr, r.id]);
                        setBossQ("");
                      }} style={{padding:"7px 10px",cursor:yaEs?"default":"pointer",borderBottom:"1px solid #F1F5F9",background:yaEs?"#F0FDF4":"#fff",display:"flex",alignItems:"center",gap:8,opacity:yaEs?0.7:1}}>
                        <span style={{fontSize:13}}>{r.tipo==="grupo"?"🏢":"👤"}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:600,color:"#0F172A"}}>{r.nombre}</div>
                          <div style={{fontSize:10,color:"#64748B"}}>{r.cargo||""}{r.enChart?<span style={{color:"#3B82F6"}}> · en chart</span>:""}</div>
                        </div>
                        {yaEs && <span style={{fontSize:11,color:"#15803D",fontWeight:700}}>✓ ya es jefe</span>}
                      </div>
                    );
                  })}
                </div>
              )}
              {bossQ&&bossResults.length===0&&<div style={{fontSize:12,color:"#94A3B8",padding:"4px 2px"}}>Sin resultados</div>}

              {editPIds.length===0 && <div style={{fontSize:11,color:"#94A3B8",padding:"6px 0"}}>Sin jefe asignado (nivel raíz)</div>}
              <div style={{fontSize:10,color:"#94A3B8",marginTop:4}}>💡 Tip: puedes asignar varios jefes. También existe el botón 🔗 en el nodo para hacerlo visualmente.</div>
            </div>

            <div style={{display:"flex",gap:8}}>
              <button className="btn p" onClick={saveEdit} style={{flex:1}}>Guardar</button>
              <button className="btn" onClick={()=>{setPanel(null);setSel(null);setEditId(null);}}>Cancelar</button>
            </div>
            <button className="btn d" onClick={()=>delNode(editNode.id)} style={{width:"100%",marginTop:8}}>Eliminar del chart</button>

            {/* v12.3: botones de roster (solo personas, no grupos) */}
            {editNode.tipo==="persona" && (()=>{
              const enRoster = roster.find(r=>r.id===editNode.id);
              const yaRetirado = enRoster?.retirado;
              const enChart = nodes.some(n=>n.id===editNode.id);

              const marcarRetirado=()=>{
                const accion = yaRetirado ? "REACTIVAR" : "marcar como RETIRADO";
                if(!confirm(`¿${accion} a ${editNode.nombre} en el roster?\n\n${yaRetirado?"Volverá a aparecer en búsquedas para agregar al chart.":"Ya no aparecerá al buscar para agregar al chart, pero se conserva en el roster con marca ⚠️."}`)) return;
                if(!yaRetirado && enChart){
                  if(confirm(`Esta persona está en el chart actualmente. ¿También quitarla del chart?`)){
                    delNode(editNode.id);
                  }
                }
                setRoster(r=>r.map(x=>x.id===editNode.id?{...x, retirado:!yaRetirado}:x));
                if(!yaRetirado) { setPanel(null); setSel(null); setEditId(null); }
              };

              const eliminarDefinitivo=()=>{
                if(!confirm(`⚠️ ELIMINAR DEFINITIVO a ${editNode.nombre} del roster maestro.\n\nEsta acción NO se puede deshacer (a menos que recargues el maestro).\n\nSi solo quieres marcarlo como retirado pero conservar el registro, usa el botón naranja "Marcar como retirado".\n\n¿Continuar?`)) return;
                if(enChart){
                  if(!confirm(`Esta persona también está en el chart. Se eliminará de ambos sitios. ¿Confirmar?`)) return;
                  setNodes(p=>p.filter(n=>n.id!==editNode.id).map(n=>{
                    const ps=parentsOf(n);
                    if(!ps.includes(editNode.id)) return n;
                    const next=ps.filter(x=>x!==editNode.id);
                    const upd={...n};
                    delete upd.parentId; delete upd.parentIds;
                    if(next.length===0) upd.parentId="";
                    else if(next.length===1) upd.parentId=next[0];
                    else upd.parentIds=next;
                    return upd;
                  }));
                }
                setRoster(r=>r.filter(x=>x.id!==editNode.id));
                setPanel(null); setSel(null); setEditId(null);
              };

              return(
                <>
                  <div style={{marginTop:14,paddingTop:10,borderTop:"1px solid #E2E8F0",fontSize:11,fontWeight:700,color:"#94A3B8",letterSpacing:"0.05em"}}>
                    GESTIÓN EN EL ROSTER
                  </div>
                  {yaRetirado && (
                    <div style={{margin:"8px 0",padding:"6px 10px",background:"#FEF3C7",border:"1px solid #FCD34D",borderRadius:6,fontSize:11,color:"#78350F"}}>
                      ⚠️ Esta persona está marcada como <strong>RETIRADA</strong>
                    </div>
                  )}
                  <button onClick={marcarRetirado}
                    style={{width:"100%",marginTop:6,padding:"7px 10px",borderRadius:8,border:`1px solid ${yaRetirado?"#22C55E":"#F59E0B"}`,background:yaRetirado?"#F0FDF4":"#FFFBEB",color:yaRetirado?"#15803D":"#92400E",cursor:"pointer",fontSize:12,fontWeight:600}}>
                    {yaRetirado ? "↻ Reactivar (quitar marca de retirado)" : "⚠️ Marcar como retirado"}
                  </button>
                  <button onClick={eliminarDefinitivo}
                    style={{width:"100%",marginTop:6,padding:"7px 10px",borderRadius:8,border:"1px solid #FCA5A5",background:"#FEF2F2",color:"#B91C1C",cursor:"pointer",fontSize:12,fontWeight:600}}>
                    🗑 Eliminar del roster definitivo
                  </button>
                  <div style={{fontSize:10,color:"#94A3B8",marginTop:6,lineHeight:1.4}}>
                    💡 <strong>Marcar como retirado</strong> conserva el registro pero lo oculta en búsquedas.
                    <strong> Eliminar definitivo</strong> lo borra del roster (se puede recuperar al recargar maestro).
                  </div>
                </>
              );
            })()}
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
                      stroke={e.active?"#3B82F6":(e.thin?"#CBD5E1":(e.multi?"#A855F7":"#94A3B8"))}
                      strokeWidth={e.active?2.5:(e.thin?1:1.5)}
                      strokeDasharray={e.multi?"5 4":undefined}
                      fill="none" strokeLinecap="round"/>
                  ))}
                </g>
              </svg>

              {nodes.map(n=>{
                const p=pos[n.id]; if(!p)return null;
                const isSel=sel===n.id;
                const nh=n.tipo==="grupo"?NHG:NH;
                const modoAsignar_g = assignBossFor && assignBossFor !== n.id;

                /* v11: si es miembro NO representante de un auto-grupo, no se dibuja (está dentro de la caja) */
                const gkey = (()=>{
                  for(const [key,g] of Object.entries(autoGroups)){
                    if(g.members.includes(n.id)) return key;
                  }
                  return null;
                })();
                const esRep = gkey && autoGroups[gkey].members[0]===n.id;
                const esMiembroNoRep = gkey && !esRep;
                if(esMiembroNoRep) return null;

                /* v11: render de la CAJA-LISTA si es representante */
                if(esRep){
                  const grupo = autoGroups[gkey];
                  const miembros = grupo.members.map(mid=>nodes.find(x=>x.id===mid)).filter(Boolean);
                  const boxH = listBoxHeight(miembros.length);
                  return(
                    <div key={n.id} className="on"
                      style={{left:vp.x+p.x*vp.s,top:vp.y+p.y*vp.s,width:LW*vp.s,height:boxH*vp.s}}>
                      <div style={{
                        width:LW,height:boxH,transform:`scale(${vp.s})`,transformOrigin:"top left",
                        background:"#ffffff",
                        border:`1.5px solid ${assignBossFor===`list:${gkey}`?"#3B82F6":"#CBD5E1"}`,
                        borderTop:`4px solid ${assignBossFor===`list:${gkey}`?"#3B82F6":"#94A3B8"}`,
                        borderRadius:10,
                        boxShadow:assignBossFor===`list:${gkey}`?"0 0 0 3px #DBEAFE, 0 2px 8px rgba(59,130,246,.3)":"0 2px 8px rgba(15,23,42,.06)",
                        display:"flex",flexDirection:"column",
                        overflow:"hidden",
                      }}>
                        {/* Header de la caja */}
                        <div style={{padding:"6px 10px",background:"#F8FAFC",borderBottom:"1px solid #E2E8F0",display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:10,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:"0.05em"}}>
                            {miembros.length} subordinados
                          </span>
                          <span style={{fontSize:9,color:"#94A3B8"}}>· mismo jefe</span>
                          <div style={{flex:1}}/>
                          {/* v11: botón 🔗 asignar jefes a toda la lista */}
                          <div title="Asignar jefes a TODA la lista"
                            onClick={e=>{e.stopPropagation();setAssignBossFor(`list:${gkey}`);setSel(null);}}
                            style={{width:22,height:22,borderRadius:5,background:"#FEF3C7",border:"1px solid #F59E0B",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:11}}>
                            🔗
                          </div>
                          {/* v11: botón + agregar persona a esta lista */}
                          <div title="Agregar persona a esta lista (hereda los mismos jefes)"
                            onClick={e=>{e.stopPropagation();setAddToListKey(gkey);setAddToListQ("");}}
                            style={{width:22,height:22,borderRadius:5,background:"#DCFCE7",border:"1px solid #22C55E",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:13,fontWeight:700,color:"#15803D"}}>
                            ＋
                          </div>
                        </div>
                        {/* Filas */}
                        {miembros.map(m=>{
                          const cm=col(m.area);
                          const selRow = sel===m.id;
                          return(
                            <div key={m.id}
                              onClick={e=>{e.stopPropagation();setSel(selRow?null:m.id);}}
                              style={{
                                padding:"6px 10px",
                                borderBottom:"1px solid #F1F5F9",
                                background:selRow?"#EFF6FF":"#fff",
                                display:"flex",alignItems:"center",gap:8,
                                height:LIST_ROW,
                                cursor:"pointer",
                                position:"relative",
                              }}>
                              <div style={{width:4,alignSelf:"stretch",background:cm.border,borderRadius:2,flexShrink:0,margin:"4px 0"}}/>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:11,fontWeight:700,color:"#0F172A",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",lineHeight:1.2}}>{trunc(m.nombre,30)}</div>
                                {m.cargo&&<div style={{fontSize:9,color:"#64748B",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",lineHeight:1.2}}>{trunc(m.cargo,34)}</div>}
                              </div>
                              {selRow && (
                                <div style={{display:"flex",gap:2}}>
                                  <div title="Editar" onClick={e=>{e.stopPropagation();openEdit(m);}} style={{width:20,height:20,borderRadius:4,background:cm.bg,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-9 9H2v-3L11 2z" stroke={cm.text} strokeWidth="1.5" strokeLinejoin="round"/></svg>
                                  </div>
                                  <div title="Eliminar" onClick={e=>{e.stopPropagation();delNode(m.id);}} style={{width:20,height:20,borderRadius:4,background:"#FEF2F2",border:"1px solid #FCA5A5",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:10,color:"#DC2626"}}>✕</div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                if(n.tipo==="grupo"){
                  const g=gcol(n);
                  const esJefeActDelOrigen_g = modoAsignar_g && (()=>{
                    const origen=nodes.find(x=>x.id===assignBossFor);
                    return origen && parentsOf(origen).includes(n.id);
                  })();
                  return(
                    <div key={n.id} className="on"
                      style={{left:vp.x+p.x*vp.s,top:vp.y+p.y*vp.s,width:NW*vp.s,height:nh*vp.s}}
                      onClick={e=>{e.stopPropagation(); if(modoAsignar_g){ onAssignBossClick(n.id); return; } setSel(isSel?null:n.id);}}>
                      <div style={{
                        width:NW,height:nh,transform:`scale(${vp.s})`,transformOrigin:"top left",
                        background:esJefeActDelOrigen_g?"#15803D":(modoAsignar_g?"#FBBF24":g.bg),
                        border:`2px solid ${esJefeActDelOrigen_g?"#14532D":(modoAsignar_g?"#D97706":g.border)}`,
                        borderRadius:10,
                        boxShadow:isSel?"0 0 0 3px rgba(255,255,255,.5),0 4px 20px rgba(0,0,0,.2)":"0 2px 8px rgba(0,0,0,.15)",
                        display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"0 14px",
                        cursor:modoAsignar_g?"crosshair":"pointer",
                        position:"relative",
                      }}>
                        <CanaIcon size={18} color={esJefeActDelOrigen_g?"#fff":(modoAsignar_g?"#78350F":g.text)}/>
                        <span style={{fontSize:13,fontWeight:700,color:esJefeActDelOrigen_g?"#fff":(modoAsignar_g?"#78350F":g.text),lineHeight:1.15,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",wordBreak:"break-word",textAlign:"left"}}>{n.nombre}</span>
                        {esJefeActDelOrigen_g && <span style={{position:"absolute",top:-8,right:-8,width:22,height:22,borderRadius:"50%",background:"#22C55E",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,boxShadow:"0 2px 6px rgba(0,0,0,.3)",border:"2px solid #fff"}}>✓</span>}
                        {isSel&&!modoAsignar_g&&(
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
                const parentsList=parentsOf(n);
                const parentGrp=parentsList.find(pid=>{
                  const pn=nodes.find(x=>x.id===pid);
                  return pn?.tipo==="grupo";
                });
                const parentGrpNode=parentGrp?nodes.find(x=>x.id===parentGrp):null;
                const badgeVal=n.area||n.dept;
                const badgeRedundant=parentGrpNode?.sourceVal&&(
                  (parentGrpNode.sourceCol==="area"&&parentGrpNode.sourceVal===n.area)||
                  (parentGrpNode.sourceCol==="dept"&&parentGrpNode.sourceVal===n.dept)||
                  (parentGrpNode.sourceCol==="cargo"&&parentGrpNode.sourceVal===n.cargo)
                );
                const esCompacto = p.compact === true;
                /* v8: tengoHijos ahora considera multi-jefe */
                const tengoHijos = nodes.some(x=>parentsOf(x).includes(n.id));
                const esAncestroCompacto = compactSet.has(n.id);
                const modoAsignar = assignBossFor && assignBossFor !== n.id;
                const esOrigenAsignar = assignBossFor === n.id;
                /* v8: ¿este nodo es YA uno de los jefes actuales del origen en asignación? */
                const esJefeActualDelOrigen = modoAsignar && (()=>{
                  const origen=nodes.find(x=>x.id===assignBossFor);
                  return origen && parentsOf(origen).includes(n.id);
                })();
                /* v8: ¿tiene múltiples jefes? */
                const tieneMultiplesJefes = parentsList.length > 1;

                /* ── MODO COMPACTO: fila delgada tipo listado ── */
                if(esCompacto){
                  return(
                    <div key={n.id} className="on"
                      style={{left:vp.x+p.x*vp.s,top:vp.y+p.y*vp.s,width:NW*vp.s,height:nh*vp.s}}
                      onClick={e=>{e.stopPropagation(); if(modoAsignar){ onAssignBossClick(n.id); return; } setSel(isSel?null:n.id);}}>
                      <div style={{
                        width:NW,height:nh,transform:`scale(${vp.s})`,transformOrigin:"top left",
                        background:esJefeActualDelOrigen?"#DCFCE7":(modoAsignar?"#FEF3C7":"#ffffff"),
                        border:`1.5px solid ${esJefeActualDelOrigen?"#22C55E":(modoAsignar?"#F59E0B":(isSel?c.border:"#E2E8F0"))}`,
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
                        {esJefeActualDelOrigen && <span style={{fontSize:13,color:"#15803D",fontWeight:700}}>✓</span>}
                        {tieneMultiplesJefes && !modoAsignar && <span title={`${parentsList.length} jefes`} style={{fontSize:9,background:"#F3E8FF",color:"#7E22CE",padding:"1px 5px",borderRadius:8,fontWeight:700}}>{parentsList.length}⚇</span>}
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
                      background:esJefeActualDelOrigen?"#DCFCE7":(modoAsignar?"#FEF3C7":(esOrigenAsignar?"#FEE2E2":"#ffffff")),
                      border:`1.5px solid ${esJefeActualDelOrigen?"#22C55E":(modoAsignar?"#F59E0B":(esOrigenAsignar?"#EF4444":(isSel?c.border:"#E2E8F0")))}`,
                      borderRadius:12,
                      boxShadow:isSel?`0 0 0 3px ${c.bg},0 8px 24px rgba(0,0,0,.15)`:"0 2px 8px rgba(15,23,42,.08)",
                      display:"flex",flexDirection:"column",alignItems:"center",
                      overflow:"hidden",position:"relative",
                      cursor:modoAsignar?"crosshair":"pointer",
                    }}>
                      {/* Banda superior de color */}
                      <div style={{position:"absolute",top:0,left:0,right:0,height:6,background:c.border}}/>

                      {/* v8: check verde si es jefe actual del origen en modo asignar */}
                      {esJefeActualDelOrigen && (
                        <div style={{position:"absolute",top:12,left:12,width:22,height:22,borderRadius:"50%",background:"#22C55E",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,zIndex:5,boxShadow:"0 2px 6px rgba(34,197,94,.4)"}}>✓</div>
                      )}

                      {/* v8: badge de múltiples jefes */}
                      {tieneMultiplesJefes && !modoAsignar && !esJefeActualDelOrigen && (
                        <div title={`${parentsList.length} jefes`} style={{position:"absolute",top:12,left:12,padding:"2px 7px",borderRadius:10,background:"#F3E8FF",color:"#7E22CE",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,zIndex:5,border:"1px solid #D8B4FE"}}>
                          {parentsList.length}⚇
                        </div>
                      )}

                      {/* Foto grande */}
                      <div style={{marginTop:16,width:FOTO_SZ,height:FOTO_SZ,borderRadius:"50%",background:c.bg,border:`3px solid ${c.border}`,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0,boxShadow:"0 4px 12px rgba(0,0,0,.08)"}}>
                        {n.foto
                          ? <img src={n.foto} style={{width:"100%",height:"100%",objectFit:"cover"}} alt={n.nombre}/>
                          : <span style={{fontSize:26,fontWeight:700,color:c.text,letterSpacing:"-0.02em"}}>{ini(n.nombre)}</span>
                        }
                      </div>

                      {/* Nombre — v12: hasta 2 líneas si no cabe */}
                      <div style={{marginTop:8,padding:"0 8px",width:"100%",textAlign:"center",fontSize:12,fontWeight:700,color:"#0F172A",lineHeight:1.15,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",wordBreak:"break-word"}}>
                        {n.nombre}
                      </div>

                      {/* Cargo — v12: 2 líneas si necesario */}
                      {n.cargo && (
                        <div style={{marginTop:2,padding:"0 8px",width:"100%",textAlign:"center",fontSize:10,color:"#64748B",lineHeight:1.15,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",wordBreak:"break-word"}}>
                          {n.cargo}
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

                      {/* v13: badge de nivel jerárquico admin */}
                      {(()=>{
                        const lvl = adminLevelOf(n);
                        if(lvl===99) return null;
                        const cfg = lvl===1 ? {n:"M",t:"Master",bg:"#1E40AF",fg:"#fff"}
                                  : lvl===2 ? {n:"S",t:"Senior",bg:"#15803D",fg:"#fff"}
                                  : {n:"J",t:"Junior",bg:"#D97706",fg:"#fff"};
                        return(
                          <div title={`Admin ${cfg.t}`} style={{position:"absolute",top:10,left:10,width:18,height:18,borderRadius:"50%",background:cfg.bg,color:cfg.fg,fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,boxShadow:"0 1px 3px rgba(0,0,0,.15)"}}>
                            {cfg.n}
                          </div>
                        );
                      })()}

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
