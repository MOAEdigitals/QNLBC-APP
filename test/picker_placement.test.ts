import test from 'node:test';
import assert from 'node:assert/strict';
import { pickerPlacement } from '../src/utils/pickerPlacement.ts';

test('bottom fields open upwards above sticky Save and Cancel', () => {
 const result=pickerPlacement({top:380,bottom:420},80,440,300);
 assert.equal(result.top,80);
 assert.equal(result.maxHeight,294);
 assert.ok(result.top+result.maxHeight<440);
});
test('short keyboard viewport never forces a 120px dropdown across the footer',()=>{
 const result=pickerPlacement({top:125,bottom:165},100,190,300);
 assert.ok(result.maxHeight<120);
 assert.ok(result.top>=100);
 assert.ok(result.top+result.maxHeight<=190);
});
test('fields scrolled under footer cannot place suggestions below the footer',()=>{
 const result=pickerPlacement({top:500,bottom:540},80,400,300);
 assert.ok(result.top+result.maxHeight<=400);
});
test('top fields open below when sufficient room exists',()=>{
 assert.deepEqual(pickerPlacement({top:90,bottom:130},80,600,300),{top:136,maxHeight:300});
});
