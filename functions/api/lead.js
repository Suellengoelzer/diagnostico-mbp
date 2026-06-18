const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed' }, 405);
    }

    try {
      const { nome, wa, ig, email, score, categoria, resultado, respostas } = await request.json();

      if (!nome || !wa || !email) {
        return json({ ok: false, error: 'Dados incompletos' }, 400);
      }

      const base = `https://${env.KOMMO_SUBDOMAIN}.kommo.com/api/v4`;
      const auth = {
        Authorization: `Bearer ${env.KOMMO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      };

      const igHandle = ig ? ig.replace('@', '').trim() : '';
      const igUrl = igHandle ? `https://www.instagram.com/${igHandle}` : '';

      // 1. Criar contato
      const contactFields = [
        { field_id: 3633728, values: [{ value: wa, enum_id: 2873128 }] },      // Celular
        { field_id: 3633730, values: [{ value: email, enum_id: 2873138 }] },   // E-mail privado
      ];
      if (igUrl) contactFields.push({ field_id: 3897554, values: [{ value: igUrl }] }); // Instagram

      const contactRes = await fetch(`${base}/contacts`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify([{ name: nome, custom_fields_values: contactFields }]),
      });

      const contactData = await contactRes.json();
      const contactId = contactData._embedded?.contacts?.[0]?.id;

      // 2. Criar lead
      const leadRes = await fetch(`${base}/leads`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify([{
          name: 'Marca Bem Paga',
          pipeline_id: 13973235,
          status_id: 107841379,
          tags: [{ name: 'Lead Frio' }],
          custom_fields_values: [
            { field_id: 3893934, values: [{ enum_id: 3141742 }] }, // Canal: Isca
            { field_id: 3893936, values: [{ enum_id: 3136858 }] }, // Modelo: Captação Passiva
            { field_id: 3893938, values: [{ enum_id: 3136860 }] }, // Origem: Instagram
            { field_id: 3900128, values: [{ enum_id: 3142816 }] }, // Mídia: Orgânica
          ],
          ...(contactId && { _embedded: { contacts: [{ id: contactId }] } }),
        }]),
      });

      const leadData = await leadRes.json();
      const leadId = leadData._embedded?.leads?.[0]?.id;

      // 3. Nota com diagnóstico completo
      if (leadId) {
        const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

        const lines = [
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          'DIAGNÓSTICO DE POSICIONAMENTO MBP™',
          now,
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '',
        ];

        if (respostas && respostas.length) {
          let currentArea = '';
          respostas.forEach((r, i) => {
            if (r.area !== currentArea) {
              if (currentArea) lines.push('');
              lines.push(`[ ${r.area.toUpperCase()} ]`);
              lines.push('');
              currentArea = r.area;
            }
            lines.push(`${i + 1}. ${r.question}`);
            lines.push(`   → ${r.answer}`);
            lines.push('');
          });
        }

        lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        lines.push('RESULTADO');
        lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        lines.push('');
        lines.push(`Categoria: ${categoria}`);
        lines.push(`Pontuação: ${score}/32`);
        lines.push('');
        if (resultado) lines.push(resultado);
        lines.push('');
        lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        await fetch(`${base}/leads/notes`, {
          method: 'POST',
          headers: auth,
          body: JSON.stringify([{
            entity_id: leadId,
            note_type: 'common',
            params: { text: lines.join('\n') },
          }]),
        });
      }

      return json({ ok: true, leadId, contactId });

    } catch (err) {
      return json({ ok: false, error: err.message }, 500);
    }
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
