'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight, CalendarDays, CheckCircle2, Clapperboard, Clock3,
  FileText, Pencil, Plus, RefreshCw, ShieldCheck, Video, X,
} from 'lucide-react';
import { loadContentStudio, saveContentStudioProject } from '@/app/workspace/content-actions';
import {
  contentKinds, contentPlatforms, contentStages, freshContentDraft,
  isContentLate, validateContentDraft,
  type ContentDraft, type ContentProject, type ContentSnapshot, type ContentStage,
} from '@/lib/content-studio';

const previewProject: ContentProject = {
  id: 'preview-content-1', organization_id: 'preview', title: 'Sample: launch our new video series',
  kind: 'Video', stage: 'Editing', platforms: ['YouTube', 'TikTok'],
  summary: 'Fictional example for the preview only. Outline the episode and why it matters.',
  script: 'Fictional sample script.', production_notes: 'Fictional sample production notes.',
  assigned_to: null, shoot_at: null, target_publish_on: null,
  published_url: '', published_at: null, revision: 0,
  created_at: '2026-10-01T12:00:00.000Z', updated_at: '2026-10-01T12:00:00.000Z',
};
const previewSnapshot: ContentSnapshot = { projects: [previewProject], members: [], activity: [] };
const stagesInMotion = new Set<ContentStage>([
  'Research','Script','Pre-production','Filming','Editing','Review','Scheduled',
]);
const dateLabel = (value: string | null): string =>
  value ? new Date(value.includes('T') ? value : value + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }) : 'Not scheduled';
