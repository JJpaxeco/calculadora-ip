(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IPCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX4 = (1n << 32n) - 1n;
  const MAX6 = (1n << 128n) - 1n;

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function pow2(exp) {
    exp = Number(exp);
    assert(Number.isInteger(exp) && exp >= 0, 'Expoente inválido.');
    return 1n << BigInt(exp);
  }

  function formatInteger(value) {
    return BigInt(value).toLocaleString('pt-BR');
  }

  function formatPowerOfTwo(exp) {
    const n = pow2(exp);
    return `${formatInteger(n)} (2^${exp})`;
  }

  // ---------- IPv4 ----------
  function parseIPv4(text) {
    const value = String(text).trim();
    const parts = value.split('.');
    assert(parts.length === 4, 'IPv4 deve conter quatro octetos.');
    let result = 0n;
    for (const part of parts) {
      assert(/^\d{1,3}$/.test(part), `Octeto IPv4 inválido: ${part || '(vazio)'}.`);
      const octet = Number(part);
      assert(octet >= 0 && octet <= 255, `Octeto fora do intervalo 0–255: ${part}.`);
      result = (result << 8n) | BigInt(octet);
    }
    return result;
  }

  function intToIPv4(value) {
    value = BigInt(value);
    assert(value >= 0n && value <= MAX4, 'Valor IPv4 fora do intervalo.');
    return [24n, 16n, 8n, 0n].map(shift => Number((value >> shift) & 255n)).join('.');
  }

  function prefixToMask4(prefix) {
    prefix = Number(prefix);
    assert(Number.isInteger(prefix) && prefix >= 0 && prefix <= 32, 'Prefixo IPv4 deve estar entre /0 e /32.');
    return prefix === 0 ? 0n : (MAX4 << BigInt(32 - prefix)) & MAX4;
  }

  function maskToPrefix4(maskText) {
    const mask = parseIPv4(maskText);
    const binary = mask.toString(2).padStart(32, '0');
    assert(/^1*0*$/.test(binary), 'Máscara IPv4 não é contígua.');
    return binary.indexOf('0') === -1 ? 32 : binary.indexOf('0');
  }

  function parseCIDR4(input, defaultPrefix = 24) {
    let text = String(input).trim();
    assert(text, 'Informe um endereço ou bloco IPv4.');
    let addressText = text;
    let prefix = defaultPrefix;

    if (text.includes('/')) {
      const slash = text.lastIndexOf('/');
      addressText = text.slice(0, slash).trim();
      const suffix = text.slice(slash + 1).trim();
      prefix = suffix.includes('.') ? maskToPrefix4(suffix) : Number(suffix);
    } else {
      const tokens = text.split(/\s+/);
      if (tokens.length === 2) {
        addressText = tokens[0];
        prefix = tokens[1].includes('.') ? maskToPrefix4(tokens[1]) : Number(tokens[1]);
      }
    }

    assert(Number.isInteger(prefix) && prefix >= 0 && prefix <= 32, 'Prefixo IPv4 deve estar entre /0 e /32.');
    const ip = parseIPv4(addressText);
    const mask = prefixToMask4(prefix);
    const wildcard = MAX4 ^ mask;
    const network = ip & mask;
    const broadcast = network | wildcard;
    const total = pow2(32 - prefix);

    let usable, firstUsable, lastUsable, hostRule;
    if (prefix <= 30) {
      usable = total - 2n;
      firstUsable = network + 1n;
      lastUsable = broadcast - 1n;
      hostRule = 'Rede e broadcast reservados';
    } else if (prefix === 31) {
      usable = 2n;
      firstUsable = network;
      lastUsable = broadcast;
      hostRule = 'RFC 3021: ambos os endereços podem ser usados em enlace ponto a ponto';
    } else {
      usable = 1n;
      firstUsable = network;
      lastUsable = network;
      hostRule = 'Rota de host /32';
    }

    return {
      family: 4,
      input: text,
      ip,
      prefix,
      mask,
      wildcard,
      network,
      broadcast,
      first: network,
      last: broadcast,
      total,
      usable,
      firstUsable,
      lastUsable,
      hostBits: 32 - prefix,
      hostRule,
      cidr: `${intToIPv4(network)}/${prefix}`
    };
  }

  function ipv4Binary(value) {
    return BigInt(value).toString(2).padStart(32, '0').match(/.{8}/g).join('.');
  }

  function ipv4Hex(value) {
    return '0x' + BigInt(value).toString(16).padStart(8, '0').toUpperCase();
  }

  function isIn4(ip, base, prefix) {
    const mask = prefixToMask4(prefix);
    return (ip & mask) === (base & mask);
  }

  function classifyIPv4(ip) {
    ip = BigInt(ip);
    const exact = (addr) => ip === parseIPv4(addr);
    const range = (addr, prefix) => isIn4(ip, parseIPv4(addr), prefix);

    if (exact('0.0.0.0')) return { label: 'Não especificado', scope: 'Especial', globallyReachable: false };
    if (range('0.0.0.0', 8)) return { label: 'Rede atual / “this network”', scope: 'Especial', globallyReachable: false };
    if (range('10.0.0.0', 8) || range('172.16.0.0', 12) || range('192.168.0.0', 16)) return { label: 'Privado (RFC 1918)', scope: 'Local', globallyReachable: false };
    if (range('100.64.0.0', 10)) return { label: 'Espaço compartilhado CGNAT', scope: 'Operadora', globallyReachable: false };
    if (range('127.0.0.0', 8)) return { label: 'Loopback', scope: 'Host', globallyReachable: false };
    if (range('169.254.0.0', 16)) return { label: 'Link-local', scope: 'Enlace', globallyReachable: false };
    if (range('192.0.2.0', 24) || range('198.51.100.0', 24) || range('203.0.113.0', 24)) return { label: 'Documentação TEST-NET', scope: 'Documentação', globallyReachable: false };
    if (range('192.0.0.0', 24)) return { label: 'Atribuições de protocolo IETF', scope: 'Especial', globallyReachable: false };
    if (range('198.18.0.0', 15)) return { label: 'Benchmark/testes de dispositivos', scope: 'Teste', globallyReachable: false };
    if (range('224.0.0.0', 4)) return { label: 'Multicast', scope: 'Grupo', globallyReachable: false };
    if (range('240.0.0.0', 4)) return { label: exact('255.255.255.255') ? 'Broadcast limitado' : 'Reservado', scope: 'Especial', globallyReachable: false };
    return { label: 'Unicast público', scope: 'Global', globallyReachable: true };
  }

  function reverseDNS4(ip) {
    return intToIPv4(ip).split('.').reverse().join('.') + '.in-addr.arpa';
  }

  function subnet4(baseInput, newPrefix, startIndex = 0n, limit = 64) {
    const base = parseCIDR4(baseInput);
    newPrefix = Number(newPrefix);
    assert(Number.isInteger(newPrefix) && newPrefix >= base.prefix && newPrefix <= 32, `Novo prefixo deve estar entre /${base.prefix} e /32.`);
    startIndex = BigInt(startIndex);
    limit = Number(limit);
    assert(startIndex >= 0n, 'Índice inicial deve ser positivo.');
    assert(Number.isInteger(limit) && limit >= 1 && limit <= 1000, 'Quantidade para listar deve estar entre 1 e 1000.');

    const count = pow2(newPrefix - base.prefix);
    assert(startIndex < count, `Índice inicial deve ser menor que ${formatInteger(count)}.`);
    const blockSize = pow2(32 - newPrefix);
    const items = [];
    const end = startIndex + BigInt(limit) > count ? count : startIndex + BigInt(limit);

    for (let i = startIndex; i < end; i++) {
      const network = base.network + i * blockSize;
      const cidr = parseCIDR4(`${intToIPv4(network)}/${newPrefix}`);
      items.push({ index: i, ...cidr });
    }

    return { base, newPrefix, count, blockSize, startIndex, items };
  }

  function prefixForUsableHosts4(hosts, allow31 = true) {
    hosts = BigInt(hosts);
    assert(hosts >= 1n, 'Quantidade de hosts deve ser pelo menos 1.');
    if (hosts === 1n) return 32;
    if (hosts === 2n && allow31) return 31;
    for (let hostBits = 2; hostBits <= 32; hostBits++) {
      if (pow2(hostBits) - 2n >= hosts) return 32 - hostBits;
    }
    throw new Error('Quantidade de hosts excede o espaço IPv4.');
  }

  function parseVLSMLines(text) {
    const rows = [];
    String(text).split(/\r?\n/).forEach((line, idx) => {
      const clean = line.trim();
      if (!clean) return;
      const match = clean.match(/^(.+?)[\s,:;=]+(\d+)$/);
      assert(match, `Linha ${idx + 1} inválida. Use “Nome: quantidade”.`);
      rows.push({ name: match[1].trim(), hosts: BigInt(match[2]), order: rows.length });
    });
    assert(rows.length > 0, 'Informe ao menos uma rede para o VLSM.');
    return rows;
  }

  function alignUp(value, blockSize) {
    const remainder = value % blockSize;
    return remainder === 0n ? value : value + (blockSize - remainder);
  }

  function allocateVLSM4(baseInput, requirementsText, allow31 = true) {
    const base = parseCIDR4(baseInput);
    const requirements = parseVLSMLines(requirementsText).map(item => {
      const prefix = prefixForUsableHosts4(item.hosts, allow31);
      return { ...item, prefix, blockSize: pow2(32 - prefix) };
    }).sort((a, b) => a.blockSize === b.blockSize ? a.order - b.order : (a.blockSize > b.blockSize ? -1 : 1));

    let cursor = base.network;
    const allocations = [];
    for (const req of requirements) {
      cursor = alignUp(cursor, req.blockSize);
      const last = cursor + req.blockSize - 1n;
      assert(last <= base.broadcast, `O bloco ${base.cidr} não comporta todas as redes solicitadas.`);
      const cidr = parseCIDR4(`${intToIPv4(cursor)}/${req.prefix}`);
      allocations.push({ ...req, ...cidr });
      cursor = last + 1n;
    }

    const used = cursor - base.network;
    return {
      base,
      allocations,
      used,
      free: base.total - used,
      utilization: Number(used * 10000n / base.total) / 100
    };
  }

  // ---------- IPv6 ----------
  function parseIPv6(address) {
    let text = String(address).trim().toLowerCase();
    assert(text, 'Informe um endereço IPv6.');
    if (text.startsWith('[') && text.endsWith(']')) text = text.slice(1, -1);

    let zone = '';
    const zoneAt = text.indexOf('%');
    if (zoneAt !== -1) {
      zone = text.slice(zoneAt + 1);
      text = text.slice(0, zoneAt);
      assert(zone, 'Índice de zona IPv6 inválido.');
    }

    if (text.includes('.')) {
      const lastColon = text.lastIndexOf(':');
      assert(lastColon !== -1, 'IPv4 incorporado ao IPv6 inválido.');
      const v4 = parseIPv4(text.slice(lastColon + 1));
      const high = ((v4 >> 16n) & 0xffffn).toString(16);
      const low = (v4 & 0xffffn).toString(16);
      const prefixPart = text.slice(0, lastColon);
      text = prefixPart + (prefixPart.endsWith(':') ? '' : ':') + high + ':' + low;
    }

    assert((text.match(/::/g) || []).length <= 1, 'IPv6 possui mais de uma compressão “::”.');
    let groups;
    if (text.includes('::')) {
      const [leftText, rightText] = text.split('::');
      const left = leftText ? leftText.split(':') : [];
      const right = rightText ? rightText.split(':') : [];
      assert(left.length + right.length < 8, 'Compressão “::” não representa nenhum grupo.');
      groups = [...left, ...Array(8 - left.length - right.length).fill('0'), ...right];
    } else {
      groups = text.split(':');
      assert(groups.length === 8, 'IPv6 sem “::” deve conter oito hextetos.');
    }

    assert(groups.length === 8, 'IPv6 deve resultar em oito hextetos.');
    let value = 0n;
    for (const group of groups) {
      assert(/^[0-9a-f]{1,4}$/.test(group), `Hexteto IPv6 inválido: ${group || '(vazio)'}.`);
      value = (value << 16n) | BigInt('0x' + group);
    }
    return { value, zone };
  }

  function expandedIPv6(value) {
    value = BigInt(value);
    assert(value >= 0n && value <= MAX6, 'Valor IPv6 fora do intervalo.');
    const groups = [];
    for (let shift = 112n; shift >= 0n; shift -= 16n) groups.push(((value >> shift) & 0xffffn).toString(16).padStart(4, '0'));
    return groups.join(':');
  }

  function compressedIPv6(value) {
    const groups = expandedIPv6(value).split(':').map(group => group.replace(/^0+/, '') || '0');
    let bestStart = -1, bestLen = 0;
    for (let i = 0; i < groups.length;) {
      if (groups[i] !== '0') { i++; continue; }
      let j = i;
      while (j < groups.length && groups[j] === '0') j++;
      const len = j - i;
      if (len >= 2 && len > bestLen) { bestStart = i; bestLen = len; }
      i = j;
    }
    if (bestStart === -1) return groups.join(':');
    const before = groups.slice(0, bestStart).join(':');
    const after = groups.slice(bestStart + bestLen).join(':');
    if (before && after) return `${before}::${after}`;
    if (before) return `${before}::`;
    if (after) return `::${after}`;
    return '::';
  }

  function prefixToMask6(prefix) {
    prefix = Number(prefix);
    assert(Number.isInteger(prefix) && prefix >= 0 && prefix <= 128, 'Prefixo IPv6 deve estar entre /0 e /128.');
    return prefix === 0 ? 0n : (MAX6 << BigInt(128 - prefix)) & MAX6;
  }

  function parseCIDR6(input, defaultPrefix = 64) {
    const text = String(input).trim();
    assert(text, 'Informe um endereço ou bloco IPv6.');
    let addressText = text;
    let prefix = defaultPrefix;
    if (text.includes('/')) {
      const slash = text.lastIndexOf('/');
      addressText = text.slice(0, slash).trim();
      prefix = Number(text.slice(slash + 1).trim());
    }
    assert(Number.isInteger(prefix) && prefix >= 0 && prefix <= 128, 'Prefixo IPv6 deve estar entre /0 e /128.');
    const parsed = parseIPv6(addressText);
    const mask = prefixToMask6(prefix);
    const hostMask = MAX6 ^ mask;
    const network = parsed.value & mask;
    const last = network | hostMask;
    const total = pow2(128 - prefix);
    return {
      family: 6,
      input: text,
      ip: parsed.value,
      zone: parsed.zone,
      prefix,
      mask,
      hostMask,
      network,
      first: network,
      last,
      total,
      hostBits: 128 - prefix,
      cidr: `${compressedIPv6(network)}/${prefix}`
    };
  }

  function ipv6Binary(value) {
    return BigInt(value).toString(2).padStart(128, '0').match(/.{16}/g).join(':');
  }

  function isIn6(ip, base, prefix) {
    const mask = prefixToMask6(prefix);
    return (ip & mask) === (base & mask);
  }

  function classifyIPv6(ip) {
    ip = BigInt(ip);
    const range = (addr, prefix) => isIn6(ip, parseIPv6(addr).value, prefix);
    if (ip === 0n) return { label: 'Não especificado', scope: 'Especial', globallyReachable: false };
    if (ip === 1n) return { label: 'Loopback', scope: 'Host', globallyReachable: false };
    if (range('::ffff:0:0', 96)) return { label: 'IPv4 mapeado em IPv6', scope: 'Transição/API', globallyReachable: false, embeddedIPv4: intToIPv4(ip & MAX4) };
    if (range('64:ff9b::', 96)) return { label: 'NAT64 — prefixo bem conhecido', scope: 'Tradução', globallyReachable: true, embeddedIPv4: intToIPv4(ip & MAX4) };
    if (range('100::', 64)) return { label: 'Discard-only', scope: 'Especial', globallyReachable: false };
    if (range('2001:db8::', 32)) return { label: 'Documentação', scope: 'Documentação', globallyReachable: false };
    if (range('2002::', 16)) return { label: '6to4 (mecanismo legado)', scope: 'Transição', globallyReachable: true };
    if (range('fc00::', 7)) return { label: 'Unique Local Address (ULA)', scope: 'Local', globallyReachable: false };
    if (range('fe80::', 10)) return { label: 'Link-local', scope: 'Enlace', globallyReachable: false };
    if (range('fec0::', 10)) return { label: 'Site-local descontinuado', scope: 'Legado', globallyReachable: false };
    if (range('ff00::', 8)) {
      const scopeCode = Number((ip >> 112n) & 0xfn);
      const scopes = { 1: 'interface', 2: 'enlace', 3: 'realm', 4: 'admin', 5: 'site', 8: 'organização', 14: 'global' };
      return { label: `Multicast (escopo ${scopes[scopeCode] || '0x' + scopeCode.toString(16)})`, scope: 'Grupo', globallyReachable: scopeCode === 14 };
    }
    if (range('2000::', 3)) return { label: 'Global Unicast', scope: 'Global', globallyReachable: true };
    return { label: 'Unicast especial ou reservado', scope: 'Especial', globallyReachable: false };
  }

  function reverseDNS6(ip) {
    const hex = BigInt(ip).toString(16).padStart(32, '0');
    return hex.split('').reverse().join('.') + '.ip6.arpa';
  }

  function subnet6(baseInput, newPrefix, startIndex = 0n, limit = 64) {
    const base = parseCIDR6(baseInput);
    newPrefix = Number(newPrefix);
    assert(Number.isInteger(newPrefix) && newPrefix >= base.prefix && newPrefix <= 128, `Novo prefixo deve estar entre /${base.prefix} e /128.`);
    startIndex = BigInt(startIndex);
    limit = Number(limit);
    assert(startIndex >= 0n, 'Índice inicial deve ser positivo.');
    assert(Number.isInteger(limit) && limit >= 1 && limit <= 1000, 'Quantidade para listar deve estar entre 1 e 1000.');

    const count = pow2(newPrefix - base.prefix);
    assert(startIndex < count, `Índice inicial deve ser menor que ${formatInteger(count)}.`);
    const blockSize = pow2(128 - newPrefix);
    const items = [];
    const end = startIndex + BigInt(limit) > count ? count : startIndex + BigInt(limit);
    for (let i = startIndex; i < end; i++) {
      const network = base.network + i * blockSize;
      items.push({ index: i, network, last: network + blockSize - 1n, cidr: `${compressedIPv6(network)}/${newPrefix}` });
    }
    return { base, newPrefix, count, blockSize, startIndex, items };
  }

  function eui64FromMac(macText) {
    const clean = String(macText).trim().replace(/[-.]/g, ':');
    let parts;
    if (/^[0-9a-fA-F]{12}$/.test(clean)) parts = clean.match(/.{2}/g);
    else parts = clean.split(':');
    assert(parts.length === 6 && parts.every(p => /^[0-9a-fA-F]{2}$/.test(p)), 'MAC deve conter seis bytes hexadecimais.');
    const bytes = parts.map(p => parseInt(p, 16));
    bytes[0] ^= 0x02;
    const eui = [bytes[0], bytes[1], bytes[2], 0xff, 0xfe, bytes[3], bytes[4], bytes[5]];
    let iid = 0n;
    for (const byte of eui) iid = (iid << 8n) | BigInt(byte);
    return { iid, text: eui.map(b => b.toString(16).padStart(2, '0')).join(':') };
  }

  function addressFromEUI64(prefixInput, macText) {
    const block = parseCIDR6(prefixInput);
    assert(block.prefix <= 64, 'O prefixo para EUI-64 deve ser /64 ou menor.');
    const prefix64 = block.network & prefixToMask6(64);
    const eui = eui64FromMac(macText);
    const address = prefix64 | eui.iid;
    const linkLocal = parseIPv6('fe80::').value | eui.iid;
    return { ...eui, address, linkLocal };
  }

  function generateULA(randomBytes) {
    const bytes = randomBytes || (() => {
      const arr = new Uint8Array(5);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(arr);
      else for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
      return arr;
    })();
    assert(bytes.length === 5, 'ULA requer 40 bits aleatórios.');
    let globalId = 0n;
    for (const byte of bytes) globalId = (globalId << 8n) | BigInt(byte);
    const prefixValue = (0xfdn << 120n) | (globalId << 80n);
    return { globalId, prefixValue, cidr: `${compressedIPv6(prefixValue)}/48` };
  }

  function prefixForAddresses6(addresses) {
    addresses = BigInt(addresses);
    assert(addresses >= 1n, 'Quantidade deve ser pelo menos 1.');
    let bits = 0;
    let capacity = 1n;
    while (capacity < addresses) { capacity <<= 1n; bits++; }
    return { prefix: 128 - bits, capacity };
  }

  // ---------- Comparação ----------
  function detectFamily(text) {
    return String(text).includes(':') ? 6 : 4;
  }

  function compareCIDRs(aText, bText) {
    const familyA = detectFamily(aText);
    const familyB = detectFamily(bText);
    assert(familyA === familyB, 'Os dois blocos devem pertencer à mesma família IP.');
    const a = familyA === 4 ? parseCIDR4(aText) : parseCIDR6(aText);
    const b = familyA === 4 ? parseCIDR4(bText) : parseCIDR6(bText);
    const aContainsB = a.network <= b.network && a.last >= b.last;
    const bContainsA = b.network <= a.network && b.last >= a.last;
    const overlaps = a.network <= b.last && b.network <= a.last;
    return { family: familyA, a, b, aContainsB, bContainsA, overlaps, same: a.network === b.network && a.prefix === b.prefix };
  }

  return {
    MAX4, MAX6, pow2, formatInteger, formatPowerOfTwo,
    parseIPv4, intToIPv4, prefixToMask4, maskToPrefix4, parseCIDR4, ipv4Binary, ipv4Hex, classifyIPv4, reverseDNS4, subnet4, prefixForUsableHosts4, allocateVLSM4,
    parseIPv6, expandedIPv6, compressedIPv6, prefixToMask6, parseCIDR6, ipv6Binary, classifyIPv6, reverseDNS6, subnet6, eui64FromMac, addressFromEUI64, generateULA, prefixForAddresses6,
    detectFamily, compareCIDRs
  };
});
