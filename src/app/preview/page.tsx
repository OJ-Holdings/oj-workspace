import { Workspace } from '@/components/Workspace';
import { sampleData } from '@/lib/sample';
export default function Preview() {
  return <Workspace initial={sampleData} mode="preview" organizationId="preview" members={['Oscar', 'Jacob']} />;
}
