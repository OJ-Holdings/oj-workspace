import type { FinanceEntry } from './dashboard';

/**
 * Locally uploaded bank-statement CSV inspector. Parsing and comparison are pure;
 * no bank feed, server, storage, reconciliation or accounting posts are involved.
 * Bank signs and debit/credit columns are only arithmetic conventions of the file.
 */
export type StatementRow = { rowNumber: number; date: string; description: string; signedCents: number; currency: 'USD' };
export type StatementProblem = { rowNumber: number; reason: string };
export type StatementImport = {
  status: 'accepted' | 'needs-correction';
  rows: StatementRow[];
  problems: StatementProblem[];
  totalCents: number;
  dateRange: { start: string; end: string } | null;
  source: 'user-selected-local-file';
};
export type StatementCandidate = {
  entryId: string;
  venture: FinanceEntry['venture'];
  kind: FinanceEntry['kind'];
  category: string;
  recordedDate: string;
  distanceDays: number;
  source: 'manual-entry' | 'derived-source';
};
export type StatementRollForward = {
  status: 'not-provided' | 'invalid' | 'incomplete-source' | 'arithmetic-consistent' | 'arithmetic-difference';
  openingCents: number | null;
  closingCents: number | null;
  movementCents: number | null;
  varianceCents: number | null;
  detail: string;
};
const maxBytes = 1_048_576;
const maxRows = 2_000;
const centsSafe = (n: number): boolean => Number.isSafeInteger(n);

