import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('diagnostics contain version/context/error codes without retaining private messages or payloads',()=>{
  const exports:any={};const source=readFileSync('src/services/diagnostics.ts','utf8').replaceAll('import.meta.env','({})');
  runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:()=>({}),Date});
  exports.recordDiagnostic('vocal-part-save',{code:'23514',message:'secret-password https://private.example/token=secret',payload:{lyrics:'private lyrics'}});
  exports.recordDiagnostic('audio-playback',{code:'https://private.example/secret'});
  const text=exports.diagnosticText({platform:'android',version:'1.0.72',build:'abc',userAgent:'Test WebView',online:true});
  assert.match(text,/23514/);assert.match(text,/1.0.72/);assert.match(text,/UNKNOWN/);
  assert.doesNotMatch(text,/secret|private|password|token|lyrics/i);
});
