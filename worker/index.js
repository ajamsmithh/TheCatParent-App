const noStore = {'Cache-Control':'private, no-store'};
const maxBytes = 512 * 1024;
const json = (value,status=200) => Response.json(value,{status,headers:noStore});

function validData(data) {
  return data && Array.isArray(data.pets) && data.pets.length > 0 &&
    data.pets.every(pet => pet && typeof pet.id === 'string' && typeof pet.name === 'string') &&
    data.pets.some(pet => pet.id === data.selected) &&
    Array.isArray(data.devices) && Array.isArray(data.subscriptions);
}

async function records(request, env, url) {
  const id = request.headers.get('oai-authenticated-user-id');
  if (!id) return json({error:'Sign in to access your records.'},401);

  if (request.method === 'GET') {
    const row = await env.DB.prepare(
      'SELECT payload, revision FROM petfolio_records WHERE user_id = ?'
    ).bind(id).first();
    return json(row ? {data:JSON.parse(row.payload),revision:row.revision} : {data:null,revision:0});
  }
  if (request.method !== 'PUT') return json({error:'Method not allowed.'},405);
  if (request.headers.get('Origin') !== url.origin) return json({error:'Invalid request origin.'},403);

  let update;
  try {
    if (Number(request.headers.get('Content-Length')) > maxBytes) return json({error:'Records exceed the storage limit.'},413);
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength > maxBytes) return json({error:'Records exceed the storage limit.'},413);
    update = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return json({error:'Invalid records.'},400);
  }
  if (!update || !Number.isSafeInteger(update.revision) || update.revision < 0 || !validData(update.data)) {
    return json({error:'Invalid records.'},400);
  }
  const payload = JSON.stringify(update.data);
  const result = update.revision === 0
    ? await env.DB.prepare(
      'INSERT INTO petfolio_records (user_id, payload, revision) VALUES (?, ?, 1) ON CONFLICT(user_id) DO NOTHING'
    ).bind(id,payload).run()
    : await env.DB.prepare(
      'UPDATE petfolio_records SET payload = ?, revision = revision + 1 WHERE user_id = ? AND revision = ?'
    ).bind(payload,id,update.revision).run();
  if (!result.meta.changes) return json({error:'Records changed elsewhere. Reload before editing again.'},409);
  return json({revision:update.revision+1});
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/records') {
      try { return await records(request,env,url); }
      catch { return json({error:'Account storage is temporarily unavailable.'},503); }
    }
    const asset = assets[url.pathname === '/' ? '/index.html' : url.pathname];
    if (!asset) return new Response('Not found',{status:404});
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null,{status:405});
    const body = request.method === 'HEAD' ? null : Uint8Array.from(atob(asset.content),char=>char.charCodeAt(0));
    return new Response(body,{headers:{...noStore,'Content-Type':asset.type}});
  }
};
