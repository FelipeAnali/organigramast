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
const LOGO_W = 300, LOGO_H = 120;  /* aspect ratio 2.5:1 */
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

      /* v14.5: PDF con logo oficial Cañaveral en esquina superior izquierda */
      const HEADER_H = 70;
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

      /* Logo oficial Cañaveral (caña + texto) — esquina superior izquierda */
      const logoH = 50;
      const logoW = Math.round(logoH * LOGO_W/LOGO_H);  /* mantener aspect ratio del logo real */
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
          <span style={{fontSize:10,fontWeight:700,color:BRAND.primary,background:BRAND.accent+"33",padding:"2px 7px",borderRadius:10}}>v14.5</span>
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