/** Reject scientific notation, implicit currency conversion and >2 decimal places. */
export function parseStatementCents(value: string): number | null {
  let s = value.trim();
  if (!s) return null;
  let negative = false;
  if (s.startsWith('(') && s.endsWith(')')) { negative = true; s = s.slice(1,-1).trim(); }
  if (s.startsWith('-') || s.startsWith('+')) {
    if (negative) return null;
    negative = s[0] === '-';
    s = s.slice(1).trim();
  }
  if (s.startsWith('$')) s=s.slice(1);
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(s)) return null;
  const [whole,fraction=''] = s.replaceAll(',','').split('.');
  const val = Number(whole)*100+Number(fraction.padEnd(2,'0'));
  return centsSafe(val) ? (negative ? -val : val) : null;
}
export function validStatementDate(day: string): boolean {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const parsed=new Date(day+'T12:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10)===day;
}
export function parseStatementDate(raw: string): string | null {
  const value=raw.trim();
  if (validStatementDate(value)) return value;
  const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (!m) return null;
  const day=`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
  return validStatementDate(day) ? day : null;
}
/** Quoted fields/newlines supported; malformed quoting is an explicit error. */
function parseCsv(text: string): string[][] {
  const result:string[][]=[];
  let row:string[]=[];
  let cell='';
  let quoted=false;
  let justClosed=false;
  let atStart=true;
  const pushCell=()=>{row.push(cell.trim());cell='';atStart=true;justClosed=false;};
  const pushRow=()=>{pushCell();if(row.some(c=>c.length>0))result.push(row);row=[];};
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if (quoted) {
      if(ch==='"'){
        if(text[i+1]==='"'){cell+='"';i++;} else {quoted=false;justClosed=true;}
      } else cell+=ch;
      continue;
    }
    if(justClosed){
      if(ch===','){pushCell();continue;}
      if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;pushRow();continue;}
      if(ch===' '||ch==='\t')continue;
      throw new Error('Unexpected characters after a quoted CSV field.');
    }
    if(ch==='"'){
      if(!atStart) throw new Error('Unexpected quote in unquoted CSV field.');
      quoted=true;atStart=false;continue;
    }
    if(ch===','){pushCell();continue;}
    if(ch==='\r'||ch==='\n'){
      if(ch==='\r'&&text[i+1]==='\n')i++;
      pushRow();continue;
    }
    cell+=ch;atStart=false;
  }
  if(quoted)throw new Error('Unterminated quoted CSV field.');
  if(cell.length||row.length||justClosed)pushRow();
  return result;
}
const aliases={
  date:['date','transaction date','posted date','posting date'],
  description:['description','details','memo','transaction description','merchant','name'],
  amount:['amount','transaction amount','signed amount'],
  debit:['debit','withdrawal','withdrawals','money out'],
  credit:['credit','deposit','deposits','money in'],
  currency:['currency','currency code'],
} as const;
const key=(v:string)=>v.trim().toLowerCase().replace(/[_-]/g,' ').replace(/\s+/g,' ');
function headerIndex(head:string[],type:keyof typeof aliases):number{
  return head.findIndex(h=>(aliases[type] as readonly string[]).includes(key(h)));
}
export function parseStatementCsv(raw:string):StatementImport {
  const bytes=new TextEncoder().encode(raw).length;
  if(bytes>maxBytes)throw new Error('File exceeds 1 MiB. Split it by statement period.');
  const parsed=parseCsv(raw.replace(/^\uFEFF/,''));
  if(!parsed.length)throw new Error('No CSV header or data rows found.');
  const header=parsed[0];
  if(header.length>80)throw new Error('Too many CSV columns.');
  const date=headerIndex(header,'date'), description=headerIndex(header,'description');
  const amount=headerIndex(header,'amount'), debit=headerIndex(header,'debit'),credit=headerIndex(header,'credit');
  const currency=headerIndex(header,'currency');
  if(date<0||description<0||(amount<0&&(debit<0||credit<0)))
    throw new Error('CSV needs Date, Description, and Amount (or both Debit and Credit) columns.');
  if(parsed.length-1>maxRows)throw new Error('File contains more than 2,000 transactions.');
  const rows:StatementRow[]=[],problems:StatementProblem[]=[];
  for(const [index,cells] of parsed.slice(1).entries()){
    const rowNumber=index+2;
    if(cells.length!==header.length){problems.push({rowNumber,reason:'Column count differs from header.'});continue;}
    if(currency>=0&&!['USD','$'].includes(cells[currency].trim().toUpperCase())){
      problems.push({rowNumber,reason:'Non-USD or missing currency; no conversion attempted.'});continue;
    }
    const day=parseStatementDate(cells[date]);
    if(!day){problems.push({rowNumber,reason:'Unrecognized or invalid date (use YYYY-MM-DD or MM/DD/YYYY).'});continue;}
    if(!cells[description].trim()){problems.push({rowNumber,reason:'Description is missing.'});continue;}
    let signed:number|null=null;
    if(amount>=0) signed=parseStatementCents(cells[amount]);
    else{
      const hasDebit=!!cells[debit].trim(),hasCredit=!!cells[credit].trim();
      if(hasDebit===hasCredit){problems.push({rowNumber,reason:'Exactly one of Debit or Credit must be present.'});continue;}
      const value=parseStatementCents(hasDebit?cells[debit]:cells[credit]);
      signed=value===null||value<0?null:(hasDebit?-value:value);
    }
    if(signed===null){problems.push({rowNumber,reason:'Invalid currency amount (only finite USD values to two decimals).'});continue;}
    rows.push({rowNumber,date:day,description:cells[description].trim().slice(0,500),signedCents:signed,currency:'USD'});
  }
  const total=rows.reduce((sum,row)=>sum+row.signedCents,0);
  if(!centsSafe(total))throw new Error('Statement aggregate is outside the safe integer range.');
  const days=rows.map(r=>r.date).sort();
  return {status:problems.length?'needs-correction':'accepted',rows,problems,totalCents:total,
    dateRange:days.length?{start:days[0],end:days[days.length-1]}:null,source:'user-selected-local-file'};
}
export function compareStatementRow(row:StatementRow,entries:readonly FinanceEntry[],maxDays=4):StatementCandidate[] {
  if(!Number.isSafeInteger(maxDays)||maxDays<0||maxDays>30)throw new Error('Invalid date comparison window.');
  const value=Math.abs(row.signedCents);
  if(!value||!validStatementDate(row.date))return [];
  const target=new Date(row.date+'T12:00:00.000Z').getTime();
  return entries.flatMap((e):StatementCandidate[]=>{
    if(!validStatementDate(e.occurred_on)||!Number.isFinite(e.amount)||e.amount<0)return [];
    const cents=Math.round(e.amount*100);
    if(!centsSafe(cents)||cents!==value)return [];
    const days=Math.abs(Math.round((target-new Date(e.occurred_on+'T12:00:00.000Z').getTime())/86_400_000));
    if(days>maxDays)return [];
    return [{entryId:e.id,venture:e.venture,kind:e.kind,category:e.category||'Uncategorized',recordedDate:e.occurred_on,distanceDays:days,source:e.auto?'derived-source':'manual-entry'}];
  }).sort((a,b)=>a.distanceDays-b.distanceDays||a.recordedDate.localeCompare(b.recordedDate)||a.entryId.localeCompare(b.entryId));
}
/** Arithmetic consistency is NOT bank reconciliation or validation of missing file pages. */
export function statementRollForward(source:StatementImport,opening:string,closing:string):StatementRollForward {
  if(!opening.trim()&&!closing.trim())return {status:'not-provided',openingCents:null,closingCents:null,movementCents:null,varianceCents:null,detail:'Enter opening and closing statement balances to check the supplied file arithmetic.'};
  const start=parseStatementCents(opening),end=parseStatementCents(closing);
  if(start===null||end===null)return {status:'invalid',openingCents:start,closingCents:end,movementCents:null,varianceCents:null,detail:'Both balances must be valid USD amounts with at most two decimals.'};
  if(source.problems.length||!source.rows.length)return {status:'incomplete-source',openingCents:start,closingCents:end,movementCents:source.totalCents,varianceCents:null,detail:'CSV has rejected rows or no transactions; balance comparison withheld.'};
  const variance=end-start-source.totalCents;
  if(!centsSafe(variance))return {status:'invalid',openingCents:start,closingCents:end,movementCents:null,varianceCents:null,detail:'Balance difference exceeds the safe arithmetic range.'};
  return {status:variance===0?'arithmetic-consistent':'arithmetic-difference',openingCents:start,closingCents:end,movementCents:source.totalCents,varianceCents:variance,
    detail:variance===0?'Uploaded rows add to the entered balances. Not a bank-certified reconciliation.':'The uploaded rows do not add to the entered opening and closing balances. Check missing lines, signs, fees and dates.'};
}
