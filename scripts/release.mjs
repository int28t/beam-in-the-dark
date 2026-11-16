import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFileSync(resolve(root,file),'utf8');
const version=read('config.js').match(/export const VERSION = ['"]([^'"]+)['"]/)[1];
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('Invalid VERSION');
const prepare=process.argv.includes('--prepare'),errors=[];
const files=['.','tests'].flatMap(dir=>readdirSync(resolve(root,dir)).filter(name=>name.endsWith('.js')).map(name=>dir==='.'?name:`${dir}/${name}`));
const imports=/\b(?:from\s*|import\s*(?:\(\s*)?)(['"])(\.\.?\/[^'"\r\n?]+\.js)(?:\?[^'"]*)?\1/g;
for(const file of files){
 const source=read(file);
 const expected=source.replace(imports,(match,quote,path)=>{
   if(!existsSync(resolve(root,dirname(file),path)))errors.push(`${file}: missing ${path}`);
   return match.slice(0,match.indexOf(quote))+quote+path+`?v=${version}`+quote;
 });
 if(prepare)writeFileSync(resolve(root,file),expected);else if(source!==expected)errors.push(`${file}: stale import versions`);
}
for(const file of ['index.html','tests/index.html','tests/scene-tests.html']){
 const source=read(file);
 let expected=source.replace(/(['"])(\.\.?\/[^'"?]+\.(?:js|css))(?:\?[^'"]*)?\1/g,(_,quote,path)=>`${quote}${path}?v=${version}${quote}`);
 expected=expected.replace(/Версия \d+\.\d+\.\d+/g,`Версия ${version}`);
 if(prepare)writeFileSync(resolve(root,file),expected);else if(source!==expected)errors.push(`${file}: stale asset/entry versions`);
}
if(prepare){
 const source=read('README.md').replace(/version-\d+\.\d+\.\d+/g,`version-${version}`).replace(/Версия \d+\.\d+\.\d+/g,`Версия ${version}`).replace(/Статус:\*\* \d+\.\d+\.\d+/g,`Статус:** ${version}`);
 writeFileSync(resolve(root,'README.md'),source);
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`${prepare?'Prepared':'PASS'} release ${version}: ${files.length} modules + entry/CSS URLs`);
