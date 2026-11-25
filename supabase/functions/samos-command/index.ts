// SamOS Command v1 — scoped, revocable device credential; never log tokens.
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const reply = (message: string, status = 200) => Response.json({ok:status===200,message},{status,headers:{"Cache-Control":"no-store"}});
const hash = async (s:string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))), b=>b.toString(16).padStart(2,"0")).join("");
const day = (delta=0) => {
 const today = new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const d = new Date(today+"T12:00:00Z"); d.setUTCDate(d.getUTCDate()+delta); return d.toISOString().slice(0,10);
};
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
 if(/^(what do i need to do|what(?:'s| is) (?:on my schedule|coming up)|show (?:my )?(?:tasks|schedule)) (today|tomorrow)$/i.test(command)){
 const date=day(/tomorrow$/i.test(command)?1:0);
 const {data,error}=await db.from("upcoming_items").select("title,time").eq("user_id",uid).eq("date",date).order("time").limit(30);
 if(error)throw error;
 return reply(data.length?data.map(x=>x.time.slice(0,5)+" "+x.title).join("; ")+".":"No directly scheduled items for that date. Recurring items may still apply.");
 }
 return reply("I can add groceries, read your shopping list, or check directly scheduled items for today or tomorrow. Try: Add cheese to my groceries.");
 }catch{return reply("SamOS could not complete the command. Please try again.",500);}
});