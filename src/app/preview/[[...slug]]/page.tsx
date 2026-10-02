import { App } from '@/components/app/App';
import { sampleData } from '@/lib/sample';

// The sample workspace. Fictional records only (built in the browser from src/lib/sample.ts);
// nothing here reads or writes the live database.
export default function Preview() {
  return <App base="/preview" initial={sampleData} mode="preview" organizationId="preview" members={['Oscar', 'Jacob']} />;
}
