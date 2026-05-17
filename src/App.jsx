import React, { useState, useEffect, useRef } from "react";
import { Tooltip as HeatmapTooltip } from "react-tooltip";
import CalendarHeatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css";  
import "./App.css";                                
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from "recharts";

// ── constants ──────────────────────────────────────────────────────────────

const PALETTE = [
  "#4a90d9","#27b589","#e05a3a","#7c5cbf","#d4820a",
  "#d4537e","#0f9b8e","#e84393","#4a9b4a","#d93b3b",
  "#6677aa","#e8872d",
];

const LEVEL_XP = [0,100,250,500,850,1300,1900,2600,3500,4600,6000];
const LEVEL_COLORS = [
"#27b589", // L1
"#27b589", // L2
"#27b589", // L3

"#4a90d9", // L4
"#4a90d9", // L5
"#4a90d9", // L6
"#4a90d9", // L7

"#7c5cbf", // L8
"#7c5cbf", // L9
"#7c5cbf", // L10
"#7c5cbf", // L11
"#7c5cbf", // L12

"#ffd700", // L13
"#ffd700", // L14
"#ffd700", // L15+
];

const ACHIEVEMENTS = [
  { id:"first",   icon:"🌱", name:"First Step",    desc:"Complete your first habit check" },
  { id:"streak3", icon:"🔥", name:"On a Roll",     desc:"3-day streak on any habit" },
  { id:"streak7", icon:"⚡", name:"Week Warrior",  desc:"7-day streak on any habit" },
  { id:"streak14",icon:"💪", name:"Fortnight Fire",desc:"14-day streak on any habit" },
  { id:"streak30",icon:"💎", name:"Month Master",  desc:"30-day streak on any habit" },
  { id:"perfect", icon:"⭐", name:"Perfectionist", desc:"Complete all habits in one day" },
  { id:"xp100",   icon:"💯", name:"Centurion",     desc:"Earn 100 XP total" },
  { id:"xp500",   icon:"🚀", name:"XP Machine",    desc:"Earn 500 XP total" },
  { id:"xp1000",  icon:"🌟", name:"XP Legend",     desc:"Earn 1000 XP total" },
  { id:"done30",  icon:"🎯", name:"Dedicated",     desc:"30 total habit completions" },
  { id:"done100", icon:"🏅", name:"Century Club",  desc:"100 total habit completions" },
  { id:"lvl5",    icon:"🏆", name:"Rising Star",   desc:"Reach Level 5" },
  { id:"lvl10",   icon:"👑", name:"Habit Hero",    desc:"Reach Level 10" },
];

const DEFAULT_HABITS = [
  { id:"h1", name:"Drink water 💧", goal:"8 cups",  color:"#4a90d9" },
  { id:"h2", name:"Exercise 🏃",    goal:"30 min",  color:"#27b589" },
  { id:"h3", name:"Read 📚",        goal:"20 min",  color:"#7c5cbf" },
  { id:"h4", name:"Meditate 🧘",    goal:"10 min",  color:"#d4537e" },
  { id:"h5", name:"Sleep early 😴", goal:"10 pm",   color:"#d4820a" },
];

// ── helpers ────────────────────────────────────────────────────────────────

function dateKey(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function lastNDays(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - n + 1 + i);
    return dateKey(d);
  });
}

function calcStreak(habitId, checks) {
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (checks[habitId]?.[dateKey(d)]) streak++;
    else break;
  }
  return streak;
}

function getLevel(xp) {
  let lvl = 1;
  for (let i = 1; i < LEVEL_XP.length; i++) {
    if (xp >= LEVEL_XP[i]) lvl = i + 1;
    else break;
  }
  return lvl;
}

function getLevelInfo(xp) {
  const lvl = getLevel(xp);
  const curr = LEVEL_XP[lvl - 1] ?? 0;
  const next = LEVEL_XP[lvl] ?? LEVEL_XP[LEVEL_XP.length - 1];
  const pct = next > curr ? Math.round(((xp - curr) / (next - curr)) * 100) : 100;
  return { lvl, pct, curr, next };
}

function checkAchievements(stats, earned) {
  const rules = {
    first:   (s) => s.totalDone >= 1,
    streak3: (s) => s.maxStreak >= 3,
    streak7: (s) => s.maxStreak >= 7,
    streak14:(s) => s.maxStreak >= 14,
    streak30:(s) => s.maxStreak >= 30,
    perfect: (s) => s.hadPerfectDay,
    xp100:   (s) => s.totalXP >= 100,
    xp500:   (s) => s.totalXP >= 500,
    xp1000:  (s) => s.totalXP >= 1000,
    done30:  (s) => s.totalDone >= 30,
    done100: (s) => s.totalDone >= 100,
    lvl5:    (s) => s.lvl >= 5,
    lvl10:   (s) => s.lvl >= 10,
  };
  return ACHIEVEMENTS.filter(a => !earned.includes(a.id) && rules[a.id]?.(stats)).map(a => a.id);
}

