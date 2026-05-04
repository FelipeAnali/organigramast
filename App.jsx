import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";

/* ─── Paleta ─── */
/* v14.2: paleta de personas — todos verdes corporativos Cañaveral
   Las distintas sedes se diferencian con tonos sutiles dentro del verde institucional */
const PAL = [
  { bg:"#E8F5DD", border:"#1C5A2A", text:"#0F3A18", dot:"#1C5A2A" }, /* verde principal */
  { bg:"#F0F9E8", border:"#5BA303", text:"#3D6B02", dot:"#7DD105" }, /* lima */
  { bg:"#DDEBE0", border:"#0F3A18", text:"#082009", dot:"#0F3A18" }, /* verde muy oscuro */
  { bg:"#E8F0E0", border:"#2D7A3E", text:"#1C5A2A", dot:"#2D7A3E" }, /* verde medio */
  { bg:"#EEF7E5", border:"#3F8A4D", text:"#1C5A2A", dot:"#3F8A4D" }, /* verde claro */
  { bg:"#E5F2DC", border:"#4F9E5A", text:"#1C5A2A", dot:"#4F9E5A" }, /* verde fresco */
  { bg:"#E0EDD8", border:"#256B30", text:"#0F3A18", dot:"#256B30" }, /* verde alterno */
  { bg:"#EBF5E0", border:"#33843D", text:"#1C5A2A", dot:"#33843D" }, /* verde extra */
];
/* Paletas para grupos (más sólidas) */
/* v14: paleta corporativa Cañaveral OFICIAL del manual de marca
   Verde principal: #1C5A2A (Pantone)
   Verde lima acento: #7DD105 (Pantone) */
const GPAL = [
  { bg:"#1C5A2A", border:"#0F3A18", text:"#ffffff" }, /* verde corporativo PRINCIPAL */
  { bg:"#0F3A18", border:"#082009", text:"#ffffff" }, /* verde muy oscuro */
  { bg:"#2D7A3E", border:"#1C5A2A", text:"#ffffff" }, /* verde medio */
  { bg:"#3F8A4D", border:"#1C5A2A", text:"#ffffff" }, /* verde claro */
  { bg:"#4F9E5A", border:"#2D7A3E", text:"#ffffff" }, /* verde fresco */
  { bg:"#1C5A2A", border:"#7DD105", text:"#ffffff" }, /* verde principal con borde lima */
  { bg:"#256B30", border:"#0F3A18", text:"#ffffff" },
  { bg:"#33843D", border:"#1C5A2A", text:"#ffffff" },
];

/* v14: colores de marca para toda la interfaz */
const BRAND = {
  primary: "#1C5A2A",       // verde principal
  primaryDark: "#0F3A18",   // verde muy oscuro
  primaryLight: "#2D7A3E",  // verde medio
  accent: "#7DD105",        // verde lima acento
  accentDark: "#5BA303",
  bgSoft: "#F4FAF1",        // crema verdoso del manual
  bgPanel: "#F8FAFC",
};
const FONT = '"Nunito", "Poppins", system-ui, -apple-system, sans-serif';

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
/* v14: imagen oficial de la caña Cañaveral (versión verde corporativa).
   El color se ajusta con CSS filters según contexto. */
const CANA_IMG = "data:image/png;base64,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";

/* v14.3: tile de fondo corporativo (cañas tenues) — repetible */
const BG_TILE = "data:image/jpeg;base64,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";

