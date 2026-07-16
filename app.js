'use strict';
const C = window.IPCore;
const $ = (id) => document.getElementById(id);
const escapeHTML = (v) => String(v).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
const fmt = C.formatInteger;
const safeStorage = {
  get(key) { try { return window.localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { window.localStorage.setItem(key, value); } catch {} }
};
let lastTable = null;

const COPY_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path></svg>`;
const CHECK_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"></path></svg>`;

function copyable(value, label = 'Copiar valor') {
  const safe = escapeHTML(value);
  const safeLabel = escapeHTML(label);
  return `<span class="copyable"><code>${safe}</code><button class="copy-mini" type="button" data-copy="${safe}" aria-label="${safeLabel}" title="${safeLabel}">${COPY_ICON}</button></span>`;
}
function kv(key, value, raw = false) { return `<div class="kv"><div class="k">${escapeHTML(key)}</div><div class="v">${raw ? value : copyable(value)}</div></div>`; }
function ipv6Formats(value, { prefix = null, zone = '' } = {}) {
  const zoneText = zone ? `%${zone}` : '';
  const prefixText = prefix === null ? '' : `/${prefix}`;
  return {
    reduced: `${C.compressedIPv6(value)}${zoneText}${prefixText}`,
    complete: `${C.expandedIPv6(value)}${zoneText}${prefixText}`
  };
}
function ipv6Dual(value, options = {}) {
  const forms = ipv6Formats(value, options);
  return `<div class="ipv6-dual">
    <div class="ipv6-format-row"><span class="ipv6-format-label">Reduzido</span>${copyable(forms.reduced, 'Copiar IPv6 reduzido')}</div>
    <div class="ipv6-format-row"><span class="ipv6-format-label">Completo</span>${copyable(forms.complete, 'Copiar IPv6 completo')}</div>
  </div>`;
}
function kvIPv6(key, value, options = {}) { return kv(key, ipv6Dual(value, options), true); }
function errorHTML(err) { return `<div class="alert"><strong>Não foi possível calcular.</strong><br>${escapeHTML(err.message || err)}</div>`; }
function render(id, fn) { try { $(id).innerHTML = fn(); } catch (err) { $(id).innerHTML = errorHTML(err); } }
function prefixCountText(total, exponent) { return `${fmt(total)} (2^${exponent})`; }

function syncIPv4SubnetBase(cidr) {
  const baseInput = $('ipv4-subnet-base');
  const prefixInput = $('ipv4-subnet-prefix');
  if (!baseInput || !prefixInput) return;

  baseInput.value = cidr.cidr;
  prefixInput.min = String(cidr.prefix);
  const currentPrefix = Number(prefixInput.value);
  if (!Number.isInteger(currentPrefix) || currentPrefix < cidr.prefix || currentPrefix > 32) {
    prefixInput.value = String(cidr.prefix < 32 ? cidr.prefix + 1 : 32);
  }

  baseInput.classList.remove('is-synced');
  requestAnimationFrame(() => baseInput.classList.add('is-synced'));
  window.setTimeout(() => baseInput.classList.remove('is-synced'), 900);
}

function renderIPv4Reference() {
  const body = $('ipv4-reference-body');
  if (!body) return;
  body.innerHTML = Array.from({ length: 33 }, (_, prefix) => {
    const mask = C.intToIPv4(C.prefixToMask4(prefix));
    const total = C.pow2(32 - prefix);
    const usable = prefix === 31 ? '2 em P2P' : prefix === 32 ? '1' : fmt(total - 2n);
    return `<tr><td><strong>/${prefix}</strong></td><td class="mono">${mask}</td><td>${fmt(total)}</td><td>${usable}</td></tr>`;
  }).join('');
}

function calculateIPv4() {
  render('ipv4-result', () => {
    const r = C.parseCIDR4($('ipv4-input').value);
    syncIPv4SubnetBase(r);
    const type = C.classifyIPv4(r.ip);
    return `<div class="summary">
      ${kv('Endereço informado', C.intToIPv4(r.ip))}
      ${kv('Rede CIDR', r.cidr)}
      ${kv('Máscara', C.intToIPv4(r.mask))}
      ${kv('Wildcard', C.intToIPv4(r.wildcard))}
      ${kv('Broadcast', C.intToIPv4(r.broadcast))}
      ${kv('Primeiro utilizável', C.intToIPv4(r.firstUsable))}
      ${kv('Último utilizável', C.intToIPv4(r.lastUsable))}
      ${kv('Total de endereços', prefixCountText(r.total, 32-r.prefix))}
      ${kv('Endereços utilizáveis', fmt(r.usable))}
      ${kv('Bits de host', String(r.hostBits))}
      ${kv('Classificação', `${type.label} — ${type.scope}`)}
      ${kv('DNS reverso', C.reverseDNS4(r.ip))}
      ${kv('Inteiro decimal', r.ip.toString())}
      ${kv('Hexadecimal', C.ipv4Hex(r.ip))}
      ${kv('Binário do IP', C.ipv4Binary(r.ip))}
      ${kv('Binário da máscara', C.ipv4Binary(r.mask))}
    </div><div class="notice">${escapeHTML(r.hostRule)}.</div>`;
  });
}

function calculateIPv4Subnets() {
  render('ipv4-subnet-result', () => {
    const r = C.subnet4($('ipv4-subnet-base').value, $('ipv4-subnet-prefix').value, BigInt($('ipv4-subnet-start').value || 0), Number($('ipv4-subnet-limit').value || 64));
    lastTable = {
      filename: 'sub-redes-ipv4.csv',
      headers: ['Índice','CIDR','Máscara','Primeiro utilizável','Último utilizável','Broadcast','Total','Utilizáveis'],
      rows: r.items.map(x => [x.index.toString(),x.cidr,C.intToIPv4(x.mask),C.intToIPv4(x.firstUsable),C.intToIPv4(x.lastUsable),C.intToIPv4(x.broadcast),x.total.toString(),x.usable.toString()])
    };
    const rows = r.items.map(x => `<tr><td>${fmt(x.index)}</td><td>${copyable(x.cidr)}</td><td>${C.intToIPv4(x.mask)}</td><td>${C.intToIPv4(x.firstUsable)}</td><td>${C.intToIPv4(x.lastUsable)}</td><td>${C.intToIPv4(x.broadcast)}</td><td>${fmt(x.total)}</td><td>${fmt(x.usable)}</td></tr>`).join('');
    return `<div class="summary">${kv('Bloco base',r.base.cidr)}${kv('Novo prefixo','/'+r.newPrefix)}${kv('Quantidade de sub-redes',prefixCountText(r.count,r.newPrefix-r.base.prefix))}${kv('Endereços por sub-rede',fmt(r.blockSize))}</div>
    <div class="actions"><button class="btn ghost" type="button" data-export>Exportar tabela CSV</button></div>
    <div class="table-wrap"><table><thead><tr><th>#</th><th>Rede</th><th>Máscara</th><th>Primeiro</th><th>Último</th><th>Broadcast</th><th>Total</th><th>Utilizáveis</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  });
}

function calculateHostPlanner4() {
  render('host4-result', () => {
    const hosts = BigInt($('host4-count').value);
    const prefix = C.prefixForUsableHosts4(hosts, $('host4-allow31').checked);
    const r = C.parseCIDR4(`0.0.0.0/${prefix}`);
    return `<div class="summary">${kv('Prefixo mínimo','/'+prefix)}${kv('Máscara',C.intToIPv4(r.mask))}${kv('Total no bloco',fmt(r.total))}${kv('Utilizáveis',fmt(r.usable))}${kv('Desperdício',fmt(r.usable-hosts))}</div>`;
  });
}

function calculateIPv6() {
  render('ipv6-result', () => {
    const r = C.parseCIDR6($('ipv6-input').value);
    const type = C.classifyIPv6(r.ip);
    const count64 = r.prefix <= 64 ? prefixCountText(C.pow2(64-r.prefix),64-r.prefix) : 'O bloco é mais específico que /64';
    return `<div class="summary">
      ${kvIPv6('Endereço informado', r.ip, { zone: r.zone })}
      ${kvIPv6('Prefixo de rede', r.network, { prefix: r.prefix })}
      ${kvIPv6('Primeiro endereço', r.first)}
      ${kvIPv6('Último endereço', r.last)}
      ${kv('Total de endereços', prefixCountText(r.total,128-r.prefix))}
      ${kv('Bits de interface/host', String(r.hostBits))}
      ${kv('Redes /64 contidas', count64)}
      ${kv('Classificação', `${type.label} — ${type.scope}`)}
      ${type.embeddedIPv4 ? kv('IPv4 incorporado',type.embeddedIPv4) : ''}
      ${kv('DNS reverso', C.reverseDNS6(r.ip))}
      ${kv('Inteiro decimal', r.ip.toString())}
      ${kv('Hexadecimal 128 bits', '0x'+r.ip.toString(16).padStart(32,'0'))}
      ${kv('Binário', C.ipv6Binary(r.ip))}
    </div>`;
  });
}

function calculateIPv6Subnets() {
  render('ipv6-subnet-result', () => {
    const r = C.subnet6($('ipv6-subnet-base').value, $('ipv6-subnet-prefix').value, BigInt($('ipv6-subnet-start').value || 0), Number($('ipv6-subnet-limit').value || 64));
    lastTable = {
      filename: 'sub-redes-ipv6.csv',
      headers: ['Índice','CIDR reduzido','CIDR completo','Primeiro reduzido','Primeiro completo','Último reduzido','Último completo','Endereços'],
      rows: r.items.map(x => {
        const cidr = ipv6Formats(x.network, { prefix: r.newPrefix });
        const first = ipv6Formats(x.network);
        const last = ipv6Formats(x.last);
        return [x.index.toString(),cidr.reduced,cidr.complete,first.reduced,first.complete,last.reduced,last.complete,r.blockSize.toString()];
      })
    };
    const rows = r.items.map(x => `<tr><td>${fmt(x.index)}</td><td>${ipv6Dual(x.network, { prefix: r.newPrefix })}</td><td>${ipv6Dual(x.network)}</td><td>${ipv6Dual(x.last)}</td><td>${fmt(r.blockSize)}</td></tr>`).join('');
    return `<div class="summary">${kvIPv6('Bloco base',r.base.network,{ prefix: r.base.prefix })}${kv('Novo prefixo','/'+r.newPrefix)}${kv('Quantidade de sub-redes',prefixCountText(r.count,r.newPrefix-r.base.prefix))}${kv('Endereços por sub-rede',prefixCountText(r.blockSize,128-r.newPrefix))}</div>
    <div class="actions"><button class="btn ghost" type="button" data-export>Exportar tabela CSV</button></div>
    <div class="table-wrap"><table><thead><tr><th>#</th><th>Rede</th><th>Primeiro</th><th>Último</th><th>Endereços</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  });
}

function calculateHostPlanner6() {
  render('host6-result', () => {
    const r = C.prefixForAddresses6(BigInt($('host6-count').value));
    return `<div class="summary">${kv('Prefixo matemático mínimo','/'+r.prefix)}${kv('Capacidade',prefixCountText(r.capacity,128-r.prefix))}${kv('Observação','Para LAN IPv6 com SLAAC, preserve /64')}</div>`;
  });
}

function calculateVLSM() {
  render('vlsm-result', () => {
    const r = C.allocateVLSM4($('vlsm-base').value, $('vlsm-lines').value, $('vlsm-allow31').checked);
    lastTable = {
      filename: 'plano-vlsm.csv', headers: ['Rede','Hosts pedidos','CIDR','Máscara','Primeiro','Último','Broadcast','Utilizáveis'],
      rows: r.allocations.map(x => [x.name,x.hosts.toString(),x.cidr,C.intToIPv4(x.mask),C.intToIPv4(x.firstUsable),C.intToIPv4(x.lastUsable),C.intToIPv4(x.broadcast),x.usable.toString()])
    };
    const rows = r.allocations.map(x => `<tr><td>${escapeHTML(x.name)}</td><td>${fmt(x.hosts)}</td><td>${copyable(x.cidr)}</td><td>${C.intToIPv4(x.mask)}</td><td>${C.intToIPv4(x.firstUsable)}</td><td>${C.intToIPv4(x.lastUsable)}</td><td>${C.intToIPv4(x.broadcast)}</td><td>${fmt(x.usable)}</td></tr>`).join('');
    return `<div class="summary">${kv('Bloco base',r.base.cidr)}${kv('Endereços ocupados',fmt(r.used))}${kv('Endereços livres',fmt(r.free))}${kv('Utilização',r.utilization.toFixed(2)+'%')}</div><div class="progress"><span style="width:${Math.min(100,r.utilization)}%"></span></div>
    <div class="actions"><button class="btn ghost" type="button" data-export>Exportar plano CSV</button></div>
    <div class="table-wrap"><table><thead><tr><th>Nome</th><th>Necessários</th><th>Bloco</th><th>Máscara</th><th>Primeiro</th><th>Último</th><th>Broadcast</th><th>Capacidade</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  });
}

function calculateCompare() {
  render('compare-result', () => {
    const r = C.compareCIDRs($('compare-a').value,$('compare-b').value);
    const nameA = r.a.cidr, nameB = r.b.cidr;
    return `<div class="summary">${kv('Bloco A',nameA)}${kv('Bloco B',nameB)}${kv('Mesma rede?',r.same?'Sim':'Não')}${kv('Há sobreposição?',r.overlaps?'Sim':'Não')}${kv('A contém B?',r.aContainsB?'Sim':'Não')}${kv('B contém A?',r.bContainsA?'Sim':'Não')}</div>`;
  });
}

function calculateEUI64() {
  render('eui-result', () => {
    const r = C.addressFromEUI64($('eui-prefix').value,$('eui-mac').value);
    return `<div class="summary">${kv('Interface ID EUI-64',r.text)}${kvIPv6('Endereço no prefixo',r.address)}${kvIPv6('Link-local derivado',r.linkLocal)}</div><div class="notice">EUI-64 é útil para estudo e interoperabilidade. Sistemas modernos frequentemente usam identificadores estáveis ou temporários por privacidade.</div>`;
  });
}

function generateULA() {
  render('ula-result', () => {
    const r = C.generateULA();
    return `<div class="summary">${kvIPv6('Prefixo ULA /48',r.prefixValue,{ prefix: 48 })}${kv('Global ID de 40 bits',r.globalId.toString(16).padStart(10,'0'))}${kvIPv6('Exemplo de primeira LAN',r.prefixValue,{ prefix: 64 })}</div>`;
  });
}

function exportCSV() {
  if (!lastTable) return;
  const quote = (v) => '"'+String(v).replace(/"/g,'""')+'"';
  const csv = '\uFEFF'+[lastTable.headers,...lastTable.rows].map(row => row.map(quote).join(';')).join('\r\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=lastTable.filename; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}


const PUBLIC_IP_CACHE_KEY = 'ipcalc-public-ips-v2';
const FALLBACK_IPV4 = '0.0.0.0/0';
const IPINFO_ENDPOINTS = {
  4: ['https://v4.ipinfo.io/json', 'https://ipinfo.io/json'],
  6: ['https://v6.ipinfo.io/json', 'https://ipinfo.io/json']
};
const IP_DETAILS_PROVIDERS = [
  { name: 'ipconfig.io', url: ip => `https://ipconfig.io/json?ip=${encodeURIComponent(ip)}` },
  { name: 'IPinfo', url: ip => `https://ipinfo.io/${encodeURIComponent(ip)}/json` }
];
let fallbackIPv6 = '';
let activeIpDetails = null;
let detailsScrollY = 0;
let detailsRequestId = 0;

function random64() {
  const bytes = new Uint8Array(8);
  if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value || 1n;
}

function getFallbackIPv6() {
  if (!fallbackIPv6) {
    const ula = C.generateULA();
    fallbackIPv6 = `${C.compressedIPv6(ula.prefixValue | random64())}/64`;
  }
  return fallbackIPv6;
}

function applyPublicIpToCalculator(version, address = '') {
  if (version === 4) {
    $('ipv4-input').value = address ? `${address}/32` : FALLBACK_IPV4;
    calculateIPv4();
    return;
  }
  $('ipv6-input').value = address ? `${address}/128` : getFallbackIPv6();
  calculateIPv6();
}

function publicIpFamily(value) {
  try { C.parseIPv4(value); return 4; } catch {}
  try { C.parseIPv6(value); return 6; } catch {}
  return 0;
}

async function fetchWithTimeout(url, { timeoutMs = 7000, json = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET', mode: 'cors', cache: 'no-store', credentials: 'omit',
      referrerPolicy: 'no-referrer', headers: { Accept: 'application/json, text/plain;q=0.9' }, signal: controller.signal
    });
    if (!response.ok) throw new Error(`O serviço respondeu HTTP ${response.status}.`);
    if (json) return await response.json();
    return await response.text();
  } finally { clearTimeout(timer); }
}

async function fetchIpinfoAddress(url) {
  const text = String(await fetchWithTimeout(url)).trim();
  let address = text;
  try {
    const payload = JSON.parse(text);
    address = payload.ip || payload.address || '';
  } catch {}
  address = String(address).trim();
  if (!address) throw new Error('Resposta do IPinfo sem endereço IP.');
  return address;
}

async function detectIpVersion(version) {
  let lastError = null;
  for (const endpoint of IPINFO_ENDPOINTS[version]) {
    try {
      const address = await fetchIpinfoAddress(endpoint);
      if (publicIpFamily(address) === version) return { address, endpoint };
      lastError = new Error(`O endpoint retornou IPv${publicIpFamily(address) || ' desconhecido'}.`);
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error(`Não foi possível detectar IPv${version}.`);
}

function readPublicIpCache() {
  try { return JSON.parse(safeStorage.get(PUBLIC_IP_CACHE_KEY) || '{}'); } catch { return {}; }
}
function writePublicIpCache(version, address) {
  const cache = readPublicIpCache();
  cache[`ipv${version}`] = { address, detectedAt: new Date().toISOString() };
  safeStorage.set(PUBLIC_IP_CACHE_KEY, JSON.stringify(cache));
}
function formatDetectedTime(date = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date);
}
function setPublicIpState(version, state, address, detail) {
  const value = $(`public-ipv${version}`);
  const status = $(`public-ipv${version}-status`);
  const description = $(`public-ipv${version}-detail`);
  const copyButton = $(`public-ipv${version}-copy`);
  const infoButton = $(`public-ipv${version}-info`);
  if (!value || !status || !description) return;
  const labels = { loading: 'Consultando', ok: 'Detectado', unavailable: 'Indisponível', noipv6: 'Sem IPv6', error: 'Falha' };
  status.className = `ip-status ${state}`;
  status.textContent = labels[state] || state;
  value.textContent = address || (state === 'noipv6' ? 'Não possui IPv6' : version === 6 ? 'IPv6 indisponível' : 'IPv4 não detectado');
  description.textContent = detail || '';
  if (copyButton) {
    copyButton.dataset.copy = address || '';
    copyButton.disabled = !address;
  }
  if (infoButton) {
    const verified = state === 'ok' && Boolean(address);
    infoButton.dataset.ip = verified ? address : '';
    infoButton.disabled = !verified;
    infoButton.title = verified ? `Ver informações de ${address}` : 'Disponível somente para um IP verificado nesta conexão';
  }
}

async function detectPublicIps() {
  const refresh = $('public-ip-refresh');
  if (refresh) { refresh.disabled = true; refresh.classList.add('is-loading'); }

  if (!navigator.onLine) {
    const cache = readPublicIpCache();
    for (const version of [4, 6]) {
      const saved = cache[`ipv${version}`];
      if (saved?.address) {
        const when = saved.detectedAt ? new Date(saved.detectedAt).toLocaleString('pt-BR') : 'anteriormente';
        setPublicIpState(version, 'unavailable', saved.address, `Sem internet. Último valor detectado em ${when}.`);
      } else setPublicIpState(version, 'unavailable', '', 'Sem internet para consultar o IPinfo.');
      applyPublicIpToCalculator(version, '');
    }
    if (refresh) { refresh.disabled = false; refresh.classList.remove('is-loading'); }
    return;
  }

  setPublicIpState(4, 'loading', 'Consultando…', 'Detectando o endereço público via IPinfo.');
  setPublicIpState(6, 'loading', 'Consultando…', 'Verificando se esta conexão possui IPv6 público.');

  const results = await Promise.allSettled([detectIpVersion(4), detectIpVersion(6)]);
  results.forEach((result, index) => {
    const version = index === 0 ? 4 : 6;
    if (result.status === 'fulfilled') {
      writePublicIpCache(version, result.value.address);
      setPublicIpState(version, 'ok', result.value.address, `Detectado via IPinfo às ${formatDetectedTime()}.`);
      applyPublicIpToCalculator(version, result.value.address);
    } else if (version === 6) {
      setPublicIpState(6, 'noipv6', '', 'Esta conexão não apresentou um endereço IPv6 público.');
      applyPublicIpToCalculator(6, '');
    } else {
      setPublicIpState(4, 'error', '', 'Não foi possível consultar o IPv4 no IPinfo. Tente atualizar.');
      applyPublicIpToCalculator(4, '');
    }
  });

  if (refresh) { refresh.disabled = false; refresh.classList.remove('is-loading'); }
}

async function fetchIpDetails(address) {
  let lastError = null;
  for (const provider of IP_DETAILS_PROVIDERS) {
    try {
      const payload = await fetchWithTimeout(provider.url(address), { timeoutMs: 8500, json: true });
      if (!payload || typeof payload !== 'object' || payload.error) throw new Error(payload?.error?.message || payload?.error || 'Resposta inválida.');
      return { provider: provider.name, payload };
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error('Nenhum serviço retornou informações para este endereço.');
}

function normalizeIpDetails(address, provider, payload) {
  const location = String(payload.loc || '').split(',');
  const latitude = payload.latitude ?? (location.length === 2 ? Number(location[0]) : null);
  const longitude = payload.longitude ?? (location.length === 2 ? Number(location[1]) : null);
  let asn = payload.asn || '';
  let organization = payload.asn_org || payload.as_name || payload.organization || payload.org || '';
  if (!asn && /^AS\d+\b/i.test(organization)) {
    const match = organization.match(/^(AS\d+)\s*(.*)$/i);
    asn = match?.[1] || '';
    organization = match?.[2] || organization;
  } else if (asn && organization.startsWith(`${asn} `)) organization = organization.slice(asn.length + 1);
  return {
    address: payload.ip || address,
    version: publicIpFamily(payload.ip || address),
    decimal: payload.ip_decimal,
    hostname: payload.hostname || payload.reverse || '',
    network: payload.network || payload.prefix || '',
    asn,
    organization,
    country: payload.country_name || payload.country || '',
    countryCode: payload.country_iso || payload.country_code || (provider === 'IPinfo' ? payload.country : ''),
    inEU: payload.country_eu,
    region: payload.region_name || payload.region || '',
    regionCode: payload.region_code || '',
    city: payload.city || '',
    postal: payload.zip_code || payload.postal || '',
    timezone: payload.time_zone || payload.timezone || '',
    metro: payload.metro_code || '',
    latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : null,
    longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : null,
    anycast: payload.anycast,
    bogon: payload.bogon,
    provider,
    payload
  };
}

function boolText(value) { return value === true ? 'Sim' : value === false ? 'Não' : ''; }
function detailRow(label, value, { copy = true, html = false } = {}) {
  if (value === undefined || value === null || value === '') return '';
  const rendered = html ? value : (copy ? copyable(String(value), `Copiar ${label}`) : escapeHTML(String(value)));
  return `<div class="ip-detail-row"><div class="ip-detail-name">${escapeHTML(label)}</div><div class="ip-detail-data">${rendered}</div></div>`;
}
function detailsGroup(title, rows, full = false) {
  const content = rows.filter(Boolean).join('');
  if (!content) return '';
  return `<section class="ip-details-group${full ? ' full' : ''}"><h3>${escapeHTML(title)}</h3><div class="ip-details-list">${content}</div></section>`;
}
function renderIpDetails(details) {
  const coords = details.latitude !== null && details.longitude !== null ? `${details.latitude}, ${details.longitude}` : '';
  const mapUrl = coords ? `https://www.openstreetmap.org/?mlat=${encodeURIComponent(details.latitude)}&mlon=${encodeURIComponent(details.longitude)}#map=10/${encodeURIComponent(details.latitude)}/${encodeURIComponent(details.longitude)}` : '';
  const sourceUrl = details.provider === 'ipconfig.io'
    ? `https://ipconfig.io/?ip=${encodeURIComponent(details.address)}`
    : `https://ipinfo.io/${encodeURIComponent(details.address)}`;
  const addressRows = [
    detailRow('Endereço IP', details.address),
    detailRow('Versão', `IPv${details.version}`, { copy: false }),
    detailRow('Inteiro decimal', details.decimal),
    detailRow('Hostname / PTR', details.hostname),
    detailRow('Rede / prefixo', details.network),
    detailRow('Anycast', boolText(details.anycast), { copy: false }),
    detailRow('Bogon / reservado', boolText(details.bogon), { copy: false })
  ];
  const networkRows = [
    detailRow('ASN', details.asn),
    detailRow('Organização / provedor', details.organization)
  ];
  const locationRows = [
    detailRow('País', details.country),
    detailRow('Código do país', details.countryCode),
    detailRow('Pertence à União Europeia', boolText(details.inEU), { copy: false }),
    detailRow('Estado / região', details.region),
    detailRow('Código da região', details.regionCode),
    detailRow('Cidade', details.city),
    detailRow('CEP / código postal', details.postal),
    detailRow('Fuso horário', details.timezone),
    detailRow('Código metropolitano', details.metro),
    coords ? detailRow('Coordenadas', `${copyable(coords, 'Copiar coordenadas')} <a class="ip-detail-link" href="${escapeHTML(mapUrl)}" target="_blank" rel="noopener noreferrer">Abrir no mapa</a>`, { html: true }) : ''
  ];
  return `<div class="ip-details-groups">
    ${detailsGroup('Endereço', addressRows)}
    ${detailsGroup('Rede e provedor', networkRows)}
    ${detailsGroup('Localização aproximada', locationRows, true)}
  </div>
  <div class="ip-details-source"><span>Fonte utilizada: <strong>${escapeHTML(details.provider)}</strong></span><a href="${escapeHTML(sourceUrl)}" target="_blank" rel="noopener noreferrer">Abrir consulta no serviço</a><span>A localização por IP é aproximada.</span></div>
  <details class="ip-raw-details"><summary>Ver resposta JSON completa</summary><pre>${escapeHTML(JSON.stringify(details.payload, null, 2))}</pre></details>`;
}

function setCalculatorPageVisible(visible) {
  const elements = [document.querySelector('.public-ip-panel'), document.querySelector('.tabs'), document.querySelector('main'), document.querySelector('footer')];
  elements.forEach(element => { if (element) element.hidden = !visible; });
}
async function loadActiveIpDetails() {
  if (!activeIpDetails) return;
  const requestId = ++detailsRequestId;
  const refresh = $('ip-details-refresh');
  if (refresh) { refresh.disabled = true; refresh.classList.add('is-loading'); }
  $('ip-details-title').textContent = activeIpDetails.address;
  $('ip-details-subtitle').textContent = `Consultando informações do IPv${activeIpDetails.version} público…`;
  $('ip-details-result').innerHTML = '<div class="notice">Consultando ipconfig.io e, se necessário, IPinfo…</div>';
  try {
    const response = await fetchIpDetails(activeIpDetails.address);
    if (requestId !== detailsRequestId) return;
    const details = normalizeIpDetails(activeIpDetails.address, response.provider, response.payload);
    $('ip-details-subtitle').textContent = `Informações do IPv${activeIpDetails.version} público, fornecidas por ${response.provider}.`;
    $('ip-details-result').innerHTML = renderIpDetails(details);
  } catch (error) {
    if (requestId !== detailsRequestId) return;
    $('ip-details-subtitle').textContent = 'Não foi possível obter os detalhes deste endereço.';
    $('ip-details-result').innerHTML = `<div class="alert"><strong>Falha na consulta.</strong><br>${escapeHTML(error.message || error)}<br><br>Verifique a conexão e tente novamente.</div>`;
  } finally {
    if (requestId === detailsRequestId && refresh) { refresh.disabled = false; refresh.classList.remove('is-loading'); }
  }
}
function openIpDetails(version, address) {
  if (!address || publicIpFamily(address) !== version) return;
  detailsScrollY = window.scrollY;
  activeIpDetails = { version, address };
  setCalculatorPageVisible(false);
  $('ip-details-page').hidden = false;
  window.scrollTo({ top: 0, behavior: 'auto' });
  loadActiveIpDetails();
}
function closeIpDetails() {
  detailsRequestId++;
  activeIpDetails = null;
  $('ip-details-page').hidden = true;
  setCalculatorPageVisible(true);
  window.scrollTo({ top: detailsScrollY, behavior: 'auto' });
}

async function writeClipboard(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('O navegador não permitiu copiar.');
}

function bind() {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn,.tab-panel').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active'); $(btn.dataset.tab).classList.add('active');
  }));
  $('theme-toggle').addEventListener('click',()=>{
    const root=document.documentElement; const next=root.dataset.theme==='light'?'dark':'light'; root.dataset.theme=next; safeStorage.set('ipcalc-theme',next); $('theme-toggle').textContent=next==='light'?'🌙':'☀️';
  });
  const saved=safeStorage.get('ipcalc-theme'); if(saved){document.documentElement.dataset.theme=saved;$('theme-toggle').textContent=saved==='light'?'🌙':'☀️';}

  $('ipv4-calc').onclick=calculateIPv4; $('ipv4-subnet-calc').onclick=calculateIPv4Subnets; $('host4-calc').onclick=calculateHostPlanner4;
  $('ipv6-calc').onclick=calculateIPv6; $('ipv6-subnet-calc').onclick=calculateIPv6Subnets; $('host6-calc').onclick=calculateHostPlanner6;
  $('vlsm-calc').onclick=calculateVLSM; $('compare-calc').onclick=calculateCompare; $('eui-calc').onclick=calculateEUI64; $('ula-generate').onclick=generateULA;
  $('public-ip-refresh').onclick=detectPublicIps;
  $('public-ipv4-info').onclick=()=>openIpDetails(4,$('public-ipv4-info').dataset.ip || '');
  $('public-ipv6-info').onclick=()=>openIpDetails(6,$('public-ipv6-info').dataset.ip || '');
  $('ip-details-back').onclick=closeIpDetails;
  $('ip-details-refresh').onclick=loadActiveIpDetails;
  window.addEventListener('online',detectPublicIps);
  window.addEventListener('offline',detectPublicIps);

  document.body.addEventListener('click', async (ev) => {
    const copy = ev.target.closest('[data-copy]');
    if (copy && copy.dataset.copy) {
      try {
        await writeClipboard(copy.dataset.copy);
        const previousLabel = copy.getAttribute('aria-label') || 'Copiar valor';
        copy.innerHTML = CHECK_ICON;
        copy.classList.add('copied');
        copy.setAttribute('aria-label', 'Copiado');
        copy.setAttribute('title', 'Copiado');
        window.setTimeout(() => {
          copy.innerHTML = COPY_ICON;
          copy.classList.remove('copied');
          copy.setAttribute('aria-label', previousLabel);
          copy.setAttribute('title', previousLabel);
        }, 1100);
      } catch {}
    }
    if(ev.target.closest('[data-export]')) exportCSV();
  });
  document.querySelectorAll('input, select, textarea').forEach(field => field.addEventListener('keydown', ev => {
    if (ev.key !== 'Enter' || ev.isComposing) return;
    if (field.tagName === 'TEXTAREA' && ev.shiftKey) return;
    const card = field.closest('.card');
    const button = card?.querySelector('.actions button:not([data-export])');
    if (!button || button.disabled) return;
    ev.preventDefault();
    button.click();
  }));

  $('ipv4-input').value = FALLBACK_IPV4;
  $('ipv6-input').value = getFallbackIPv6();
  renderIPv4Reference();
  calculateIPv4(); calculateIPv6(); generateULA(); detectPublicIps();
}
document.addEventListener('DOMContentLoaded',bind);