// ── storage hook ───────────────────────────────────────────────────────────

function useStorage(key, fallback) {
  const [value, setValue] = useState(() => {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue, true];
}

// ── sub-components ─────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }) {
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:4 }}>
      {PALETTE.map(c => (
        <div
          key={c}
          onClick={() => onChange(c)}
          style={{
            width:26, height:26, borderRadius:"50%", background:c, cursor:"pointer",
            border:`3px solid ${value===c ? "var(--color-text-primary)" : "transparent"}`,
            transform: value===c ? "scale(1.18)" : "scale(1)",
            transition:"transform .12s",
          }}
        />
      ))}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
   <div className="
bg-white/[0.06]
backdrop-blur-2xl
border border-white/15
rounded-3xl
p-4
shadow-2xl
shadow-black/20
hover:border-white/25
hover:-translate-y-2
hover:scale-[1.02]
hover:shadow-3xl
hover:bg-white/[0.09]
transition-all
duration-300
cursor-pointer
">
      <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:".06em", color:"var(--color-text-secondary)", marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:500, color }}>{value}</div>
    </div>
  );
}

function AchCard({ a, earned }) {
  return (
    <div style={{
      background: earned ? "var(--color-background-secondary)" : "var(--color-background-primary)",
      border: `0.5px solid ${earned ? "#27b589" : "var(--color-border-tertiary)"}`,
      borderRadius:10, padding:"11px 13px",
      display:"flex", gap:10, alignItems:"flex-start",
      opacity: earned ? 1 : 0.5, transition:"opacity .3s",
    }}>
      <div style={{ fontSize:22, flexShrink:0 }}>{a.icon}</div>
      <div>
        <div style={{ fontWeight:500, fontSize:13, color:"var(--color-text-primary)", marginBottom:2 }}>{a.name}</div>
        <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{a.desc}</div>
        {earned && <div style={{ fontSize:10, color:"#27b589", marginTop:3, fontWeight:500 }}>✅ Earned</div>}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#fff", border:"0.5px solid var(--color-border-tertiary)", borderRadius:7, padding:"6px 10px", fontSize:12, color:"#000" }}>
      <div style={{ fontWeight:500, marginBottom:2 }}>{label}</div>
      <div style={{ color:"var(--color-text-secondary)" }}>{payload[0].value}{payload[0].name === "pct" ? "%" : " days"}</div>
    </div>
  );
};

// ── main component ─────────────────────────────────────────────────────────

