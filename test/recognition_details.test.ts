import test from 'node:test';
import assert from 'node:assert/strict';
import {annualRecognitionYear,anniversaryStartingYear, anniversaryYears, partitionSpecialRecognitions,isSpecialRecognitionWeek} from '../src/utils/recognitionDetails.ts';
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
 assert.deepEqual(groups.upcoming,['2026-10-31','2026-11-04','2026-11-08']);
 assert.deepEqual(groups.past,['2026-10-28','2025-11-01']);
 assert.equal(isSpecialRecognitionWeek('2026-10-31',now),true);
 assert.equal(isSpecialRecognitionWeek('2025-10-31',now),false);
 assert.equal(isSpecialRecognitionWeek('2026-11-05',now),false);
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
