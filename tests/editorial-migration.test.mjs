import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {migrateEditorial} from '../scripts/migrate-editorial-vps.mjs';
test('editorial migration captures current content once and history rolls back with failed transactions',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'poetio-editorial-'));const file=join(dir,'db.sqlite3');let db=new DatabaseSync(file);
 try{for(const name of (await readdir(new URL('../drizzle/',import.meta.url))).filter(n=>n.endsWith('.sql')&&n<'0011').sort())db.exec(await readFile(new URL('../drizzle/'+name,import.meta.url),'utf8'));
 db.exec("INSERT INTO poems(id,title,author,content,revision,created_at,updated_at) VALUES('original-1','Titlu','Autor','Versuri',8,1,2)");const before=db.prepare('SELECT * FROM poems').all();db.close();
 assert.equal(migrateEditorial(file),true);assert.equal(migrateEditorial(file),false);db=new DatabaseSync(file);assert.deepEqual(db.prepare('SELECT * FROM poems').all(),before);assert.equal(db.prepare('SELECT count(*) n FROM content_history').get().n,1);assert.equal(JSON.parse(db.prepare('SELECT snapshot FROM content_history').get().snapshot).revision,8);
 db.exec("BEGIN;UPDATE poems SET title='Revised', revision=9 WHERE id='original-1';ROLLBACK;");assert.equal(db.prepare('SELECT count(*) n FROM content_history').get().n,1);assert.equal(db.prepare('SELECT title FROM poems').get().title,'Titlu');assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 }finally{if(db.isOpen)db.close();await rm(dir,{recursive:true,force:true});}
});
