import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const root=mkdtempSync(join(tmpdir(),'poetio-draft-tests-'));
writeFileSync(join(root,'package.json'),'{"type":"commonjs"}');mkdirSync(join(root,'lib'));
for(const name of ['comment-draft','poem-comments','book-text-recovery','book-text','poem-search']) writeFileSync(join(root,'lib',name+'.js'),ts.transpileModule(readFileSync(new URL('../lib/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText);
process.on('exit',()=>rmSync(root,{recursive:true,force:true}));
const require=createRequire(import.meta.url);
const comments=require(join(root,'lib/comment-draft.js')),text=require(join(root,'lib/book-text-recovery.js'));
const storage=()=>{const values=new Map();return{get length(){return values.size;},key(i){return [...values.keys()][i]??null;},getItem(k){return values.get(k)??null;},setItem(k,v){values.set(k,v);},removeItem(k){values.delete(k);}};};

test('comment drafts expire, reject corrupt values, retain retry IDs and isolate content types',()=>{
  const now=Date.now(),draft={version:1,name:' Ana ',content:' Un gând ',savedAt:now,attempt:{id:crypto.randomUUID(),name:'Ana',content:'Un gând'}};
  assert.deepEqual(comments.restoredCommentDraft(JSON.stringify(draft),now),draft);
  assert.equal(comments.restoredCommentDraft(JSON.stringify(draft),now+comments.COMMENT_DRAFT_TTL),null);
  for(const raw of ['{','null','[]','{}',JSON.stringify({...draft,savedAt:now+61000}),JSON.stringify({...draft,content:'x'.repeat(2001)}),JSON.stringify({...draft,name:'x'.repeat(81)})])assert.equal(comments.restoredCommentDraft(raw,now),null);
  assert.equal(comments.restoredCommentDraft(JSON.stringify({...draft,content:'Edited'}),now).attempt,null);
  assert.notEqual(comments.commentDraftKey('/api/poems/same/comments'),comments.commentDraftKey('/api/videos/same/comments'));
  const store=storage();store.setItem('unrelated','kept');store.setItem(comments.commentDraftKey('expired'),JSON.stringify({...draft,savedAt:now-comments.COMMENT_DRAFT_TTL}));
  for(let i=0;i<45;i++)comments.saveCommentDraft(store,comments.commentDraftKey(String(i)),{...draft,savedAt:now+i},now+i);
  assert.equal(store.length,41);assert.equal(store.getItem('unrelated'),'kept');assert.equal(store.getItem(comments.commentDraftKey('expired')),null);
  comments.saveCommentDraft(store,comments.commentDraftKey('44'),{...draft,name:'',content:'',attempt:null},now+45);
  assert.equal(store.getItem(comments.commentDraftKey('44')),null);
});
test('local transcription drafts retain exact text and never cross PDF or page identities',()=>{
  const store=storage(),fileId=crypto.randomUUID(),other=crypto.randomUUID();
  const snapshot={fileId,page:2,text:'  Ș, ț\n\nVersuri.  ',language:'ro',revision:7};
  store.setItem(text.textDraftPrefix(fileId)+'good',JSON.stringify({version:1,snapshot,savedAt:1}));
  store.setItem(text.textDraftPrefix(fileId)+'foreign',JSON.stringify({version:1,snapshot:{...snapshot,fileId:other},savedAt:2}));
  store.setItem(text.textDraftPrefix(fileId)+'bad','{');
  const drafts=text.localTextDrafts(store,fileId);assert.equal(drafts.length,1);assert.deepEqual(drafts[0].snapshot,snapshot);
  assert.equal(text.localTextDrafts(store,other).length,0);
  for(const input of [null,{...snapshot,page:0},{...snapshot,page:2001},{...snapshot,page:1.5},{...snapshot,revision:-1},{...snapshot,text:'a'.repeat(64001)},{...snapshot,language:'bad'}])assert.equal(text.textSnapshot(input),null);
});
