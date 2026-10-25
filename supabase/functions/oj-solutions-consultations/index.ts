// Public website intake: preferred 15-minute consultation request, NOT a confirmed slot.
// Access via strict origin, validation, honeypot and per-email request limit. No database key reaches the browser.
const origins = new Set(["https://ojsolutions.org", "https://www.ojsolutions.org"]);
const organizationId = "5759e756-05fe-4816-8b97-29b3455200a9";
const services = new Set(["AI receptionist", "Websites", "Commercials", "Automation", "General consultation"]);
const str = (v: unknown, max: number): string => typeof v === "string" ? v.trim().slice(0, max + 1) : "";

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const allowed = origins.has(origin);
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "vary": "Origin",
    ...(allowed ? { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" } : {}),
  };
  const respond = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (!allowed) return respond({ error: "Submit requests through ojsolutions.org." }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return respond({ error: "Method not supported." }, 405);
  if (Number(req.headers.get("content-length") || "0") > 8192) return respond({ error: "Request is too large." }, 413);
  if (!req.headers.get("content-type")?.includes("application/json")) return respond({ error: "Expected JSON." }, 415);
  let input: Record<string, unknown>;
  try { input = await req.json() as Record<string, unknown>; } catch { return respond({ error: "Invalid request." }, 400); }
  if (!input || Array.isArray(input) || typeof input !== "object") return respond({ error: "Invalid request." }, 400);
  if (str(input.website, 120)) return respond({ ok: true, status: "request_received" }); // anti-bot honeypot
  const name = str(input.name, 160);
  const email = str(input.email, 200).toLowerCase();
  const phone = str(input.phone, 35);
  const business = str(input.business, 160);
  const service = str(input.service, 100) || "General consultation";
  const notes = str(input.notes, 1000);
  const date = str(input.date, 10);
  const time = str(input.time, 5);
  // Explicit affirmative opt-in; false is the default, including legacy callers.
  const smsConsent = input.smsConsent === true;
  if (input.smsConsent !== undefined && typeof input.smsConsent !== "boolean")
    return respond({ error: "Invalid SMS preference." }, 400);
  if (smsConsent && phone.replace(/\D/g, "").length < 10)
    return respond({ error: "Enter a valid phone number if you opt into text messages." }, 400);
  if (name.length < 2 || name.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200 ||
      phone.length > 35 || business.length > 160 || notes.length > 1000 || !services.has(service)) {
    return respond({ error: "Check your name, email and details." }, 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(09|1[0-6]):(00|15|30|45)$/.test(time)) {
    return respond({ error: "Choose a valid 15-minute weekday slot." }, 400);
  }
  const selected = new Date(date + "T12:00:00Z");
  if (Number.isNaN(selected.getTime()) || selected.toISOString().slice(0, 10) !== date ||
      selected.getUTCDay() === 0 || selected.getUTCDay() === 6) {
    return respond({ error: "Choose a weekday." }, 400);
  }
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (name: string) => parts.find(p => p.type === name)?.value || "";
  const today = part("year") + "-" + part("month") + "-" + part("day");
  const earliest = new Date(today + "T12:00:00Z");
  earliest.setUTCDate(earliest.getUTCDate() + 1);
  const latest = new Date(today + "T12:00:00Z");
  latest.setUTCDate(latest.getUTCDate() + 30);
  if (date < earliest.toISOString().slice(0, 10) || date > latest.toISOString().slice(0, 10)) {
    return respond({ error: "Choose a date between tomorrow and 30 days ahead." }, 400);
  }
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return respond({ error: "Booking requests are temporarily unavailable." }, 503);
  const endpoint = url + "/rest/v1/oj_solutions_consultations";
  const apiHeaders = { apikey: key, authorization: "Bearer " + key, "content-type": "application/json" };
  try {
    // Throttle by a short-lived salted IP fingerprint using an atomic database budget.
    // The actual IP and service secret are never saved or exposed. Email limit remains a backup.
    const address = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
    if (address) {
      const salt = key + ":" + new Date().toISOString().slice(0, 10) + ":" + address;
      const digestBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt));
      const fingerprint = Array.from(new Uint8Array(digestBuffer), b => b.toString(16).padStart(2, "0")).join("");
      const limiter = await fetch(url + "/rest/v1/rpc/oj_solutions_consultation_check_rate", {
        method: "POST", headers: apiHeaders,
        body: JSON.stringify({ p_fingerprint: fingerprint }), signal: AbortSignal.timeout(8000),
      });
      if (!limiter.ok) throw new Error("Request budget unavailable");
      if ((await limiter.json()) !== true) return respond({ error: "Too many requests. Try again later or contact us by email." }, 429);
    }
    // Limit to three requests per email in a rolling day; handles common accidental repeats.
    const since = new Date(Date.now() - 86400000).toISOString();
    const query = new URLSearchParams({ select: "id", email: "eq." + email, created_at: "gte." + since, limit: "3" });
    const prior = await fetch(endpoint + "?" + query, { headers: apiHeaders, signal: AbortSignal.timeout(8000) });
    if (!prior.ok) throw new Error("Request limit check failed");
    const existing = await prior.json();
    if (!Array.isArray(existing)) throw new Error("Invalid request limit response");
    if (existing.length >= 3) return respond({ error: "Too many requests today. Please email us." }, 429);
    const saved = await fetch(endpoint + "?select=id", {
      method: "POST", headers: { ...apiHeaders, prefer: "return=representation" },
      body: JSON.stringify({
        organization_id: organizationId, name, email, phone, business, service, notes,
        preferred_date: date, preferred_time: time + ":00", duration_minutes: 15,
        status: "requested", source: "ojsolutions.org/15min",
        sms_consent: smsConsent, sms_consent_at: smsConsent ? new Date().toISOString() : null,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (saved.status === 409) return respond({ error: "You have already requested this time. Pick another slot or email us." }, 409);
    if (!saved.ok) throw new Error("Request insert failed (" + saved.status + ")");
    const rows = await saved.json();
    if (!Array.isArray(rows) || !rows[0]?.id) throw new Error("Could not verify saved request");
    return respond({ ok: true, id: rows[0].id, status: "requested", message: "Time requested. We'll confirm by email or phone." }, 201);
  } catch (e) {
    console.error("Consultation intake unavailable:", e instanceof Error ? e.message : "unknown");
    return respond({ error: "Could not save your request. Please try again or email us." }, 503);
  }
});