const localDateTime = (value: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

type Props = {
  base: string;
  organizationId: string;
  mode: 'live' | 'preview';
  readOnly: boolean;
};

export function ContentStudio({ base, organizationId, mode, readOnly }: Props) {
  const [snapshot, setSnapshot] = useState<ContentSnapshot | null>(mode === 'preview' ? previewSnapshot : null);
  const [loading, setLoading] = useState(mode === 'live');
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<ContentDraft | null>(null);
  const [filter, setFilter] = useState<ContentStage | 'all'>('all');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [today, setToday] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const readOnlyView = readOnly || mode === 'preview';

  useEffect(() => {
    setToday(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }));
  }, []);

  async function refresh() {
    if (mode !== 'live') return;
    setLoading(true);
    setLoadError('');
    try { setSnapshot(await loadContentStudio(organizationId)); }
    catch (error) { setLoadError(error instanceof Error ? error.message : 'Content Studio is unavailable.'); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    if (mode !== 'live') { setSnapshot(previewSnapshot); return; }
    let disposed = false;
    setLoading(true);
    setSnapshot(null);
    loadContentStudio(organizationId).then(result => {
      if (!disposed) { setSnapshot(result); setLoadError(''); }
    }).catch(error => {
      if (!disposed) setLoadError(error instanceof Error ? error.message : 'Content Studio is unavailable.');
    }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [mode, organizationId]);

  const projects = snapshot?.projects ?? [];
  const visible = useMemo(() => projects.filter(project =>
    (filter === 'all' || project.stage === filter) &&
    [project.title, project.summary, project.kind, ...project.platforms]
      .some(text => text.toLowerCase().includes(query.toLowerCase().trim())),
  ), [projects, query, filter]);
  const assignedName = (id: string | null) =>
    snapshot?.members.find(member => member.user_id === id)?.display_name ??
    (id ? 'Former member' : 'Unassigned');
  const inProgress = projects.filter(item => stagesInMotion.has(item.stage)).length;
  const waiting = projects.filter(item => item.stage === 'Review').length;
  const recordedPublished = projects.filter(item => item.stage === 'Published' && item.published_url).length;
  const late = projects.filter(item => isContentLate(item, today)).length;

  const openEditor = (project?: ContentProject) => {
    setNotice('');
    setEditor(project ? {
      id: project.id, title: project.title, kind: project.kind, stage: project.stage,
      platforms: [...project.platforms], summary: project.summary, script: project.script,
      production_notes: project.production_notes, assigned_to: project.assigned_to,
      shoot_at: project.shoot_at, target_publish_on: project.target_publish_on,
      published_url: project.published_url, published_at: project.published_at,
      revision: project.revision,
    } : freshContentDraft());
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  };
  const patch = <K extends keyof ContentDraft>(key: K, value: ContentDraft[K]) => {
    setEditor(previous => previous ? { ...previous, [key]: value } : previous);
  };
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || readOnlyView || saving) return;
    setSaving(true);
    setNotice('');
    try {
      const draft = validateContentDraft(editor);
      const saved = await saveContentStudioProject(organizationId, draft);
      setNotice(saved.revision === 0 ? 'Production project created.' : 'Production project saved.');
      setEditor(null);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to save this project.');
    } finally { setSaving(false); }
  }

  return <div className="content-studio">
    <div className="content-intro">
      <div>
        <p className="content-eyebrow"><Clapperboard size={16} /> OSCAR JACOB / CREATIVE OPERATIONS</p>
        <h2>Production command.</h2>
        <p>Move real projects from the first idea through scripting, filming, editing, review and a recorded public release.</p>
      </div>
      {!readOnlyView && <button type="button" className="primary" onClick={() => openEditor()}><Plus size={16} /> New production</button>}
    </div>
    {mode === 'preview' && <p className="content-preview-note"><ShieldCheck size={16} /> Fictional sample only. Editing is disabled in preview; no company records are loaded.</p>}
    {loadError && <div role="alert" className="content-error">{loadError} <button type="button" onClick={() => void refresh()}><RefreshCw size={15} /> Retry</button></div>}
    <div className="content-stats" aria-label="Content production counts">
      <div><Video size={17} /><span>Projects</span><strong>{loading ? '—' : projects.length}</strong></div>
      <div><Clock3 size={17} /><span>In production</span><strong>{loading ? '—' : inProgress}</strong></div>
      <div><Pencil size={17} /><span>Awaiting review</span><strong>{loading ? '—' : waiting}</strong></div>
      <div><CheckCircle2 size={17} /><span>Recorded releases</span><strong>{loading ? '—' : recordedPublished}</strong></div>
    </div>
    {late > 0 && <p className="content-late" role="status">{late} project{late === 1 ? ' has' : 's have'} a past planned release date without a recorded publication.</p>}
    <div className="content-toolbar">
      <label>Search productions
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Title, format, platform or brief…" />
      </label>
      <label>Pipeline stage
        <select value={filter} onChange={e => setFilter(e.target.value as ContentStage | 'all')}>
          <option value="all">All production stages</option>
          {contentStages.map(stage => <option key={stage} value={stage}>{stage}</option>)}
        </select>
      </label>
      {mode === 'live' && <button type="button" className="content-refresh" disabled={loading} onClick={() => void refresh()} aria-label="Refresh content projects"><RefreshCw size={17}/></button>}
    </div>

    {loading && !snapshot ? <p role="status" className="content-empty">Loading authorized content records…</p> :
      visible.length ? <div className="content-project-grid">
        {visible.map(project => <article className="content-project" key={project.id}>
          <div className="content-project-top"><span>{project.kind}</span><b>{project.stage}</b></div>
          <h3>{project.title}</h3>
          <p>{project.summary || 'No production brief yet.'}</p>
          <div className="content-project-platforms">{project.platforms.map(p => <span key={p}>{p}</span>)}</div>
          <dl>
            <div><dt>Producer</dt><dd>{assignedName(project.assigned_to)}</dd></div>
            <div><dt>Planned release</dt><dd>{dateLabel(project.target_publish_on)}</dd></div>
            <div><dt>Last updated</dt><dd>{dateLabel(project.updated_at)}</dd></div>
          </dl>
          <div className="content-project-actions">
            <button type="button" onClick={() => openEditor(project)}>{readOnlyView ? 'View production' : 'Open production'} <ArrowUpRight size={15}/></button>
            {project.stage === 'Published' && project.published_url && <a href={project.published_url} target="_blank" rel="noopener noreferrer">Recorded link <ArrowUpRight size={15}/></a>}
          </div>
        </article>)}
      </div> : !loading && !loadError && <div className="content-empty">
        <Clapperboard size={26}/>
        <strong>{query || filter !== 'all' ? 'No productions match this view.' : 'Your production studio is ready.'}</strong>
        <p>{query || filter !== 'all' ? 'Try a different search or pipeline stage.' : mode === 'preview' ? 'The fictional sample does not match this view.' : 'Create your first real Oscar Jacob video or campaign to begin.'}</p>
      </div>}

    {editor && <div className="content-editor-wrap" ref={editorRef}>
      <form className="content-editor" onSubmit={e => void submit(e)} aria-label="Content production editor">
        <header className="content-editor-head"><div><p className="content-eyebrow">PRODUCTION RECORD</p><h3>{editor.id ? 'Manage production' : 'New production'}</h3></div><button type="button" className="content-dismiss" onClick={() => setEditor(null)} aria-label="Close editor"><X size={19}/></button></header>
        <fieldset disabled={readOnlyView || saving}>
          <div className="content-editor-fields">
            <label className="content-field-full">Production title
              <input required maxLength={180} value={editor.title} onChange={e => patch('title', e.target.value)} placeholder="Working title…" />
            </label>
            <label>Format
              <select value={editor.kind} onChange={e => patch('kind', e.target.value as ContentDraft['kind'])}>
                {contentKinds.map(kind => <option key={kind}>{kind}</option>)}
              </select>
            </label>
            <label>Production stage
              <select value={editor.stage} onChange={e => patch('stage', e.target.value as ContentStage)}>
                {contentStages.map(stage => <option key={stage}>{stage}</option>)}
              </select>
            </label>
            <label>Assigned founder
              <select value={editor.assigned_to ?? ''} onChange={e => patch('assigned_to', e.target.value || null)}>
                <option value="">Unassigned</option>
                {snapshot?.members.map(member => <option key={member.user_id} value={member.user_id}>{member.display_name}</option>)}
              </select>
            </label>
            <label>Planned publication date
              <input type="date" value={editor.target_publish_on ?? ''} onChange={e => patch('target_publish_on', e.target.value || null)} />
            </label>
            <label className="content-field-full">Filming date and time (your device timezone)
              <input type="datetime-local" value={localDateTime(editor.shoot_at)} onChange={e => patch('shoot_at', e.target.value ? new Date(e.target.value).toISOString() : null)} />
            </label>
            <fieldset className="content-platform-selector content-field-full">
              <legend>Target platforms</legend>
              {contentPlatforms.map(platform => <label key={platform}><input type="checkbox" checked={editor.platforms.includes(platform)}
                onChange={e => patch('platforms', e.target.checked ? [...editor.platforms, platform] : editor.platforms.filter(item => item !== platform))} /> {platform}</label>)}
            </fieldset>
            <label className="content-field-full">Creative brief / core premise
              <textarea rows={3} maxLength={3000} value={editor.summary} onChange={e => patch('summary',e.target.value)} placeholder="What is the video about and why will viewers care?" />
            </label>
            <label className="content-field-full">Script / shot list
              <textarea rows={5} maxLength={16000} value={editor.script} onChange={e => patch('script',e.target.value)} placeholder="Opening hook, structure, scenes, lines, B-roll…" />
            </label>
            <label className="content-field-full">Production and editing notes
              <textarea rows={4} maxLength={5000} value={editor.production_notes} onChange={e => patch('production_notes',e.target.value)} placeholder="Location, gear, edits, collaborators, deliverables…" />
            </label>
            <div className="content-publication content-field-full">
              <h4>Publication receipt</h4>
              <p>These are your manual records, not an automatic publishing integration. Use a public HTTPS video URL and actual publication time. The app will not publish anything for you.</p>
              <label>Published URL
                <input type="url" maxLength={1000} value={editor.published_url} onChange={e=>patch('published_url',e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
              </label>
              <label>Actual publication time (your device timezone)
                <input type="datetime-local" value={localDateTime(editor.published_at)} onChange={e=>patch('published_at',e.target.value?new Date(e.target.value).toISOString():null)} />
              </label>
              {editor.stage === 'Published' && <p className="content-published-help">A publication link and time are required to save a project as Published.</p>}
            </div>
          </div>
        </fieldset>
        {editor.id && snapshot && <section className="content-editor-activity" aria-label="Production history">
          <h4>Recorded changes</h4>
          {snapshot.activity.filter(event => event.project_id === editor.id).slice(0,12).map(event =>
            <div key={event.id}>
              <span>{event.action === 'stage_changed' ? 'Stage changed to ' + event.new_stage : event.action === 'created' ? 'Production created' : 'Production updated'}</span>
              <small>{assignedName(event.actor_id)} · {dateLabel(event.changed_at)}</small>
            </div>,
          )}
        </section>}
        <footer className="content-editor-foot">
          <span><ShieldCheck size={15} /> Changes are saved to the company's private workspace.</span>
          <div><button type="button" className="secondary" onClick={()=>setEditor(null)}>Close</button>
          {!readOnlyView && <button className="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save production'}</button>}</div>
        </footer>
      </form>
    </div>}
    {notice && <p className="content-notice" role="status">{notice}</p>}
    <div className="content-utility-links">
      <Link href={base+'/calendar'}><CalendarDays size={18}/> Company calendar <ArrowUpRight size={15}/></Link>
      <Link href={base+'/files'}><FileText size={18}/> Company documents <ArrowUpRight size={15}/></Link>
      <Link href={base+'/tasks'}><CheckCircle2 size={18}/> Shared tasks <ArrowUpRight size={15}/></Link>
    </div>
  </div>;
}
