import { App } from '@/components/app/App';
import { sampleData, sampleMetrics } from '@/lib/sample';

// The sample workspace. Fictional records and figures only; nothing here reaches the live database.
export default function Preview() {
  return <App base="/preview" initial={sampleData} mode="preview" organizationId="preview" members={['Oscar', 'Jacob']} metrics={sampleMetrics} />;
}
