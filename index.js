export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Telegram-Grok proxy is running", { status: 200 });
    }

    const bodyBuffer = await request.arrayBuffer();
    const bodyBytes = new Uint8Array(bodyBuffer);

    const WEBHOOK_URL = env.GROK_WEBHOOK_URL || "https://grok.com/webhook/automation/5e953af6-6479-4833-935e-f0ebbc702b13";
    const SECRET = env.GROK_WEBHOOK_SECRET || "whsec_9NlIiV+auFQQu9vBjnulIXf+8/Ng1ROhlLmRtkb0VPQ=";

    // secret 처리
    const secretB64 = SECRET.startsWith("whsec_") ? SECRET.slice(6) : SECRET;
    const secretBytes = Uint8Array.from(atob(secretB64), c => c.charCodeAt(0));

    const webhookId = crypto.randomUUID();
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // toSign = id.timestamp.body
    const prefix = new TextEncoder().encode(`${webhookId}.${timestamp}.`);
    const toSign = new Uint8Array(prefix.length + bodyBytes.length);
    toSign.set(prefix, 0);
    toSign.set(bodyBytes, prefix.length);

    const key = await crypto.subtle.importKey(
      "raw",
      secretBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const sigBuffer = await crypto.subtle.sign("HMAC", key, toSign);
    const signature = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));

    const headers = new Headers({
      "webhook-id": webhookId,
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,${signature}`,
      "Content-Type": "application/json",
    });

    try {
      const resp = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers,
        body: bodyBytes,
      });

      return new Response(await resp.text(), {
        status: resp.status,
        headers: { "Content-Type": "text/plain" },
      });
    } catch (err) {
      return new Response("Proxy error: " + err.message, { status: 500 });
    }
  },
};