export default function HabitTracker() {
  const [habits, setHabits, habitsReady] = useStorage("ht2-habits", DEFAULT_HABITS);
  const [checks, setChecks, checksReady] = useStorage("ht2-checks", {});
  
  const [earned, setEarned, earnedReady] = useStorage("ht2-earned", []);
  const [moods, setMoods, moodsReady] =useStorage("ht2-moods", {});
  const [tab,    setTab]    = useState("tracker");
  const [modal,  setModal]  = useState(null);
  const [form,   setForm]   = useState({ name:"", goal:"", color:PALETTE[0] });
  const [toast, setToast] = useState(null)
  const [xpPop, setXpPop] = useState(null)
  const [levelUp, setLevelUp] = useState(null)
  const toastTimer = useRef(null);

const moodScore = {"😄":5,"🙂":4,"😐":3,"😔":2,"😵":1};
const weekMoodValues =
lastNDays(7)
.map(day => moodScore[moods[day]])
.filter(Boolean);
const firstHalf =
weekMoodValues
.slice(0,3)
.reduce((a,b)=>a+b,0);

const lastHalf =
weekMoodValues
.slice(-3)
.reduce((a,b)=>a+b,0);

const trend =
weekMoodValues.length >= 4
? lastHalf > firstHalf
  ? "📈 Mood improved this week"
  : lastHalf < firstHalf
    ? "📉 Mood dipped this week"
    : "➖ Stable mood pattern"
: `📊 ${weekMoodValues.length}/4 mood entries collected`;
  const ready = habitsReady && checksReady && earnedReady &&moodsReady;
  const today = dateKey();
  
const heatmapData = Object.values(checks)
.flatMap(habitChecks =>
Object.entries(habitChecks)
.filter(([_,done]) => done)
.map(([date]) => date)
)
.reduce((acc,date)=>{
acc[date]=(acc[date]||0)+1;
return acc;
},{});

const heatmapValues = Object.entries(heatmapData).map(
([date,count])=>({
date,
count
}));
const moodHabitData = Object.entries(moods).map(
([date, mood]) => {

const completed =
Object.values(checks)
.filter(habitChecks =>
habitChecks[date]
).length;

return {
date,
mood,
completed
};
});
const goodMoodDays =
  moodHabitData.filter(day =>
    ["😄","🙂"].includes(day.mood)
  );

const avgCompleted =
  goodMoodDays.length
    ? (
        goodMoodDays.reduce(
          (sum,day)=>sum+day.completed,
          0
        ) / goodMoodDays.length
      ).toFixed(1)
    : 0;

  // ── stats ──────────────────────────────────────────────────────────────
  const stats = (() => {
    if (!ready) return { totalDone:0, maxStreak:0, totalXP:0, hadPerfectDay:false, lvl:1, pct:0, next:100 };
    let totalDone=0, maxStreak=0, totalXP=0, hadPerfectDay=false;
    habits.forEach(h => {
      const hc = checks[h.id] || {};
      Object.values(hc).forEach(v => { if(v) { totalDone++; totalXP+=10; } });
      const s = calcStreak(h.id, checks);
      if (s > maxStreak) maxStreak = s;
      if (s > 1) totalXP += (s-1)*2;
    });
    lastNDays(60).forEach(dk => {
      if (habits.length > 0 && habits.every(h => checks[h.id]?.[dk])) hadPerfectDay = true;
    });
    const dates = Object.keys(
  Object.values(checks)
    .flatMap(habit =>
      Object.entries(habit)
        .filter(([_,done])=>done)
        .map(([date])=>date)
    )
    .reduce((acc,date)=>{
      acc[date]=true;
      return acc;
    },{})
).sort().reverse();

let currentStreak = 0;

const d = new Date();

while(true){

 const key=d.toISOString().split("T")[0];

 if(dates.includes(key)){
   currentStreak++;
   d.setDate(d.getDate()-1);
 }else{
   break;
 }

}
   const prevLvl =
getLevel(totalXP-10);

const { lvl, pct, next } =
getLevelInfo(totalXP);
    return {
 totalDone,
 maxStreak,
 currentStreak:maxStreak,
 totalXP,
 hadPerfectDay,
 lvl,
 prevLvl,
 pct,
 next
};
  })();

  // ── achievement checker ────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !habits.length) return;
    const newIds = checkAchievements(stats, earned);
    if (!newIds.length) return;
    setEarned(prev => [...prev, ...newIds]);
    const a = ACHIEVEMENTS.find(x => x.id === newIds[0]);
   if (a) {

  setToast({

    icon:"🏆",

    text:`Achievement unlocked: ${a.name}`

  });

clearTimeout(toastTimer.current);

toastTimer.current = setTimeout(() => {
  setToast(null);
}, 3000);
     
    }
  }, [checks, habits, ready]);
  useEffect(()=>{

if(stats.lvl>stats.prevLvl){

setLevelUp({
id:Date.now(),
text:`🎉 LEVEL UP → Level ${stats.lvl}`
});

setTimeout(()=>{
setLevelUp(null)
},3000);

}
},[stats.lvl]);

  // ── toggle ─────────────────────────────────────────────────────────────
const toggle = (habitId) => {
  const isBecomingDone = !checks[habitId]?.[today];

  setChecks(prev => {
    const hc = prev[habitId] || {};

    return {
      ...prev,
      [habitId]: {
        ...hc,
        [today]: !hc[today]
      }
    };
  });
if (!isBecomingDone) {
setHabits(prev =>
prev.map(h =>
h.id === habitId
? {
...h,
history: (h.history || []).includes(today)
? h.history
: [...(h.history || []), today]
}
: h
)
);
}
  if (isBecomingDone) {
    setXpPop({
      text:"+10 XP ⭐",
      id:Date.now()
    });

    setTimeout(()=>{
      setXpPop(null);
    },1200);
  }
};
//moods 
const MOODS = [
  { emoji:"😄", label:"Great", color:"#56d364" },
  { emoji:"🙂", label:"Good", color:"#58a6ff" },
  { emoji:"😐", label:"Okay", color:"#a1a1aa" },
  { emoji:"😔", label:"Bad", color:"#f59e0b" },
  { emoji:"😵", label:"Exhausted", color:"#ef4444" }
];
const moodSummary = MOODS.map(mood => ({
  ...mood,
  count: Object.values(moods).filter(
    m => m === mood.emoji
  ).length
})).filter(mood => mood.count > 0)
const topMood = moodSummary.sort(
(a,b)=>b.count-a.count
)[0]

