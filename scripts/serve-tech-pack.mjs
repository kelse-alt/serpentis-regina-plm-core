/** Local static preview of the fully offline build. No remote submission. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const files = new Map([['/',new URL('../tech-pack.html',import.meta.url)],['/tech-pack.html',new URL('../tech-pack.html',import.meta.url)],['/client-intake.html',new URL('../client-intake.html',import.meta.url)]]);
const server=createServer(async (req,res)=>{
 if(req.method!=='GET'||!files.has(req.url)){res.writeHead(404);res.end('Not found');return;}
 try{const html=await readFile(files.get(req.url));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(html);}catch{res.writeHead(500);res.end('Run npm run techpack:build first.');}
});
server.listen(3003,'127.0.0.1',()=>console.log('Tech pack workroom: http://127.0.0.1:3003'));
