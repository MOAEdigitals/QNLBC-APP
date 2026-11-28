import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('deleting a song fills its gap before removal and cancels the visual removal when deletion fails', async () => {
  const source=readFileSync('src/components/SongsTab.tsx','utf8');
  const tree=ts.createSourceFile('SongsTab.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let handler:ts.Expression|undefined;
  const visit=(node:ts.Node)=>{
    if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(tree)==='button'&&node.children.some(child=>ts.isJsxElement(child)&&child.getText(tree)==='<span>Delete Song</span>')){
      const attr=node.openingElement.attributes.properties.find(attr=>ts.isJsxAttribute(attr)&&attr.name.getText(tree)==='onClick') as ts.JsxAttribute;
      handler=(attr.initializer as ts.JsxExpression).expression;
    }
    ts.forEachChild(node,visit);
  };visit(tree);assert.ok(handler);
  let finish!:()=>void,deleted=0,cancelled=0,cleared=0,allowed=true;
  const context:any={song:{id:'one',title:'One'},setOpenMenuSongId(){},confirmAction:async()=>true,
    document:{getElementById:()=>({getBoundingClientRect:()=>({height:400}),animate:()=>({finished:new Promise<void>(resolve=>finish=resolve),cancel:()=>cancelled++})})},
    window:{matchMedia:()=>({matches:false})},getComputedStyle:()=>({marginBlockEnd:'12px'}),
    onDeleteSong:async()=>{deleted++;return allowed;},setSelectedSongId:()=>cleared++,onClearInitialSelectedSongId(){},
  };
  runInNewContext(ts.transpileModule('this.remove='+handler!.getText(tree),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
  const pending=context.remove({stopPropagation(){}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(deleted,0,'card remains in the list while its height collapses');
  finish();await pending;
  assert.equal(deleted,1);assert.equal(cleared,1);assert.equal(cancelled,0);
  allowed=false;
  const failure=context.remove({stopPropagation(){}});
  await new Promise(resolve=>setImmediate(resolve));finish();await failure;
  assert.equal(cancelled,1,'a denied/failed deletion restores the visible card');
  assert.equal(cleared,1,'failed deletion retains the selected card');
});