const tiredDays =
moodSummary.find(m=>m.label==="Exhausted")?.count || 0;

const greatDays =
moodSummary.find(m=>m.label==="Great")?.count || 0;

let insightText = trend;

if(greatDays>=4){
 insightText="🔥 You had a very positive week. Keep repeating what worked.";
}
else if(tiredDays>=3){
 insightText="😴 Exhaustion appeared often this week. Sleep or workload may need attention.";
}
else if(tiredDays>=2 && greatDays>=2){
 insightText="📈 Mixed week detected — energy changed a lot.";
}

  // ── chart data ─────────────────────────────────────────────────────────
  const lineData = lastNDays(7).map(dk => {
    const done = habits.filter(h => checks[h.id]?.[dk]).length;
    const pct = habits.length ? Math.round(done / habits.length * 100) : 0;
    const d = new Date(dk.replaceAll("-", "/"));

return {
  label: d.toLocaleDateString("en", { weekday: "short" }),
  pct
};
  });

  const barData = habits.map(h => ({
    name: h.name.split(" ")[0],
    count: lastNDays(7).filter(dk => checks[h.id]?.[dk]).length,
    color: h.color,
  }));

  const todayDone = habits.filter(h => checks[h.id]?.[today]).length;
  const todayPct  = habits.length ? Math.round(todayDone / habits.length * 100) : 0;
  const lvlColor  = LEVEL_COLORS[Math.min(stats.lvl-1, LEVEL_COLORS.length-1)];

  // ── modal helpers ──────────────────────────────────────────────────────
  const openAdd  = () => { setForm({ name:"", goal:"", color:PALETTE[0] }); setModal({ mode:"add" }); };
  const openEdit = (i) => { setForm({ ...habits[i] }); setModal({ mode:"edit", idx:i }); };
  const closeModal = () => setModal(null);
  const saveHabit = () => {
    if (!form.name.trim()) return;
    if (modal.mode === "add") {
      setHabits(prev => [...prev, { ...form, id:"h"+Date.now() }]);
    } else {
      setHabits(prev => prev.map((h,i) => i === modal.idx ? { ...h, ...form } : h));
    }
    closeModal();
  };
  const delHabit = (i) => setHabits(prev => prev.filter((_,j) => j !== i));

  if (!ready) {
    return (
      <div style={{ padding:32, textAlign:"center", color:"var(--color-text-secondary)", fontSize:14 }}>
        Loading your tracker...
  
      </div>
    );
  }

  // ── render ─────────────────────────────────────────────────────────────
  return (
    
<div className="
min-h-screen
bg-slate-950
bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(147,51,234,.15),transparent_40%)]
text-white
p-6
">

    
      {/* Achievement toast */}
     {xpPop && (
  <div
    key={xpPop.id}
    style={{
      position:"fixed",
      bottom:120,
      right:40,
      color:"#ffd700",
      fontSize:24,
      fontWeight:700,
      animation:"floatXP 1.2s ease-out",
      pointerEvents:"none",
      zIndex:9999
    }}
  >
    {xpPop.text}
  </div>
)}

{levelUp && (

<div
key={levelUp.id}
style={{
position:"fixed",
top:"50%",
left:"50%",
transform:"translate(-50%,-50%)",
padding:"22px 34px",
borderRadius:22,
background:
"linear-gradient(135deg,#7c3aed,#4f46e5)",

boxShadow:
"0 0 50px rgba(124,58,237,.6)",

fontSize:28,
fontWeight:800,
color:"#fff",
zIndex:10000,
animation:"slideIn .4s ease"
}}
>

{levelUp.text}

</div>

)}

{toast && (

  <div

    style={{
  position:"fixed",
  top:20,
  right:60,
  zIndex:9999,
  padding:"12px 16px",
  borderRadius:12,
  background:"rgba(35, 20, 20, 0.88)",
  border:"1px solid rgba(255,255,255,.1)",
  color:"#fff",
  fontSize:14,
  fontWeight:600,

  maxWidth:260,
  whiteSpace:"normal",
  wordBreak:"break-word",

  animation:"slideIn .3s ease"


    }}

  >

  
 {toast.icon} {toast.text}

  </div>

)}


      {/* Header */}
{/* Header */}
<div
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    flexWrap: "wrap",
    gap: 8
  }}
