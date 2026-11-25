// SamOS Command pairing — plaintext token never stored in the database.
(() => {
 const $=id=>document.getElementById(id);
 const pair=$("watch-pair"), revoke=$("watch-revoke"), field=$("watch-token"), copy=$("watch-copy"), status=$("watch-status");
 if(!pair)return;
 const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
 function clear(){field.value="";field.hidden=true;copy.hidden=true;}
 async function run(action){
  pair.disabled=revoke.disabled=true;
  clear();
  try{
   const {data,error}=await supabaseClient.auth.getUser();
   if(error||!data.user){status.textContent="Sign in first.";return;}
   const uid=data.user.id;
   if(action==="revoke"){
    const {error}=await supabaseClient.from("samos_watch_tokens").delete().eq("user_id",uid);
    if(error)throw error;
    status.textContent="Watch token revoked.";return;
   }
   const token="samos_"+hex(crypto.getRandomValues(new Uint8Array(32)));
   const token_hash=hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token))));
   const {error:saveError}=await supabaseClient.from("samos_watch_tokens").upsert({user_id:uid,token_hash,created_at:new Date().toISOString()},{onConflict:"user_id"});
   if(saveError)throw saveError;
   field.value=token;field.hidden=false;copy.hidden=false;
   status.textContent="Copy this private token into your shortcut. It will not be shown again after leaving this page.";
  }catch{status.textContent="Could not update Watch pairing. Try again.";}
  finally{pair.disabled=revoke.disabled=false;}
 }
 pair.addEventListener("click",()=>run("pair"));
 revoke.addEventListener("click",()=>run("revoke"));
 copy.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(field.value);status.textContent="Token copied. Keep it private.";}catch{field.focus();field.select();status.textContent="Select and copy the token manually.";}});
 document.getElementById("supabase-logout")?.addEventListener("click",clear);
})();