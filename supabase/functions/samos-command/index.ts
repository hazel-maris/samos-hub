// SamOS Command v1 — scoped, revocable device credential; never log tokens.
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const reply = (message: string, status = 200) => Response.json({ok:status===200,message},{status,headers:{"Cache-Control":"no-store"}});
const hash = async (s:string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))), b=>b.toString(16).padStart(2,"0")).join("");
const day = (delta=0) => {
 const today = new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const d = new Date(today+"T12:00:00Z"); d.setUTCDate(d.getUTCDate()+delta); return d.toISOString().slice(0,10);
};
// Match the Hub's calendar-day recurrence rules, independently of daylight saving.
function occurs(item:{date:string;recurrence:string|null}, date:string) {
 if(date<item.date)return false;
 if(!item.recurrence)return item.date===date;
 if(item.recurrence==="daily")return true;
 const start=new Date(item.date+"T12:00:00Z"), target=new Date(date+"T12:00:00Z");
 if(item.recurrence==="weekly")return ((target.getTime()-start.getTime())/86400000)%7===0;
 if(item.recurrence==="monthly")return start.getUTCDate()===target.getUTCDate();
 if(item.recurrence==="yearly")return start.getUTCMonth()===target.getUTCMonth()&&start.getUTCDate()===target.getUTCDate();
 return false;
}
function normalizeSpeech(command:string){
 return command.toLowerCase().replace(/[’‘]/g,"'").replace(/\b(um+|uh+|erm+|hmm+|you know|i mean|kind of|sort of)\b/g," ").replace(/[,?!]/g," ").replace(/\s+/g," ").trim();
}
function interpretSchedule(command:string, base=day()){
 const t=normalizeSpeech(command);
 if(/\b(add|delete|remove|cancel|reschedule|create|update|change|move|set|remind|complete|finish)\b/.test(t))return null;
 if(/\b(weather|temperature|forecast|groceries|shopping|dinner|lunch|breakfast|quote)\b/.test(t))return null;
 const recurring=/\b(recur\w*|reoccurr\w*|repeat\w*|regular|routine[s]?)\b/.test(t);
 const subject=/\b(schedule|events?|appointments?|tasks?|calendar|plans?|agenda|upcoming|items?|things?)\b/.test(t);
 const question=/\b(what|anything|something|do i|have i|tell me|show|read|list|check|any|wondering|have got|have to)\b/.test(t);
 const anchor=new Date(base+"T12:00:00Z");
 const iso=(d:Date)=>d.toISOString().slice(0,10);
 const shift=(n:number)=>{const d=new Date(anchor);d.setUTCDate(d.getUTCDate()+n);return iso(d);};
 const valid=(y:number,m:number,d:number)=>{if(y<1900||y>9999||m<1||m>12||d<1||d>31)return null;const x=new Date(Date.UTC(y,m-1,d,12));return x.getUTCMonth()===m-1&&x.getUTCDate()===d?iso(x):null;};
 const months=["january","february","march","april","may","june","july","august","september","october","november","december"];
 const weekdays=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
 const dates:string[]=[];
 let invalid=false;
 const addDate=(date:string|null)=>{if(date)dates.push(date);else invalid=true;};
 const numeric=t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
 const slash=t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?\b/);
 const named=t.match(new RegExp("\\b("+months.join("|")+")\\s+(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(\\d{4}))?\\b"));
 const reverse=t.match(new RegExp("\\b(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?("+months.join("|")+")\\b"));
 if(numeric)addDate(valid(+numeric[1],+numeric[2],+numeric[3]));
 else if(slash||named||reverse){
 const m=slash?+slash[1]:named?months.indexOf(named[1])+1:months.indexOf(reverse![2])+1;
 const d=slash?+slash[2]:named?+named[2]:+reverse![1];
 const given=slash?.[3]||named?.[3];
 const y=given?(given.length===2?2000+Number(given):Number(given)):anchor.getUTCFullYear();
 let date=valid(y,m,d);
 if(!given&&date&&date<base)date=valid(y+1,m,d);
 addDate(date);
 }
 const relative=t.match(/\b(?:in\s+(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten)\s+days?|(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten)\s+days?\s+from now)\b/);
 if(relative){const n=relative[1]||relative[2];const words=["zero","one","two","three","four","five","six","seven","eight","nine","ten"];addDate(shift(/^\d+$/.test(n)?+n:words.indexOf(n)));}
 if(/\bday after tomorrow\b/.test(t))addDate(shift(2));
 else if(/\b(tomorrow|next day)\b/.test(t))addDate(shift(1));
 if(/\b(today|tonight|this morning|this afternoon|this evening)\b/.test(t))addDate(base);
 if(/\byesterday\b/.test(t))addDate(shift(-1));
 for(const match of t.matchAll(/\b(?:(next|last|this|coming)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g)){
 const wd=weekdays.indexOf(match[2]), current=anchor.getUTCDay();
 let n=(wd-current+7)%7;
 if(match[1]==="next")n+=7;
 if(match[1]==="last")n=n===0?-7:n-7;
 addDate(shift(n));
 }
 const unique=[...new Set(dates)];
 if(invalid||unique.length>1)return {date:null,recurring,clarify:true};
 if(unique.length===1)return {date:unique[0],recurring,clarify:false};
 if(recurring)return {date:null,recurring:true,clarify:false};
 if(/\b(next week|this week|next month|this month|weekend|next year|on the \d+)\b/.test(t))return {date:null,recurring:false,clarify:true};
 if(subject&&question)return {date:base,recurring:false,clarify:false};
 return null;
}
function speakTime(value:string){
 const [h,m]=value.split(":").map(Number);
 return (h%12||12)+(m?":"+String(m).padStart(2,"0"):"")+(h<12?" AM":" PM");
}
Deno.serve(async req=>{
 if(req.method!=="POST") return reply("Use POST.",405);
 const token=req.headers.get("x-samos-token")||"";
 if(!/^samos_[0-9a-f]{64}$/.test(token)) return reply("Pair SamOS in Settings first.",401);
 try {
 const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:pair,error:pairError}=await db.from("samos_watch_tokens").select("user_id").eq("token_hash",await hash(token)).maybeSingle();
 if(pairError) return reply("SamOS pairing unavailable.",503);
 if(!pair) return reply("Pairing invalid or revoked.",401);
 const uid=pair.user_id;
 const raw=await req.text();
 if(raw.length>4096) return reply("Command too long.",400);
 let body; try {body=JSON.parse(raw)} catch {return reply("Invalid command.",400)}
 if(typeof body?.command!=="string"||body.command.length>500) return reply("Please dictate a short command.",400);
 const command=body.command.trim().replace(/[.!?]+$/,"");
 if(/^(hello|ping|test|status|are you there)$/i.test(command)) return reply("SamOS is online. Ready for your next command.");
 if(/^(show|read|list|what(?:'s| is) on|what do i need (?:to buy|from the store)) (?:my )?(?:groceries|shopping list)$/i.test(command)||/^(groceries|shopping list|what do i need to buy)$/i.test(command)){
 const {data,error}=await db.from("grocery_items").select("name").eq("user_id",uid).eq("needed",true).order("name").limit(50);
 if(error) throw error;
 return reply(data.length?"Your shopping list: "+data.map(x=>x.name).join(", ")+".":"Your shopping list is empty.");
 }
 const add=command.match(/^add\s+(.+?)\s+to\s+(?:my\s+|the\s+)?(?:groceries|grocery list|shopping list)$/i);
 if(add){
 const names=[...new Map(add[1].split(/\s+and\s+|\s*,\s*/i).map(x=>x.trim()).filter(Boolean).map(x=>[x.toLowerCase(),x])).values()];
 if(!names.length||names.length>10||names.some(x=>x.length>100))return reply("Please name up to ten short grocery items.",400);
 const {data:existing,error:e}=await db.from("grocery_items").select("id,name").eq("user_id",uid); if(e)throw e;
 const {data:defaults,error:f}=await db.from("grocery_defaults").select("name,storage,stores").eq("user_id",uid);if(f)throw f;
 const completed:string[]=[];
 for(const name of names){
 const same=(x:{name:string})=>x.name.trim().toLowerCase()===name.toLowerCase();
 const prior=existing.find(same), template=defaults.find(same);
 const result=prior?await db.from("grocery_items").update({needed:true}).eq("id",prior.id).eq("user_id",uid):await db.from("grocery_items").insert({user_id:uid,name:template?.name||name,storage:template?.storage||"Shelf-stable",stores:template?.stores||[],needed:true});
 if(result.error)return reply("Could not finish. Added: "+(completed.join(", ")||"nothing")+".",500);
 completed.push(name);
 }
 return reply("On your shopping list: "+completed.join(", ")+".");
 }
 const schedule=interpretSchedule(command);
 if(schedule){
 if(schedule.clarify)return reply("Which date did you mean?");
 const date=schedule.date??day();
 const {data,error}=await db.from("upcoming_items").select("title,time,date,recurrence").eq("user_id",uid).order("time");
 if(error)throw error;
 const rows=data.filter(x=>schedule.recurring&&!x.recurrence?false:schedule.date===null?["daily","weekly","monthly","yearly"].includes(x.recurrence):occurs(x,date));
 const label=schedule.date===null?"Your recurring items":date===day(1)?"Tomorrow":date===day()?"Today":new Intl.DateTimeFormat("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric",timeZone:"UTC"}).format(new Date(date+"T12:00:00Z"));
 if(!rows.length)return reply(schedule.date===null?"You have no recurring items.":label+": no "+(schedule.recurring?"recurring items":"scheduled items")+".");
 const spoken=rows.slice(0,30).map(x=>speakTime(x.time)+" "+(x.title||"Untitled item")+(schedule.date===null?", repeats "+x.recurrence:""));
 return reply(label+": "+spoken.join("; ")+(rows.length>30?"; and "+(rows.length-30)+" more.":"."));
 }
 return reply("I didn't quite get that.");
 }catch{return reply("SamOS could not complete the command. Please try again.",500);}
});