>

  {/* LEFT */}
  <div style={{ display:"flex", alignItems:"center", gap:10 }}>

    <div
  style={{
    minWidth:70,
    height:56,
    borderRadius:16,
    display:"flex",
    alignItems:"center",
    justifyContent:"center",
    flexDirection:"column",

    background:
      "linear-gradient(135deg,#4f46e5,#7c3aed)",

    boxShadow:
      "0 0 18px rgba(124,58,237,.45)",

    border:"1px solid rgba(255,255,255,.12)"
    
  }}
>
  <div
    style={{
      fontSize:10,
      opacity:.75,
      letterSpacing:1
    }}
  >
    LEVEL
  </div>

  <div
    style={{
      fontSize:24,
      fontWeight:800,
      lineHeight:1
    }}
  >
    {stats.lvl}
  </div>
</div>

    <div>

      <div
        style={{
          fontSize:16,
          fontWeight:500,
          color:"var(--color-text-primary)"
        }}
      >
        Habit Tracker 📸
      </div>

      <div
        style={{
          fontSize:11,
          color:"var(--color-text-secondary)"
        }}
      >
        {stats.totalXP} XP • next level at {stats.next} XP
      </div>

 <div
  style={{
    display:"flex",
    gap:14,
    alignItems:"center",
    marginTop:6
  }}
>
  <span
    style={{
      fontSize:13,
      color:"#ff8c42",
      fontWeight:600
    }}
  >
    🔥 {stats.currentStreak} day streak
  </span>

  <span
    style={{
      fontSize:11,
      color:"var(--color-text-secondary)"
    }}
  >
    SHOW UP DAILY CHAMP !
  </span>
