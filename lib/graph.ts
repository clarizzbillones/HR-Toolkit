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

export async function sendMail(
  accessToken: string,
  to: string,
  subject: string,
  body: string
) {
  try {
    await graphFetch('/me/sendMail', accessToken, {
      method: 'POST',
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'HTML', content: body },
          toRecipients: [{ emailAddress: { address: to } }],
        },
      }),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
