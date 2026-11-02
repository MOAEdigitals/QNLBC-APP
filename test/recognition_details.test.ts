import test from 'node:test';
import assert from 'node:assert/strict';
import {annualRecognitionYear,anniversaryStartingYear, anniversaryYears, partitionSpecialRecognitions,isSpecialRecognitionActive} from '../src/utils/recognitionDetails.ts';
import {groupBirthdayRecognitionMonths,orderBirthdayRecognitionMonths} from '../src/utils/recognitionOrder.ts';

test('anniversary years advance annually without rewriting existing records',()=>{
 const legacy={id:'a',title:'Couple',type:'Wedding' as const,anniversaryDate:'2026-11-01',yearsCount:20};
 assert.equal(anniversaryStartingYear(legacy),2006);
 assert.equal(anniversaryYears(legacy,2026),20); assert.equal(anniversaryYears(legacy,2027),21);
 assert.equal(anniversaryYears({...legacy,anniversaryDate:'2016-11-01',yearsCount:0},2027),11);
 assert.equal(anniversaryYears({...legacy,yearsCount:undefined},2027),undefined);
 assert.equal(legacy.yearsCount,20);
});
test('special recognitions are one-time, upcoming first and completed last',()=>{
 const dates=['2025-11-01','2026-10-28','2026-11-04','2026-11-08','2026-10-31'];
 const now=new Date(2026,10,1);
 const groups=partitionSpecialRecognitions(dates,d=>d,now);
 assert.deepEqual(groups.upcoming,['2026-10-28','2026-10-31','2026-11-04','2026-11-08']);
 assert.deepEqual(groups.past,['2025-11-01']);
 assert.equal(isSpecialRecognitionActive('2026-10-31',now),true);
 assert.equal(isSpecialRecognitionActive('2025-10-31',now),false);
 assert.equal(isSpecialRecognitionActive('2026-11-05',now),false);
});
test('anniversary rollover keeps only pending previous-month dates at the top',()=>{
 const dates=['2010-10-10','2011-10-31','2012-11-01','2013-12-01'];
 const ordered=orderBirthdayRecognitionMonths(dates,d=>d,'2026-11-01');
 assert.deepEqual(groupBirthdayRecognitionMonths(ordered,d=>d,'2026-11-01').map(g=>g.items),[['2011-10-31'],['2012-11-01'],['2013-12-01'],['2010-10-10']]);
});

test('anniversary count uses the recognition occurrence year across New Year',()=>{
 assert.equal(annualRecognitionYear('2006-12-31',new Date(2027,0,3)),2026);
 assert.equal(annualRecognitionYear('2006-01-01',new Date(2027,0,3)),2027);
});

test('Special stays highlighted through two Sundays, then moves to completed',()=>{
 const date='2026-11-02';
 for(const day of [2,3,8,9,14,15]) assert.equal(isSpecialRecognitionActive(date,new Date(2026,10,day,23,59)),true,`November ${day}`);
 assert.equal(isSpecialRecognitionActive(date,new Date(2026,10,1)),false,'not before event');
 assert.equal(isSpecialRecognitionActive(date,new Date(2026,10,16)),false,'Monday after second Sunday');
 assert.deepEqual(partitionSpecialRecognitions([date],d=>d,new Date(2026,10,15)).upcoming,[date]);
 assert.deepEqual(partitionSpecialRecognitions([date],d=>d,new Date(2026,10,16)).past,[date]);
});
test('a Sunday event counts that Sunday first and survives a month/year rollover',()=>{
 assert.equal(isSpecialRecognitionActive('2026-11-01',new Date(2026,10,8,23,59)),true);
 assert.equal(isSpecialRecognitionActive('2026-11-01',new Date(2026,10,9)),false);
 assert.equal(isSpecialRecognitionActive('2026-12-31',new Date(2027,0,10,23,59)),true);
 assert.equal(isSpecialRecognitionActive('2026-12-31',new Date(2027,0,11)),false);
 for(const value of ['invalid','','2026-02-30'])assert.equal(isSpecialRecognitionActive(value,new Date(2026,10,2)),false);
});
