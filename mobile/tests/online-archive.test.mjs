import { readFileSync } from "fs";
import vm from "vm";
const g = { console, AbortController, setTimeout, clearTimeout, URLSearchParams, Blob, btoa, atob, fetch, navigator:{onLine:true}, addEventListener(){} };
g.window=g; g.globalThis=g; g.localStorage={getItem:()=>null,setItem(){}};
g.DB={localIndex:{}};
vm.createContext(g);
vm.runInContext(readFileSync("/home/user/musikbox/mobile/www/js/i18n.js","utf8"),g);
vm.runInContext(readFileSync("/home/user/musikbox/mobile/www/js/store.js","utf8"),g);
vm.runInContext(readFileSync("/home/user/musikbox/mobile/www/js/api.js","utf8"),g);
const API=g.API;
// 1) online search on working domain
const web = await API.searchWeb("daft punk", 8);
console.log("web search (houseofcosmetics):", web.length, "real results");
web.slice(0,3).forEach(t=>console.log("  -", t.title.slice(0,46), "| art:", t.artist.slice(0,16), "| vid", t.videoId, "| dur", t.duration+"s"));
// 2) resolve a web item to a real playable track
if (web[0]) {
  const res = await API.resolvePlayable(web[0], API);
  console.log("resolved playable:", res ? (res.title.slice(0,40)+" | src="+(res.src||"").slice(0,60)+" | full="+res.full) : "NONE");
  if (res && res.src) {
    const r = await fetch(res.src, {headers:{Range:"bytes=0-511"},signal:AbortSignal.timeout(20000)});
    console.log("  stream check:", r.status, r.headers.get("access-control-allow-origin"), r.headers.get("content-type"));
  }
}
// 3) full app search merge sanity
console.log("sample keys:", web.map(t=>t.key).join(", "));