</div>

    </div>
  </div>

  {/* RIGHT */}
  <div
    style={{
      display:"flex",
      alignItems:"center",
      justifyContent:"flex-end",
      gap:12
    }}
  >
 {[

["🟩","heatmap"],
["😊","mood"],
["📅","insights"]

].map(([icon,name])=>(
<button
 key={name}
 onClick={()=>setTab(name)}
 onMouseEnter={(e)=>{
 e.currentTarget.style.transform="translateY(-2px) scale(1.06)"
}}
onMouseLeave={(e)=>{
 e.currentTarget.style.transform="translateY(0) scale(1)"
}}
 style={{
   width:40,
   height:40,
   transition:"0.3s",
   borderRadius:10,
   border:"1px solid rgba(255,255,255,.1)",
   background:"rgba(255,255,255,.05)",
   boxShadow:"0 6px 18px rgba(0,0,0,.25)",
   cursor:"pointer",
   fontSize:16
 }}
>
 {icon}
</button>
))}
        
          {[["tracker","📊 Tracker","#4a90d9"],["achievements","🏆 Achievements","#7c5cbf"]].map(([t,label,col])=>(
            <button key={t} onClick={()=>setTab(t)} style={{ fontSize:12, padding:"5px 11px", border:"0.5px solid", borderColor:tab===t?"transparent":"var(--color-border-secondary)", borderRadius:7, cursor:"pointer", background:tab===t?col:"none", color:tab===t?"#fff":"var(--color-text-primary)", fontWeight:tab===t?500:400 }}>
              {label} {t==="achievements" && earned.length>0 && <span style={{background:"rgba(255,255,255,0.08)",
backdropFilter:"blur(16px)",
WebkitBackdropFilter:"blur(16px)",
border:"1px solid rgba(255,255,255,.12)",
boxShadow:"0 8px 32px rgba(0,0,0,.25)",borderRadius:10,padding:"0 5px",fontSize:10,marginLeft:3}}>{earned.length}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* XP level bar */}
      
 {/* XP level bar */}

<div
style={{
 display:"flex",
 justifyContent:"space-between",
 alignItems:"center",
 marginBottom:10
}}
>

<div style={{display:"flex",alignItems:"center",gap:10}}>

<div
style={{
 width:42,
 height:42,
 borderRadius:"50%",
 background:`conic-gradient(
 ${lvlColor} ${stats.pct*3.6}deg,
 rgba(255,255,255,.10) 0deg
 )`,
 display:"flex",
 alignItems:"center",
 justifyContent:"center",
 boxShadow:`0 0 18px ${lvlColor}55`,
 transition:"all .7s ease"
}}
>

<div
style={{
 width:30,
 height:30,
 borderRadius:"50%",
 background:"rgba(15,23,42,.95)",
 display:"flex",
 alignItems:"center",
 justifyContent:"center",
 fontSize:11,
 fontWeight:700,
 color:"#fff",
 border:"1px solid rgba(255,255,255,.08)"
}}
>
{stats.pct}%
</div>

</div>

<div>
<div style={{fontSize:16,fontWeight:600}}>
Level {stats.lvl}
</div>

<div style={{
 fontSize:11,
 color:"var(--color-text-secondary)"
}}>
{stats.totalXP} XP
</div>
</div>

</div>

</div>


  
    

       {tab==="heatmap" ? (

<div
style={{
padding:20,
paddingLeft:20,
minHeight:220,
borderRadius:24,
background:"rgba(255,255,255,.05)",
backdropFilter:"blur(20px)"
}}
>

<h2 style={{marginBottom:20}}>
🟩 Yearly Habit Heatmap
</h2>


<CalendarHeatmap
  startDate={
    new Date(
      new Date().setFullYear(
        new Date().getFullYear() - 1
      )
    )
  }

  endDate={new Date()}

  values={heatmapValues}

  showWeekdayLabels={true}
  weekdayLabels={["", "Mon", "", "Wed", "", "Fri", ""]}

  horizontal={true}

  gutterSize={3}

  showOutOfRangeDays={true}

  classForValue={(value) => {
    if (!value || value.count == null)
      return "color-empty";

    if (value.count === 1) return "color-github-1";
    if (value.count === 2) return "color-github-2";
    if (value.count === 3) return "color-github-3";

    return "color-github-4";
  }}
/>
</div>
) :

tab==="mood" ? (

<div
style={{
display:"grid",
gridTemplateColumns:"1fr 280px",
gap:20,
padding:16,
borderRadius:20,
background:"rgba(255,255,255,.05)",
marginTop:14
}}
>

{/* LEFT SIDE */}
<div>

<div
style={{
fontSize:15,
fontWeight:600,
marginBottom:12
}}
>
🙂 Today's Mood
</div>

{/* Recent moods */}
<div style={{marginBottom:14}}>
<div
style={{
marginBottom:10,
fontSize:13,
fontWeight:600,
color:"rgba(255,255,255,.7)"
}}
>
Recent moods
</div>

<div
style={{
display:"flex",
gap:10,
flexWrap:"wrap"
}}
>
{lastNDays(7).map(day=>(
<div
key={day}
style={{
width:42,
padding:"8px 4px",
borderRadius:10,
textAlign:"center",
background:"rgba(255,255,255,.06)"
}}
>
<div style={{fontSize:11}}>
{new Date(day).toLocaleDateString(
"en-US",
{weekday:"short"}
)}
</div>

<div style={{fontSize:20}}>
{moods[day] || "⬜"}
</div>

</div>
))}
</div>
</div>

{/* choose mood */}
<div
style={{
marginBottom:10,
fontSize:13,
fontWeight:600,
color:"rgba(255,255,255,.7)"
}}
>
Choose mood
</div>

<div
style={{
display:"flex",
gap:12,
flexWrap:"wrap"
}}
>
{MOODS.map(mood=>(
<button
key={mood.label}
onClick={()=>
setMoods(prev=>({
...prev,
[today]:mood.emoji
}))
}
style={{
border:"none",
borderRadius:14,
padding:"10px 14px",
fontSize:24,
cursor:"pointer",

background:
moods[today]===mood.emoji
? mood.color
: "rgba(255,255,255,.08)",

transform:
moods[today]===mood.emoji
? "scale(1.08)"
: "scale(1)",

transition:"all .25s"
}}
>
{mood.emoji}
</button>
))}
</div>

<div
style={{
marginTop:15,
fontSize:14,
color:"rgba(255,255,255,.75)"
}}
>
Current mood:
{
MOODS.find(
m=>m.emoji===moods[today]
)?.label || "Not selected"
}
{" "}
{moods[today] || ""}
</div>

</div>


{/* RIGHT SIDE */}
<div
style={{
padding:14,
borderRadius:16,
background:"rgba(255,255,255,.05)",
height:"fit-content"
}}
>

<div
style={{
fontSize:14,
fontWeight:600,
marginBottom:12
}}
>
📊 Mood Count
</div>

{moodSummary.map(mood=>(
<div
key={mood.label}
style={{
display:"flex",
justifyContent:"space-between",
marginBottom:10,
fontSize:14
}}
>
<span>
{mood.emoji} {mood.label}
</span>

<span
style={{
fontWeight:700,
color:mood.color
}}
>
{mood.count}
</span>

</div>
))}

</div>

</div>

): tab==="insights" ? (

<div
style={{
marginTop:16,
padding:14,
borderRadius:16,
background:"rgba(255,255,255,.05)",
border:"1px solid rgba(255,255,255,.08)"
}}
>
<div
style={{
fontSize:12,
opacity:.7,
marginBottom:6
}}
>
🧠 AI Weekly Insight
</div>

<div style={{fontSize:14,fontWeight:600}}>
{insightText}
</div>
</div>

) : tab==="tracker" ? (
        <>
          {/* Stat cards */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:12 }}>
            <StatCard label="Today ✅" value={`${todayDone}/${habits.length}`} color="#4a90d9" />
            <StatCard label="Best Streak 🔥" value={stats.maxStreak+"d"}          color="#e05a3a" />
            <StatCard label="Total XP ⭐"   value={stats.totalXP}                 color="#d4820a" />
            <StatCard label="All time ✅"   value={stats.totalDone}              color="#27b589" />
          </div>

          {/* Charts row */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-2xl">
              <div style={{ fontSize:10, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:".07em", marginBottom:7 }}>7-day completion %</div>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,.13)" vertical={false}/>
                  <XAxis dataKey="label" tick={{ fontSize:10, fill:"#999" }} axisLine={false} tickLine={false}/>
                  <YAxis domain={[0,100]} tick={{ fontSize:10, fill:"#999" }} axisLine={false} tickLine={false} tickFormatter={v=>v+"%"} width={32}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Line type="monotone" dataKey="pct" name="pct" stroke="#4a90d9" strokeWidth={2} dot={{ r:3, fill:"#4a90d9", stroke:"#fff", strokeWidth:1.5 }} activeDot={{ r:5 }}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:12, padding:"11px 13px" }}>
              <div style={{ fontSize:10, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:".07em", marginBottom:7 }}>Habit score (7 days)</div>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={barData} margin={{ left:-10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,.13)" vertical={false}/>
                  <XAxis dataKey="name" tick={{ fontSize:9, fill:"#999" }} axisLine={false} tickLine={false}/>
                  <YAxis domain={[0,7]} tick={{ fontSize:10, fill:"#999" }} axisLine={false} tickLine={false} tickFormatter={v=>v+"/7"} width={28}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Bar dataKey="count" name="count" radius={[4,4,0,0]}>
                    {barData.map((d,i) => <Cell key={i} fill={d.color}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Habits table */}
         <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl mt-6">
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <div style={{ fontSize:12, fontWeight:500, color:"var(--color-text-primary)" }}>
                📅 {new Date().toLocaleDateString("en",{ weekday:"long", month:"short", day:"numeric" })}
              </div>
              <button onClick={openAdd} style={{ background:"#4a90d9", color:"#fff", border:"none", borderRadius:7, padding:"5px 12px", fontSize:12, cursor:"pointer", fontWeight:500 }}>
                + Add habit
              </button>
            </div>

            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, tableLayout:"fixed" }}>
                <thead>
                  <tr style={{ borderBottom:"0.5px solid var(--color-border-tertiary)" }}>
                    {["Habit","Goal","Streak","XP Today","Done",""].map((h,i)=>(
                      <th key={i} style={{ padding:"5px 4px", textAlign:i===0?"left":"center", fontSize:10, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:".05em", width:["135px","58px","58px","68px","52px","64px"][i] }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {habits.map((h, i) => {
                    const done   = !!checks[h.id]?.[today];
                    const streak = calcStreak(h.id, checks);
                    const xp     = done ? 10 + (streak > 1 ? (streak-1)*2 : 0) : 0;
                    return (
                      <tr key={h.id} style={{ borderBottom:"0.5px solid var(--color-border-tertiary)", background: done ? h.color+"22" : "transparent", transition:"background .35s" }}>
                        <td style={{ padding:"8px 4px", fontWeight:500, color:"var(--color-text-primary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          <span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:h.color, marginRight:6, verticalAlign:"middle", flexShrink:0 }}/>
                          {h.name}
                        </td>
                        <td style={{ textAlign:"center", color:"var(--color-text-secondary)", fontSize:11 }}>{h.goal || "—"}</td>
                        <td style={{ textAlign:"center", fontWeight:500, color: streak>=7?"#e05a3a": streak>=3?"#d4820a":"var(--color-text-secondary)" }}>
                          {streak > 0 ? "🔥" : ""}{streak}d
                        </td>
                        <td style={{ textAlign:"center", color:"#d4820a", fontWeight:500 }}>
                          {done ? `+${xp} ⭐` : <span style={{color:"var(--color-text-secondary)"}}>—</span>}
                        </td>
                        <td style={{ textAlign:"center" }}>
                          <div
                            onClick={() => toggle(h.id)}
                            style={{ width:22, height:22, borderRadius:5, border:`2.5px solid ${done ? h.color : "#bbb"}`, background:done ? h.color : "transparent", cursor:"pointer", display:"inline-flex", alignItems:"center", justifyContent:"center", transition:"all .18s" }}
                          >
                            {done && <span style={{ color:"#fff", fontSize:14, lineHeight:1, fontWeight:700 }}>✓</span>}
                          </div>
                        </td>
                        <td style={{ textAlign:"center" }}>
                          <button onClick={()=>openEdit(i)} title="Edit" style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, padding:"2px 5px", borderRadius:4, color:"var(--color-text-secondary)" }}>✏️</button>
                          <button onClick={()=>delHabit(i)} title="Delete" style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, padding:"2px 5px", borderRadius:4, color:"var(--color-text-secondary)" }}>🗑️</button>
                        </td>
                      </tr>
                    );
                  })}
                  {habits.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign:"center", padding:"22px 0", color:"var(--color-text-secondary)", fontSize:13 }}>
                        No habits yet — click <strong>+ Add habit</strong> to get started! 🚀
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Today's progress bar */}
            <div style={{ marginTop:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--color-text-secondary)", marginBottom:4 }}>
                <span>Today's progress</span>
                <span style={{ fontWeight:500, color: todayPct===100 ? "#27b589" : "#4a90d9" }}>{todayPct}%</span>
              </div>
              <div style={{ background:"var(--color-background-secondary)", borderRadius:4, height:8, overflow:"hidden" }}>
                <div style={{ width:todayPct+"%", height:"100%", background: todayPct===100 ? "#27b589" : "#4a90d9", borderRadius:4, transition:"width .45s ease, background .45s" }}/>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Achievements tab */
        <div>
          <div style={{ fontSize:13, color:"var(--color-text-secondary)", marginBottom:10 }}>
            {earned.length} of {ACHIEVEMENTS.length} unlocked
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:9 }}>
            {ACHIEVEMENTS.map(a => <AchCard key={a.id} a={a} earned={earned.includes(a.id)}/>)}
          </div>
        </div>
      )}

      

      {/* Modal overlay — position absolute inside relative wrapper */}
      {modal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
          style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.42)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, borderRadius:12 }}
        >
          <div style={{ background:"var(--color-background-primary)", borderRadius:14, border:"0.5px solid var(--color-border-tertiary)", padding:22, width:300, maxWidth:"92%" }}>
            <h3 style={{ fontSize:15, fontWeight:500, marginBottom:16, color:"var(--color-text-primary)" }}>
              {modal.mode==="add" ? "Add new habit" : "Edit habit"}
            </h3>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:"block", fontSize:11, color:"var(--color-text-secondary)", marginBottom:4 }}>Habit name</label>
              <input
                type="text" value={form.name} maxLength={28} autoFocus
                onChange={e => setForm(p => ({ ...p, name:e.target.value }))}
                onKeyDown={e => e.key==="Enter" && saveHabit()}
                placeholder="e.g. Morning walk 🚶"
                style={{ width:"100%", padding:"7px 10px", border:"0.5px solid var(--color-border-secondary)", borderRadius:7, fontSize:13, background:"var(--color-background-primary)", color:"var(--color-text-primary)" }}
              />
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:"block", fontSize:11, color:"var(--color-text-secondary)", marginBottom:4 }}>Goal label <span style={{opacity:.6}}>(optional)</span></label>
              <input
                type="text" value={form.goal} maxLength={16}
                onChange={e => setForm(p => ({ ...p, goal:e.target.value }))}
                onKeyDown={e => e.key==="Enter" && saveHabit()}
                placeholder="e.g. 30 min"
                style={{ width:"100%", padding:"7px 10px", border:"0.5px solid var(--color-border-secondary)", borderRadius:7, fontSize:13, background:"var(--color-background-primary)", color:"var(--color-text-primary)" }}
              />
            </div>
            <div style={{ marginBottom:18 }}>
              <label style={{ display:"block", fontSize:11, color:"var(--color-text-secondary)", marginBottom:4 }}>Colour</label>
              <ColorPicker value={form.color} onChange={c => setForm(p => ({ ...p, color:c }))}/>
            </div>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={closeModal} style={{ padding:"7px 16px", borderRadius:7, fontSize:13, cursor:"pointer", border:"0.5px solid var(--color-border-secondary)", background:"none", color:"var(--color-text-primary)" }}>Cancel</button>
              <button onClick={saveHabit} style={{ padding:"7px 16px", borderRadius:7, fontSize:13, cursor:"pointer", border:"none", background:"#4a90d9", color:"#fff", fontWeight:500 }}>
                {modal.mode==="add" ? "Add habit" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}