/* v14.5: logo oficial Cañaveral (caña + texto) — para usar en PDF */
const LOGO_IMG = "data:image/png;base64,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";
const LOGO_W = 280, LOGO_H = 280;  /* logo circular 1:1 (versión negativo) */
const CanaIcon = ({size=16, color="#1C5A2A"})=>{
  /* mapear color al filter CSS apropiado */
  let filter = "none";
  const c = (color||"").toLowerCase();
  if(c==="#ffffff" || c==="#fff" || c==="white"){
    /* blanco puro: brightness(0) invert(1) */
    filter = "brightness(0) invert(1)";
  } else if(c==="#000" || c==="#000000" || c==="black"){
    filter = "brightness(0)";
  } else if(c.includes("1c5a2a") || c.includes("0f3a18")){
    /* verde corporativo: la imagen ya es ese color */
    filter = "none";
  } else {
    /* cualquier otro color: oscurecer */
    filter = "brightness(0.85)";
  }
  return (
    <img src={CANA_IMG} alt="Cañaveral"
      width={Math.round(size*130/256)} height={size}
      style={{flexShrink:0, filter, display:"inline-block", verticalAlign:"middle"}}/>
  );
};
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
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;600;700;900&family=Poppins:wght@300;400;500;600;700;900&display=swap');
  *{box-sizing:border-box}
  body, html { font-family: ${FONT}; }
  /* Botones */
  .btn{padding:6px 14px;border-radius:8px;border:1px solid #CBD5E1;background:#fff;cursor:pointer;font-size:13px;color:#334155;transition:all .15s;white-space:nowrap;font-family:inherit;font-weight:600}
  .btn:hover{background:#F1F5F9;border-color:${BRAND.primary}}
  .btn.p{background:${BRAND.primary};color:#fff;border-color:${BRAND.primary}}
  .btn.p:hover{background:${BRAND.primaryDark};border-color:${BRAND.primaryDark}}
  .btn.g{background:${BRAND.accent};color:${BRAND.primaryDark};border-color:${BRAND.accent};font-weight:700}
  .btn.g:hover{background:${BRAND.accentDark};color:#fff}
  .btn.o{background:${BRAND.primaryLight};color:#fff;border-color:${BRAND.primaryLight}}
  .btn.o:hover{background:${BRAND.primary}}
  .btn.d{color:#DC2626;border-color:#FCA5A5}
  .btn.d:hover{background:#FEF2F2}
  .btn:disabled{opacity:.4;cursor:not-allowed}
  /* Inputs */
  .inp{padding:7px 11px;border:1px solid #CBD5E1;border-radius:8px;font-size:13px;width:100%;background:#fff;color:#0F172A;outline:none;font-family:inherit}
  .inp:focus{border-color:${BRAND.primary};box-shadow:0 0 0 3px ${BRAND.accent}33}
  select.inp{background:#fff}
  /* Filas roster */
  .rrow{display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid #F1F5F9;cursor:pointer;transition:background .12s;font-family:inherit}
  .rrow:hover{background:${BRAND.bgSoft}}
  .rrow.added{background:#E8F5DD}
  /* Nodos */
  .on{position:absolute;cursor:pointer}
  /* Botones zoom */
  .zb{width:30px;height:30px;border-radius:8px;border:1px solid #CBD5E1;background:#fff;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;color:#334155;font-family:inherit;transition:all .15s}
  .zb:hover{background:${BRAND.bgSoft};border-color:${BRAND.primary}}
  /* Tabs */
  .tab{padding:7px 14px;border-radius:8px;border:1px solid #E2E8F0;background:transparent;cursor:pointer;font-size:13px;color:#64748B;font-family:inherit;font-weight:600;transition:all .15s}
  .tab:hover{color:${BRAND.primary}}
  .tab.active{background:${BRAND.primary};color:#fff;border-color:${BRAND.primary}}
  /* Indicador de cambios sin guardar */
  .dot-unsaved{width:8px;height:8px;border-radius:50%;background:${BRAND.accent};animation:pulse 1.5s infinite;display:inline-block}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  /* Modales */
  .modal-bg{position:fixed;inset:0;background:rgba(15,58,24,.55);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px}
  .modal{background:#fff;border-radius:14px;max-width:720px;width:100%;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(15,58,24,.25);font-family:inherit}
  .diff-field{display:grid;grid-template-columns:80px 1fr 1fr 18px;gap:8px;align-items:center;padding:3px 0;font-size:12px}
  /* Linea acento corporativa */
  .brand-line{height:3px;background:${BRAND.accent};width:100%}
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
        backgroundColor:"#FFFFFF",
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

      if(canvas.width<10||canvas.height<10){
        throw new Error(`Canvas vacío (${canvas.width}x${canvas.height}). Recarga la página y vuelve a intentar.`);
      }

      /* v14.6: PDF con logo oficial Cañaveral (versión negativo circular) en esquina sup. izquierda */
      const HEADER_H = 90;  /* aumentado para acomodar el logo circular */
      const PAGE_PAD = 20;
      const chartW = canvas.width/2;
      const chartH = canvas.height/2;

      const pageW = chartW + PAGE_PAD*2;
      const pageH = chartH + HEADER_H + PAGE_PAD*2;

      const pdf = new jsPDF({
        orientation: pageW > pageH ? "landscape" : "portrait",
        unit: "px",
        format: [pageW, pageH],
      });

      /* Línea de acento verde lima debajo del header */
      pdf.setFillColor(125, 209, 5);  /* #7DD105 */
      pdf.rect(0, HEADER_H - 3, pageW, 3, "F");

      /* Logo oficial circular Cañaveral — esquina superior izquierda */
      const logoH = 70;  /* logo más grande para que el texto se lea bien */
      const logoW = logoH;  /* aspect ratio 1:1 (circular) */
      try {
        pdf.addImage(LOGO_IMG, "PNG", PAGE_PAD, (HEADER_H - logoH)/2, logoW, logoH);
      } catch(e) { console.warn("logo error:", e); }

      /* Fecha en esquina derecha del header */
      const fecha = new Date().toLocaleDateString("es-CO", {year:"numeric", month:"long", day:"numeric"});
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(148, 163, 184);
      pdf.text("Organigrama · "+fecha, pageW - PAGE_PAD, HEADER_H/2 + 2, {align: "right"});

      /* Insertar el chart debajo del header */
      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", PAGE_PAD, HEADER_H + PAGE_PAD/2, chartW, chartH);

      pdf.save(`organigrama_canaveral_${new Date().toISOString().slice(0,10)}.pdf`);
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
    <div style={{display:"flex",flexDirection:"column",height:660,fontFamily:FONT,background:BRAND.bgPanel,overflow:"hidden"}}>
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

      {/* ── Toolbar Cañaveral ── */}
      <div style={{flexShrink:0,background:"#fff",borderBottom:`1px solid ${BRAND.primary}22`}}>
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 16px",flexWrap:"wrap"}}>
          {/* Logo: caña + nombre */}
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <CanaIcon size={26} color={BRAND.primary}/>
            <div style={{display:"flex",flexDirection:"column",lineHeight:1}}>
              <span style={{fontWeight:300,fontSize:11,color:"#64748B",letterSpacing:"0.05em"}}>Supertiendas</span>
              <span style={{fontWeight:900,fontSize:18,color:BRAND.primary,fontFamily:'"Nunito","Poppins",sans-serif',letterSpacing:"-0.01em"}}>Cañaveral</span>
            </div>
          </div>
          <div style={{width:1,height:30,background:BRAND.primary+"33",margin:"0 4px"}}/>
          <span style={{fontWeight:700,fontSize:14,color:BRAND.primaryDark}}>Organigrama</span>
          <span style={{fontSize:10,fontWeight:700,color:BRAND.primary,background:BRAND.accent+"33",padding:"2px 7px",borderRadius:10}}>v14.6</span>
          {dirty && <span title="Cambios sin guardar" style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#C2410C",fontWeight:600}}><span className="dot-unsaved"/>sin guardar</span>}
          {!dirty && memFileName && <span style={{fontSize:11,color:BRAND.primary,fontWeight:600}} title={memFileName}>✓ guardado</span>}
          {roster.length>0&&<span style={{fontSize:11,padding:"2px 8px",background:BRAND.bgSoft,color:BRAND.primaryDark,borderRadius:20,fontWeight:600,border:`1px solid ${BRAND.primary}33`}}>{roster.length} en roster</span>}
          {nodes.length>0&&<span style={{fontSize:11,padding:"2px 8px",background:BRAND.accent+"22",color:BRAND.primaryDark,borderRadius:20,fontWeight:600,border:`1px solid ${BRAND.accent}66`}}>{nodes.length} en chart</span>}
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
        <div className="brand-line"/>
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
          style={{
            flex:1,overflow:"hidden",position:"relative",cursor:drag?"grabbing":"grab",
            backgroundColor:"#FFFFFF",
            backgroundImage:`url(${BG_TILE})`,
            backgroundRepeat:"repeat",
            backgroundSize:"280px 280px",
          }}
          onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}
          onClick={e=>{if(!e.target.closest(".on"))setSel(null);}}>

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
