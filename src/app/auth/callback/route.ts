import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { safeAuthNext } from '@/lib/auth-input';
import { workspaceOrigin } from '@/lib/auth-url';
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const next = safeAuthNext(request.nextUrl.searchParams.get('next'));
  if (code && code.length <= 2048) {
    try {
      const client = await supabaseServer();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, workspaceOrigin()), { headers: { 'Cache-Control': 'private, no-store' } });
    } catch { /* Show a generic error without leaking codes or provider diagnostics. */ }
  }
  return NextResponse.redirect(new URL('/login?notice=link-expired', workspaceOrigin()), { headers: { 'Cache-Control': 'private, no-store' } });
}
