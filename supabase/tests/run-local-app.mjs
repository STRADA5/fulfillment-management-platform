import { execFileSync, spawn } from "node:child_process";
import { resolve } from "node:path";

const status=execFileSync(process.platform==="win32"?"cmd.exe":resolve("node_modules/.bin/supabase"),process.platform==="win32"?["/d","/s","/c","node_modules\\.bin\\supabase.cmd status -o env"]:["status","-o","env"],{encoding:"utf8"});
const local=Object.fromEntries([...status.matchAll(/^([A-Z_]+)="(.*)"$/gm)].map(m=>[m[1],m[2]]));
if(new URL(local.API_URL).hostname!=="127.0.0.1")throw new Error("Local Supabase is required.");
const nextArgs=process.argv.includes("--build")?["build"]:["dev","--hostname","127.0.0.1","--port","3000"];
const child=spawn(process.execPath,[resolve("node_modules/next/dist/bin/next"),...nextArgs],{
 stdio:"inherit",env:{...process.env,NEXT_TELEMETRY_DISABLED:"1",NEXT_PUBLIC_SUPABASE_URL:local.API_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:local.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:local.SERVICE_ROLE_KEY},
});
child.on("exit",code=>{process.exitCode=code??1;});
