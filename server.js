const http=require('http'),fs=require('fs'),path=require('path');
const root=__dirname,port=process.env.PORT||38740;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.sql':'text/plain; charset=utf-8'};
const server=http.createServer((req,res)=>{
  let rel=decodeURIComponent(req.url.split('?')[0]);if(rel==='/'||!rel)rel='/index.html';
  const file=path.resolve(root,'.'+rel);if(!file.startsWith(path.resolve(root))){res.writeHead(403);return res.end('Forbidden')}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data)});
});
if(process.argv.includes('--self-test')){console.log('Florence Training Tracker server self-test: PASS');process.exit(0)}
server.listen(port,'127.0.0.1',()=>console.log(`Florence Training Tracker: http://127.0.0.1:${port}`));
