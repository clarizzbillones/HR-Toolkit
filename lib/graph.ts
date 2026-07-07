// Microsoft Graph API helper — all calls gracefully degrade without a token

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

async function graphFetch(path: string, accessToken: string, options?: RequestInit) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Graph ${path} → ${res.status}`);
  return res.json();
}

export async function getCalendarEvents(
  accessToken: string,
  startDate: string,
  endDate: string
) {
  try {
    const data = await graphFetch(
      `/me/calendarView?startDateTime=${startDate}&endDateTime=${endDate}&$top=100`,
      accessToken
    );
    return (data.value ?? []) as Array<{
      id: string;
      subject: string;
      start: { dateTime: string };
      end: { dateTime: string };
      organizer: { emailAddress: { name: string; address: string } };
    }>;
  } catch {
    return [];
  }
}

// App-only (client credentials) token — used by the scheduled reminder cron,
// which has no signed-in user. Requires application Mail.Send permission.
export async function getAppToken(): Promise<string | null> {
  const tenant = process.env.AZURE_AD_TENANT_ID;
  const id = process.env.AZURE_AD_CLIENT_ID;
  const secret = process.env.AZURE_AD_CLIENT_SECRET;
  if (!tenant || !id || !secret) return null;
  try {
    const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: id, client_secret: secret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }),
    });
    if (!res.ok) return null;
    return (await res.json()).access_token ?? null;
  } catch { return null; }
}

function ccList(cc?: string | string[]) {
  const arr = (Array.isArray(cc) ? cc : cc ? [cc] : []).filter(Boolean);
  return arr.length ? { ccRecipients: arr.map(a => ({ emailAddress: { address: a } })) } : {};
}

// Send mail as a specific mailbox using the app-only token
export async function sendMailAsApp(fromUpn: string, to: string, subject: string, body: string, cc?: string | string[]) {
  const token = await getAppToken();
  if (!token) return { ok: false, error: 'App credentials not configured (AZURE_AD_CLIENT_ID/SECRET/TENANT_ID)' };
  try {
    const res = await fetch(`${GRAPH_BASE}/users/${encodeURIComponent(fromUpn)}/sendMail`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { subject, body: { contentType: 'HTML', content: body }, toRecipients: [{ emailAddress: { address: to } }], ...ccList(cc) } }),
    });
    if (!res.ok) return { ok: false, error: `Graph sendMail ${res.status}: ${(await res.text()).slice(0, 300)}` };
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function sendMail(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
  cc?: string | string[]
) {
  try {
    await graphFetch('/me/sendMail', accessToken, {
      method: 'POST',
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'HTML', content: body },
          toRecipients: [{ emailAddress: { address: to } }],
          ...ccList(cc),
        },
      }),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
